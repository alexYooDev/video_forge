const {
  CognitoIdentityProviderClient,
  SignUpCommand,
  InitiateAuthCommand,
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminUpdateUserAttributesCommand,
  AdminGetUserCommand,
  ListUsersCommand,
  RespondToAuthChallengeCommand,
  ConfirmSignUpCommand,
  ResendConfirmationCodeCommand,
  AdminAddUserToGroupCommand,
  AdminListGroupsForUserCommand,
} = require('@aws-sdk/client-cognito-identity-provider');

const jwt = require('jsonwebtoken');
const jwkToPem = require('jwk-to-pem');
const axios = require('axios');
const crypto = require('crypto');
const { UnauthorizedError, NotFoundError, ConflictError, BadRequest } = require('../utils/errors');
const awsConfig = require('../config/awsConfig');
const authService = require('./authService');

class CognitoService {
  constructor() {
    this.region = process.env.AWS_REGION || 'ap-southeast-2';
    this.userPoolId = null;
    this.clientId = null;
    this.clientSecret = null;
    this.cognitoClient = new CognitoIdentityProviderClient({ region: this.region });
    this.jwks = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    console.log('Initializing CognitoService with AWS configuration...');
    const config = await awsConfig.getEnvironmentConfig();
    this.region = config.aws.region;
    this.userPoolId = config.aws.cognitoUserPoolId;
    this.clientId = config.aws.cognitoClientId;
    this.clientSecret = config.aws.cognitoClientSecret;

    console.log('Cognito config loaded:', {
      region: this.region,
      userPoolId: this.userPoolId ? 'SET' : 'MISSING',
      clientId: this.clientId ? 'SET' : 'MISSING',
      clientSecret: this.clientSecret ? 'SET' : 'MISSING'
    });

    if (!this.userPoolId || !this.clientId) {
      console.warn('Cognito configuration missing. Please set COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID');
    }

    if (!this.clientSecret) {
      console.warn('Cognito client secret missing. Please set COGNITO_CLIENT_SECRET');
    }

    this.cognitoClient = new CognitoIdentityProviderClient({ region: this.region });
    this.initialized = true;
    console.log('CognitoService initialization complete');
  }

  async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  // Calculate SECRET_HASH required for Cognito operations when using client secret
  calculateSecretHash(username) {
    if (!this.clientSecret) {
      console.log('No client secret available for SECRET_HASH calculation');
      return undefined;
    }

    const message = username + this.clientId;
    const secretHash = crypto.createHmac('sha256', this.clientSecret).update(message).digest('base64');

    console.log('SECRET_HASH calculation:', {
      username: username,
      clientIdLength: this.clientId?.length,
      clientSecretLength: this.clientSecret?.length,
      messageToHash: message,
      secretHashLength: secretHash?.length
    });

    return secretHash;
  }

  async getJWKS() {
    if (!this.jwks) {
      const jwksUrl = `https://cognito-idp.${this.region}.amazonaws.com/${this.userPoolId}/.well-known/jwks.json`;
      const response = await axios.get(jwksUrl);
      this.jwks = response.data.keys;
    }
    return this.jwks;
  }

  async verifyToken(token) {
    try {
      const decoded = jwt.decode(token, { complete: true });
      if (!decoded) {
        throw UnauthorizedError('Invalid token format');
      }

      const jwks = await this.getJWKS();
      const jwk = jwks.find(key => key.kid === decoded.header.kid);
      
      if (!jwk) {
        throw UnauthorizedError('Token verification key not found');
      }

      const pem = jwkToPem(jwk);
      const verified = jwt.verify(token, pem, { algorithms: ['RS256'] });

      console.log('verifyToken - JWT payload:', {
        sub: verified.sub,
        email: verified.email,
        username: verified['cognito:username'],
        cognitoUsername: verified['cognito:username'],
        preferredUsername: verified['preferred_username'],
        customRole: verified['custom:role']
      });

      return {
        id: verified.sub,
        email: verified.email,
        username: verified['cognito:username'] || verified['preferred_username'],
        role: verified['custom:role'] || 'user'
      };
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw UnauthorizedError('Token expired');
      }
      throw UnauthorizedError('Invalid token');
    }
  }

  async register(email, password, username) {
    await this.ensureInitialized();
    try {
      const params = {
        ClientId: this.clientId,
        Username: username,
        Password: password,
        UserAttributes: [
          {
            Name: 'email',
            Value: email
          }
        ]
      };

      // Add SECRET_HASH if client secret is configured
      const secretHash = this.calculateSecretHash(username);
      if (secretHash) {
        params.SecretHash = secretHash;
      }

      const command = new SignUpCommand(params);
      const response = await this.cognitoClient.send(command);

      return {
        userSub: response.UserSub,
        email: email,
        username: username,
        emailVerified: false,
        message: 'User registered successfully. Please check your email for verification code.'
      };
    } catch (error) {
      if (error.name === 'UsernameExistsException') {
        throw ConflictError('User with this email already exists');
      }
      if (error.name === 'InvalidPasswordException') {
        throw BadRequest('Password does not meet requirements');
      }
      throw BadRequest(error.message);
    }
  }

  /** Confirm user registration with email verification code */
  async confirmSignUp(email, confirmationCode) {
    await this.ensureInitialized();

    console.log('Confirming sign up for:', email, 'with code length:', confirmationCode?.length);

    try {
      const params = {
        ClientId: this.clientId,
        Username: email,
        ConfirmationCode: confirmationCode
      };

      // Add SECRET_HASH if client secret is configured
      const secretHash = this.calculateSecretHash(email);
      if (secretHash) {
        params.SecretHash = secretHash;
        console.log('SECRET_HASH added to confirmation request');
      }

      console.log('Sending ConfirmSignUp command to Cognito');
      const command = new ConfirmSignUpCommand(params);
      await this.cognitoClient.send(command);

      // Add verified user to User group
      try {
        await this.addUserToGroup(email, 'User');
        console.log(`User ${email} added to User group after email verification`);
      } catch (groupError) {
        console.warn(`Failed to add user ${email} to User group:`, groupError.message);
        // Don't fail email confirmation if group assignment fails
      }

      return {
        message: 'Email verified successfully. You can now log in.'
      };
    } catch (error) {
      console.error('ConfirmSignUp error details:', {
        errorName: error.name,
        errorMessage: error.message,
        errorCode: error.$metadata?.httpStatusCode,
        requestId: error.$metadata?.requestId,
        awsErrorCode: error.__type || error.code,
        email: email,
        codeLength: confirmationCode?.length
      });

      if (error.name === 'CodeMismatchException' || error.__type === 'CodeMismatchException') {
        console.error('Code mismatch - possible causes: wrong code, expired code, or wrong SECRET_HASH');
        throw BadRequest('Invalid verification code');
      }
      if (error.name === 'ExpiredCodeException' || error.__type === 'ExpiredCodeException') {
        console.error('Code has expired');
        throw BadRequest('Verification code has expired. Please request a new one.');
      }
      if (error.name === 'UserNotFoundException' || error.__type === 'UserNotFoundException') {
        console.error('User not found during confirmation');
        throw NotFoundError('User not found');
      }
      if (error.name === 'NotAuthorizedException' || error.__type === 'NotAuthorizedException') {
        console.error('Not authorized - likely SECRET_HASH mismatch');
        throw BadRequest('Invalid verification request. Please try resending the code.');
      }

      console.error('Unexpected confirmSignUp error:', error);
      throw BadRequest(error.message);
    }
  }

  /* Resend email verification code */
  async resendConfirmationCode(email) {
    await this.ensureInitialized();

    console.log('Resending confirmation code for:', email);

    try {
      const params = {
        ClientId: this.clientId,
        Username: email
      };

      // Add SECRET_HASH if client secret is configured
      const secretHash = this.calculateSecretHash(email);
      if (secretHash) {
        params.SecretHash = secretHash;
        console.log('SECRET_HASH added to resend confirmation request');
      }

      console.log('Sending ResendConfirmationCode command to Cognito');
      const command = new ResendConfirmationCodeCommand(params);
      await this.cognitoClient.send(command);

      console.log('Confirmation code resent successfully for:', email);
      return {
        message: 'Verification code sent to your email.'
      };
    } catch (error) {
      console.error('Resend confirmation code error:', {
        errorName: error.name,
        errorMessage: error.message,
        email: email
      });

      if (error.name === 'UserNotFoundException') {
        throw NotFoundError('User not found');
      }
      if (error.name === 'InvalidParameterException') {
        throw BadRequest('User is already confirmed');
      }
      if (error.name === 'LimitExceededException') {
        throw BadRequest('Too many requests. Please wait before requesting another code.');
      }
      throw BadRequest(error.message);
    }
  }

  async login(email, password) {
    await this.ensureInitialized();
    try {
      const params = {
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: this.clientId,
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password
        }
      };

      // Add SECRET_HASH if client secret is configured
      const secretHash = this.calculateSecretHash(email);
      if (secretHash) {
        params.AuthParameters.SECRET_HASH = secretHash;
      }

      const command = new InitiateAuthCommand(params);
      const response = await this.cognitoClient.send(command);

      if (response.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
        return {
          challengeName: 'NEW_PASSWORD_REQUIRED',
          session: response.Session,
          message: 'New password required'
        };
      }

      if (response.ChallengeName === 'EMAIL_OTP') {
        return {
          challenge: 'EMAIL_OTP',
          session: response.Session,
          message: 'Please enter the 6-digit code sent to your email',
          destination: response.ChallengeParameters?.CODE_DELIVERY_DESTINATION
        };
      }

      const idToken = response.AuthenticationResult.IdToken;
      const accessToken = response.AuthenticationResult.AccessToken;
      const refreshToken = response.AuthenticationResult.RefreshToken;

      const userInfo = await this.verifyTokenWithPermissions(idToken);

      return {
        user: {
          id: userInfo.id,
          email: userInfo.email,
          username: userInfo.username,
          role: userInfo.role,
          groups: userInfo.groups,
          permissions: userInfo.permissions
        },
        tokens: {
          idToken,
          accessToken,
          refreshToken
        }
      };
    } catch (error) {
      if (error.name === 'NotAuthorizedException') {
        throw UnauthorizedError('Invalid email or password');
      }
      if (error.name === 'UserNotConfirmedException') {
        throw UnauthorizedError('Please verify your email before logging in');
      }
      if (error.name === 'LimitExceededException' || error.__type === 'LimitExceededException') {
        throw BadRequest('Too many failed login attempts. Please wait a few minutes before trying again.');
      }
      throw UnauthorizedError(error.message);
    }
  }

  async adminCreateUser(email, temporaryPassword, role = 'user') {
    await this.ensureInitialized();
    try {
      const params = {
        UserPoolId: this.userPoolId,
        Username: email,
        UserAttributes: [
          {
            Name: 'email',
            Value: email
          },
          {
            Name: 'custom:role',
            Value: role
          }
        ],
        TemporaryPassword: temporaryPassword,
        MessageAction: 'SUPPRESS'
      };

      const command = new AdminCreateUserCommand(params);
      await this.cognitoClient.send(command);

      return {
        email,
        role,
        status: 'created',
        temporaryPassword
      };
    } catch (error) {
      if (error.name === 'UsernameExistsException') {
        throw ConflictError('User already exists');
      }
      throw BadRequest(error.message);
    }
  }

  async getAllUsers() {
    await this.ensureInitialized();
    try {
      const params = {
        UserPoolId: this.userPoolId,
        Limit: 60
      };

      const command = new ListUsersCommand(params);
      const response = await this.cognitoClient.send(command);

      // Get groups for each user to determine role
      const usersWithGroups = await Promise.all(
        response.Users.map(async (user) => {
          let userGroups = [];
          let role = 'user';

          try {
            const groupInfo = await this.getUserGroups(user.Username);
            userGroups = groupInfo.groups;
            role = groupInfo.role;
          } catch (error) {
            console.warn(`Failed to get groups for user ${user.Username}:`, error.message);
          }

          return {
            id: user.Username,
            email: user.Attributes?.find(attr => attr.Name === 'email')?.Value,
            username: user.Attributes?.find(attr => attr.Name === 'preferred_username')?.Value || user.Username,
            role: role,
            groups: userGroups,
            status: user.UserStatus,
            created_at: user.UserCreateDate,
            enabled: user.Enabled
          };
        })
      );

      console.log(`📋 Retrieved ${usersWithGroups.length} users from Cognito with group information`);
      return usersWithGroups;
    } catch (error) {
      console.error('getAllUsers error:', error);
      throw BadRequest(error.message);
    }
  }

  async deleteUser(username) {
    await this.ensureInitialized();
    try {
      const params = {
        UserPoolId: this.userPoolId,
        Username: username
      };

      const command = new AdminDeleteUserCommand(params);
      await this.cognitoClient.send(command);

      return { success: true };
    } catch (error) {
      if (error.name === 'UserNotFoundException') {
        throw NotFoundError('User not found');
      }
      throw BadRequest(error.message);
    }
  }

  async updateUserRole(username, role) {
    await this.ensureInitialized();
    try {
      const params = {
        UserPoolId: this.userPoolId,
        Username: username,
        UserAttributes: [
          {
            Name: 'custom:role',
            Value: role
          }
        ]
      };

      const command = new AdminUpdateUserAttributesCommand(params);
      await this.cognitoClient.send(command);

      const getUserParams = {
        UserPoolId: this.userPoolId,
        Username: username
      };

      const getUserCommand = new AdminGetUserCommand(getUserParams);
      const userResponse = await this.cognitoClient.send(getUserCommand);

      return {
        id: userResponse.Username,
        email: userResponse.UserAttributes?.find(attr => attr.Name === 'email')?.Value,
        username: userResponse.UserAttributes?.find(attr => attr.Name === 'preferred_username')?.Value,
        role: userResponse.UserAttributes?.find(attr => attr.Name === 'custom:role')?.Value || 'user'
      };
    } catch (error) {
      if (error.name === 'UserNotFoundException') {
        throw NotFoundError('User not found');
      }
      throw BadRequest(error.message);
    }
  }

  async getUserById(userId) {
    await this.ensureInitialized();
    try {
      const params = {
        UserPoolId: this.userPoolId,
        Username: userId
      };

      const command = new AdminGetUserCommand(params);
      const response = await this.cognitoClient.send(command);

      return {
        id: response.Username,
        email: response.UserAttributes?.find(attr => attr.Name === 'email')?.Value,
        username: response.UserAttributes?.find(attr => attr.Name === 'preferred_username')?.Value,
        role: response.UserAttributes?.find(attr => attr.Name === 'custom:role')?.Value || 'user',
        created_at: response.UserCreateDate
      };
    } catch (error) {
      if (error.name === 'UserNotFoundException') {
        throw NotFoundError('User not found');
      }
      throw BadRequest(error.message);
    }
  }

  // ============ MFA METHODS ============
  // Note: This application uses Email OTP for MFA, not TOTP


  /** Complete Email OTP MFA challenge */
  async completeMFAChallenge(session, otpCode, challengeName = 'EMAIL_OTP', username = null) {
    try {
      console.log('MFA Challenge Debug:', {
        challengeName,
        otpCode: otpCode ? '***' : 'missing',
        sessionExists: !!session,
        sessionLength: session?.length
      });

      if (challengeName !== 'EMAIL_OTP') {
        throw BadRequest(`Unsupported challenge type: ${challengeName}. Only EMAIL_OTP is supported.`);
      }

      const challengeResponses = {
        EMAIL_OTP_CODE: otpCode
      };

      // Add SECRET_HASH and USERNAME for EMAIL_OTP challenges if client secret is configured
      if (username) {
        challengeResponses.USERNAME = username;
        const secretHash = this.calculateSecretHash(username);
        if (secretHash) {
          challengeResponses.SECRET_HASH = secretHash;
          console.log('Added USERNAME and SECRET_HASH for EMAIL_OTP challenge');
        }
      }

      const params = {
        ChallengeName: challengeName,
        Session: session,
        ClientId: this.clientId,
        ChallengeResponses: challengeResponses
      };

      console.log('Sending RespondToAuthChallenge with params:', {
        ChallengeName: params.ChallengeName,
        ClientId: params.ClientId,
        ChallengeResponses: params.ChallengeResponses,
        sessionLength: params.Session?.length
      });

      const command = new RespondToAuthChallengeCommand(params);
      const response = await this.cognitoClient.send(command);

      if (response.AuthenticationResult) {
        try {
          console.log('Email OTP MFA completion - verifying ID token for user info...');
          const idTokenInfo = await this.verifyToken(response.AuthenticationResult.IdToken);

          console.log('Email OTP MFA completion - getting permissions with username:', idTokenInfo.username);
          const groupInfo = await this.getUserGroups(idTokenInfo.username);

          const userInfo = {
            ...idTokenInfo,
            groups: groupInfo.groups,
            role: groupInfo.role,
            permissions: groupInfo.permissions
          };

          console.log('Email OTP MFA completion - final user info:', {
            id: userInfo.id,
            email: userInfo.email,
            username: userInfo.username,
            role: userInfo.role,
            groups: userInfo.groups
          });

          return {
            tokens: response.AuthenticationResult,
            user: userInfo,
            message: 'Email OTP MFA login successful'
          };
        } catch (permError) {
          console.error('Email OTP MFA completion failed:', permError.message);
          throw permError;
        }
      }

      throw BadRequest('Email OTP MFA challenge failed');
    } catch (error) {
      console.error('Complete Email OTP MFA Challenge Error:', {
        errorName: error.name,
        errorMessage: error.message,
        errorCode: error.$metadata?.httpStatusCode,
        awsErrorCode: error.__type || error.code,
        challengeName,
        otpCodeLength: otpCode?.length
      });

      if (error.name === 'NotAuthorizedException') {
        throw UnauthorizedError('Invalid Email OTP code');
      }
      throw BadRequest(error.message);
    }
  }

  // ============ COGNITO GROUPS FOR PERMISSIONS ============

  // Add user to a Cognito group (Admin or User)
  async addUserToGroup(username, groupName) {
    await this.ensureInitialized();
    try {
      const params = {
        UserPoolId: this.userPoolId,
        Username: username,
        GroupName: groupName
      };

      const command = new AdminAddUserToGroupCommand(params);
      await this.cognitoClient.send(command);

      return {
        message: `User added to ${groupName} group successfully`,
        username,
        group: groupName
      };
    } catch (error) {
      throw BadRequest(`Failed to add user to group: ${error.message}`);
    }
  }

  // Get user's groups for permission checking
  async getUserGroups(username) {
    await this.ensureInitialized();

    if (!username) {
      return {
        username: '',
        groups: [],
        role: 'user',
        permissions: ['read', 'write']
      };
    }

    try {
      const params = {
        UserPoolId: this.userPoolId,
        Username: username
      };

      const command = new AdminListGroupsForUserCommand(params);
      const response = await this.cognitoClient.send(command);

      let groups = response.Groups.map(group => group.GroupName);

      // Special handling for federated users (OAuth users)
      const isFederatedUser = username.startsWith('google_');

      if (isFederatedUser && groups.length === 0) {
        // Federated users default to user group permissions
        groups.push('user');
      }

      const isAdmin = groups.includes('admin') || groups.includes('Admin');


      return {
        username,
        groups,
        role: isAdmin ? 'admin' : 'user',
        permissions: isAdmin ? ['read', 'write', 'delete', 'admin'] : ['read', 'write']
      };
    } catch (error) {
      console.error('getUserGroups error:', {
        username,
        errorName: error.name,
        errorMessage: error.message,
        errorCode: error.$metadata?.httpStatusCode,
        awsErrorCode: error.__type || error.code
      });

      return {
        username,
        groups: [],
        role: 'user',
        permissions: ['read', 'write']
      };
    }
  }

  // Enhanced register that will assign to User group after email verification
  async addUserToGroup(username, groupName) {
    await this.ensureInitialized();
    try {
      const params = {
        UserPoolId: this.userPoolId,
        Username: username,
        GroupName: groupName
      };

      const command = new AdminAddUserToGroupCommand(params);
      await this.cognitoClient.send(command);
      console.log(`User ${username} added to group ${groupName}`);
      return true;
    } catch (error) {
      console.error(`Failed to add user ${username} to group ${groupName}:`, error.message);
      throw error;
    }
  }

  async registerWithGroups(email, password, username) {
    try {
      const registrationResult = await this.register(email, password, username);

      // Try to add to user group immediately (will work if user is auto-confirmed)
      try {
        await this.addUserToGroup(username, 'user');
        console.log(`New user ${username} automatically added to 'user' group`);
      } catch (groupError) {
        console.log(`User ${username} will be added to 'user' group after email confirmation`);
        // Group assignment will happen after email confirmation
      }

      return {
        ...registrationResult,
        message: 'User registered successfully. Please check your email for verification code. You will be added to User group after verification.'
      };
    } catch (error) {
      throw error;
    }
  }

  // Enhanced token verification with group-based permissions
  async verifyTokenWithPermissions(token) {
    try {
      const userInfo = await this.verifyToken(token);
      const groupInfo = await this.getUserGroups(userInfo.username || userInfo.email);

      console.log('Token verification with permissions:', {
        email: userInfo.email,
        username: userInfo.username,
        groups: groupInfo.groups,
        role: groupInfo.role
      });

      return {
        ...userInfo,
        groups: groupInfo.groups,
        role: groupInfo.role,
        permissions: groupInfo.permissions
      };
    } catch (error) {
      throw UnauthorizedError('Token verification failed');
    }
  }

  // ============ FEDERATED AUTHENTICATION ============

  /* Generate OAuth authorization URL for federated login */
  async getOAuthAuthorizationUrl(provider = 'Google', redirectUri = null) {
    await this.ensureInitialized();

    // Use provided redirectUri or build from environment config
    if (!redirectUri) {
      const config = await awsConfig.getEnvironmentConfig();
      redirectUri = `${config.app.baseUrl}/auth/callback`;
    }

    const cognitoDomain = `https://${this.userPoolId.split('_')[0]}${this.userPoolId.split('_')[1]}.auth.${this.region}.amazoncognito.com`;

    const params = new URLSearchParams({
      identity_provider: provider,
      redirect_uri: redirectUri,
      response_type: 'code',
      client_id: this.clientId,
      scope: 'openid email profile'
    });

    return `${cognitoDomain}/oauth2/authorize?${params.toString()}`;
  }

  /* Exchange OAuth authorization code for tokens */
  async exchangeCodeForTokens(authCode, redirectUri = null) {
    await this.ensureInitialized();

    // Use provided redirectUri or build from environment config
    if (!redirectUri) {
      const config = await awsConfig.getEnvironmentConfig();
      redirectUri = `${config.app.baseUrl}/auth/callback`;
    }

    try {
      const cognitoDomain = `https://${this.userPoolId.split('_')[0]}${this.userPoolId.split('_')[1]}.auth.${this.region}.amazoncognito.com`;

      const tokenEndpoint = `${cognitoDomain}/oauth2/token`;

      const params = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: redirectUri,
        code: authCode
      });


      const response = await axios.post(tokenEndpoint, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      const { access_token, id_token, refresh_token } = response.data;

      // Verify the ID token and get user info
      const userInfo = await this.verifyTokenWithPermissions(id_token);

      // Ensure user exists in local database
      await authService.ensureUserExists(userInfo);

      return {
        user: {
          id: userInfo.id,
          email: userInfo.email,
          username: userInfo.username,
          role: userInfo.role,
          groups: userInfo.groups
        },
        tokens: {
          accessToken: access_token,
          idToken: id_token,
          refreshToken: refresh_token
        },
        message: 'Federated login successful'
      };
    } catch (error) {
      console.error('OAuth token exchange error:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      throw UnauthorizedError('Federated authentication failed');
    }
  }

  /* Handle federated user after OAuth callback */
  async handleFederatedUser(idToken) {
    try {
      // Verify the token and get user information
      const userInfo = await this.verifyTokenWithPermissions(idToken);

      // Note: Federated users can't be added to Cognito groups using standard methods
      // They are handled as User group members in the getUserGroups method

      // Ensure user exists in local database
      await authService.ensureUserExists(userInfo);

      // Get updated user groups after adding to User group
      const updatedUserInfo = await this.verifyTokenWithPermissions(idToken);

      return {
        id: updatedUserInfo.id,
        email: updatedUserInfo.email,
        username: updatedUserInfo.username,
        role: updatedUserInfo.role,
        groups: updatedUserInfo.groups
      };
    } catch (error) {
      console.error('Federated user handling error:', error.message);
      throw UnauthorizedError('Failed to process federated user');
    }
  }
}

module.exports = new CognitoService();
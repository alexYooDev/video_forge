const {
  CognitoIdentityProviderClient,
  SignUpCommand,
  AdminInitiateAuthCommand,
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminUpdateUserAttributesCommand,
  AdminGetUserCommand,
  ListUsersCommand,
  AdminSetUserMFAPreferenceCommand,
  AdminRespondToAuthChallengeCommand,
  RespondToAuthChallengeCommand,
  AssociateSoftwareTokenCommand,
  VerifySoftwareTokenCommand,
  ConfirmSignUpCommand,
  CreateGroupCommand,
  AdminAddUserToGroupCommand,
  AdminRemoveUserFromGroupCommand,
  AdminListGroupsForUserCommand,
  ListGroupsCommand,
  GetGroupCommand,
  UpdateGroupCommand,
  DeleteGroupCommand
} = require('@aws-sdk/client-cognito-identity-provider');
const jwt = require('jsonwebtoken');
const jwkToPem = require('jwk-to-pem');
const axios = require('axios');
const { UnauthorizedError, NotFoundError, ConflictError, BadRequest } = require('../utils/errors');
const awsConfig = require('../config/awsConfig');

class CognitoService {
  constructor() {
    const config = awsConfig.getEnvironmentConfig();
    this.region = config.aws.region;
    this.userPoolId = config.aws.cognitoUserPoolId;
    this.clientId = config.aws.cognitoClientId;
    
    if (!this.userPoolId || !this.clientId) {
      console.warn('Cognito configuration missing. Please set COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID');
    }
    
    this.cognitoClient = new CognitoIdentityProviderClient({ region: this.region });
    this.jwks = null;
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

      return {
        id: verified.sub,
        email: verified.email,
        username: verified['cognito:username'],
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
    try {
      const params = {
        ClientId: this.clientId,
        Username: email,
        Password: password,
        UserAttributes: [
          {
            Name: 'email',
            Value: email
          }
        ]
      };

      params.UserAttributes.push({
        Name: 'preferred_username',
        Value: username
      });

      const command = new SignUpCommand(params);
      const response = await this.cognitoClient.send(command);

      return {
        userSub: response.UserSub,
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

  async login(email, password) {
    try {
      const params = {
        AuthFlow: 'ADMIN_NO_SRP_AUTH',
        UserPoolId: this.userPoolId,
        ClientId: this.clientId,
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password
        }
      };

      const command = new AdminInitiateAuthCommand(params);
      const response = await this.cognitoClient.send(command);

      if (response.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
        return {
          challengeName: 'NEW_PASSWORD_REQUIRED',
          session: response.Session,
          message: 'New password required'
        };
      }

      const idToken = response.AuthenticationResult.IdToken;
      const accessToken = response.AuthenticationResult.AccessToken;
      const refreshToken = response.AuthenticationResult.RefreshToken;

      const userInfo = await this.verifyToken(idToken);

      return {
        user: {
          id: userInfo.id,
          email: userInfo.email,
          username: userInfo.username,
          role: userInfo.role
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
      throw UnauthorizedError(error.message);
    }
  }

  async adminCreateUser(email, temporaryPassword, role = 'user') {
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
            Name: 'email_verified',
            Value: 'true'
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
    try {
      const params = {
        UserPoolId: this.userPoolId,
        Limit: 60
      };

      const command = new ListUsersCommand(params);
      const response = await this.cognitoClient.send(command);

      return response.Users.map(user => ({
        id: user.Username,
        email: user.Attributes?.find(attr => attr.Name === 'email')?.Value,
        username: user.Attributes?.find(attr => attr.Name === 'preferred_username')?.Value,
        role: user.Attributes?.find(attr => attr.Name === 'custom:role')?.Value || 'user',
        status: user.UserStatus,
        created_at: user.UserCreateDate
      }));
    } catch (error) {
      throw BadRequest(error.message);
    }
  }

  async deleteUser(username) {
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

  /**
   * Set up TOTP MFA for a user
   * @param {string} accessToken - User's access token from login
   * @returns {Promise<{secretCode: string, qrCodeUrl: string}>}
   */
  async setupTOTP(accessToken) {
    try {
      const params = {
        AccessToken: accessToken
      };

      const command = new AssociateSoftwareTokenCommand(params);
      const response = await this.cognitoClient.send(command);

      // Generate QR code URL for easier setup
      const qrCodeUrl = `otpauth://totp/VideoForge:user?secret=${response.SecretCode}&issuer=VideoForge`;

      return {
        secretCode: response.SecretCode,
        qrCodeUrl: qrCodeUrl,
        message: 'Please scan the QR code with your authenticator app and verify with a code'
      };
    } catch (error) {
      throw BadRequest(`MFA setup failed: ${error.message}`);
    }
  }

  /**
   * Verify TOTP setup and enable MFA
   * @param {string} accessToken - User's access token
   * @param {string} totpCode - 6-digit code from authenticator app
   * @returns {Promise<{message: string}>}
   */
  async verifyTOTP(accessToken, totpCode) {
    try {
      const verifyParams = {
        AccessToken: accessToken,
        UserCode: totpCode
      };

      const verifyCommand = new VerifySoftwareTokenCommand(verifyParams);
      await this.cognitoClient.send(verifyCommand);

      // Enable TOTP MFA for the user
      const setMfaParams = {
        AccessToken: accessToken,
        SoftwareTokenMfaSettings: {
          Enabled: true,
          PreferredMfa: true
        }
      };

      const setMfaCommand = new AdminSetUserMFAPreferenceCommand(setMfaParams);
      await this.cognitoClient.send(setMfaCommand);

      return {
        message: 'TOTP MFA enabled successfully'
      };
    } catch (error) {
      throw BadRequest(`MFA verification failed: ${error.message}`);
    }
  }

  /**
   * Login with MFA support
   * @param {string} email 
   * @param {string} password 
   * @returns {Promise<{challenge?: string, session?: string, tokens?: object}>}
   */
  async loginWithMFA(email, password) {
    try {
      const params = {
        AuthFlow: 'ADMIN_NO_SRP_AUTH',
        UserPoolId: this.userPoolId,
        ClientId: this.clientId,
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password
        }
      };

      const command = new AdminInitiateAuthCommand(params);
      const response = await this.cognitoClient.send(command);

      // Check if MFA challenge is required
      if (response.ChallengeName === 'SOFTWARE_TOKEN_MFA') {
        return {
          challenge: 'SOFTWARE_TOKEN_MFA',
          session: response.Session,
          message: 'Please enter your 6-digit authenticator code'
        };
      }

      // No MFA required, return tokens directly
      if (response.AuthenticationResult) {
        const userInfo = await this.verifyToken(response.AuthenticationResult.AccessToken);
        return {
          tokens: response.AuthenticationResult,
          user: userInfo,
          message: 'Login successful'
        };
      }

      throw BadRequest('Unexpected authentication response');
    } catch (error) {
      if (error.name === 'NotAuthorizedException') {
        throw UnauthorizedError('Invalid email or password');
      }
      throw BadRequest(error.message);
    }
  }

  /**
   * Complete MFA challenge
   * @param {string} session - Session from initial login
   * @param {string} totpCode - 6-digit TOTP code
   * @returns {Promise<{tokens: object, user: object}>}
   */
  async completeMFAChallenge(session, totpCode) {
    try {
      const params = {
        ChallengeName: 'SOFTWARE_TOKEN_MFA',
        Session: session,
        ClientId: this.clientId,
        ChallengeResponses: {
          SOFTWARE_TOKEN_MFA_CODE: totpCode
        }
      };

      const command = new RespondToAuthChallengeCommand(params);
      const response = await this.cognitoClient.send(command);

      if (response.AuthenticationResult) {
        const userInfo = await this.verifyToken(response.AuthenticationResult.AccessToken);
        return {
          tokens: response.AuthenticationResult,
          user: userInfo,
          message: 'MFA login successful'
        };
      }

      throw BadRequest('MFA challenge failed');
    } catch (error) {
      if (error.name === 'NotAuthorizedException') {
        throw UnauthorizedError('Invalid TOTP code');
      }
      throw BadRequest(error.message);
    }
  }

  /**
   * Disable MFA for a user
   * @param {string} accessToken - User's access token
   * @returns {Promise<{message: string}>}
   */
  async disableMFA(accessToken) {
    try {
      const params = {
        AccessToken: accessToken,
        SoftwareTokenMfaSettings: {
          Enabled: false,
          PreferredMfa: false
        }
      };

      const command = new AdminSetUserMFAPreferenceCommand(params);
      await this.cognitoClient.send(command);

      return {
        message: 'MFA disabled successfully'
      };
    } catch (error) {
      throw BadRequest(`MFA disable failed: ${error.message}`);
    }
  }

  // ============ COGNITO GROUPS FOR PERMISSIONS ============

  // Add user to a Cognito group (Admin or User)
  async addUserToGroup(username, groupName) {
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
    try {
      const params = {
        UserPoolId: this.userPoolId,
        Username: username
      };

      const command = new AdminListGroupsForUserCommand(params);
      const response = await this.cognitoClient.send(command);

      const groups = response.Groups.map(group => group.GroupName);
      const isAdmin = groups.includes('Admin');

      return {
        username,
        groups,
        role: isAdmin ? 'admin' : 'user',
        permissions: isAdmin ? ['read', 'write', 'delete', 'admin'] : ['read', 'write']
      };
    } catch (error) {
      return {
        username,
        groups: [],
        role: 'user',
        permissions: ['read', 'write']
      };
    }
  }

  // Enhanced register that assigns to User group by default
  async registerWithGroups(email, password, username) {
    try {
      const registrationResult = await this.register(email, password, username);
      
      // Add new users to "User" group by default
      await this.addUserToGroup(email, 'User');

      return {
        ...registrationResult,
        group: 'User',
        role: 'user',
        message: 'User registered and added to User group'
      };
    } catch (error) {
      // If group assignment fails, registration still succeeded
      console.warn('Group assignment failed:', error.message);
      return await this.register(email, password, username);
    }
  }

  // Enhanced token verification with group-based permissions
  async verifyTokenWithPermissions(token) {
    try {
      const userInfo = await this.verifyToken(token);
      const groupInfo = await this.getUserGroups(userInfo.email || userInfo.username);
      
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
}

module.exports = new CognitoService();
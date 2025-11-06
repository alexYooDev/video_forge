const { registerSchema, loginSchema } = require('../models/authSchema.js');
const authService = require('../services/authService.js');
const cognitoService = require('../services/cognitoService.js');
const { BadRequest } = require('../utils/errors');

class AuthController {
    constructor() {
        // Cognito configuration check moved to runtime
    }

    // Check if Cognito is configured at runtime (after AWS config is loaded)
    async useCognito() {
        try {
            await cognitoService.ensureInitialized();
            return !!(cognitoService.userPoolId && cognitoService.clientId && cognitoService.clientSecret);
        } catch (error) {
            console.warn('Failed to check Cognito configuration:', error.message);
            return false;
        }
    }

    // Force Cognito authentication only - no fallback to legacy auth
    async executeAuth(cognitoMethod, legacyMethod, ...args) {
        console.log('ExecuteAuth - Checking Cognito configuration...');
        const cognitoConfigured = await this.useCognito();
        console.log('ExecuteAuth - Cognito configured:', cognitoConfigured);

        if (!cognitoConfigured) {
            console.error('ExecuteAuth - Authentication system not configured');
            throw new Error('Authentication system not configured. Please contact administrator.');
        }

        try {
            console.log('ExecuteAuth - Calling Cognito method...');
            return await cognitoMethod(...args);
        } catch (cognitoError) {
            console.error(`Cognito authentication failed:`, cognitoError.message);
            console.error('Cognito error stack:', cognitoError.stack);
            throw cognitoError; // Don't fallback to legacy auth
        }
    }

    // ============ BASIC AUTH METHODS ============
    async register (req,res,next) {
        try {
            const {error, value} = registerSchema.validate(req.body);
            if (error) {
                throw BadRequest(`Validation failed: ${error.details.map(d => d.message).join(', ')}`);
            }

            const result = await this.executeAuth(
                () => cognitoService.registerWithGroups(value.email, value.password, value.username),
                () => authService.register(value.email, value.password, value.username)
            );

            res.status(201).json({result, message: 'User registered successfully'});
        } catch (err) {
            next(err);
        }
    }

    async login (req, res, next) {
        try {
            const {error, value} = loginSchema.validate(req.body);
            if (error) {
                throw BadRequest(`Validation failed: ${error.details.map(d => d.message).join(', ')}`);
            }

            const {username, password} = value;

            const result = await this.executeAuth(
                () => cognitoService.login(username, password),
                () => authService.login(username, password)
            );

            // Check if MFA challenge is required
            if (result.challenge) {
                // Return 401 to indicate authentication incomplete (MFA required)
                return res.status(401).json({
                    error: 'MFA_REQUIRED',
                    message: result.message || 'Multi-factor authentication required',
                    challengeName: result.challenge,
                    session: result.session,
                    destination: result.destination
                });
            }

            res.status(200).json({result, message: 'Login successful'});
        } catch (err) {
            next(err);
        }
    }

    async logout(_req, res) {
        res.status(200).json({result: null, message: 'Logout Successful'});
    }

    async refreshToken(req, res, next) {
        try {
            const { refreshToken } = req.body;

            if (!refreshToken) {
                throw BadRequest('Refresh token is required');
            }

            const result = await this.executeAuth(
                () => cognitoService.refreshToken(refreshToken),
                () => ({ message: 'Token refresh not supported for legacy auth' })
            );

            res.status(200).json({result, message: 'Token refreshed successfully'});
        } catch (err) {
            next(err);
        }
    }

    async getUsers(_req, res, next) {
        try {
            const users = await this.executeAuth(
                () => cognitoService.getAllUsers(),
                () => authService.getAllUsers()
            );
            res.status(200).json({result: users, message: 'Users retrieved successfully'});
        } catch (err) {
            next(err);
        }
    }

    async deleteUser(req, res, next) {
        try {
            const { userId } = req.params;

            await this.executeAuth(
                () => cognitoService.deleteUser(userId),
                () => authService.deleteUser(userId)
            );

            res.status(200).json({result: null, message: 'User deleted successfully'});
        } catch (err) {
            next(err);
        }
    }

    async updateUserRole(req, res, next) {
        try {
            const { userId } = req.params;
            const { role } = req.body;

            if (!['user', 'admin'].includes(role)) {
                throw BadRequest('Invalid role. Must be user or admin');
            }

            const user = await this.executeAuth(
                () => cognitoService.updateUserRole(userId, role),
                () => authService.updateUserRole(userId, role)
            );

            res.status(200).json({result: user, message: 'User role updated successfully'});
        } catch (err) {
            next(err);
        }
    }

    // ============ EMAIL OTP MFA METHODS ============


    async completeMFA(req, res, next) {
        try {
            const { session, otpCode, challengeName = 'EMAIL_OTP', username } = req.body;

            if (!session || !otpCode) {
                throw BadRequest('Session and Email OTP code are required');
            }

            if (challengeName !== 'EMAIL_OTP') {
                throw BadRequest('Only EMAIL_OTP challenge is supported');
            }

            const result = await this.executeAuth(
                () => cognitoService.completeMFAChallenge(session, otpCode, challengeName, username),
                () => ({ message: 'Email OTP MFA not supported for legacy auth' })
            );

            res.status(200).json({result, message: 'Email OTP MFA login successful'});
        } catch (err) {
            next(err);
        }
    }


    // ============ COGNITO GROUPS METHODS ============

    // Add user to Admin group (admin only)
    async addToAdminGroup(req, res, next) {
        try {
            const { email } = req.body;
            if (!email) {
                throw BadRequest('Email is required');
            }

            const result = await this.executeAuth(
                () => cognitoService.addUserToGroup(email, 'Admin'),
                () => authService.updateUserRole(email, 'admin')
            );

            res.status(200).json({result, message: 'User promoted to Admin group'});
        } catch (err) {
            next(err);
        }
    }

    // Get user's groups and permissions
    async getUserPermissions(req, res, next) {
        try {
            const { email } = req.params;

            const result = await this.executeAuth(
                () => cognitoService.getUserGroups(email),
                () => ({ role: 'user', groups: [], permissions: ['read', 'write'] })
            );

            res.status(200).json({result, message: 'User permissions retrieved'});
        } catch (err) {
            next(err);
        }
    }

    // Enhanced register with group assignment
    async registerWithGroup(req, res, next) {
        try {
            const {error, value} = registerSchema.validate(req.body);
            if (error) {
                throw BadRequest(`Validation failed: ${error.details.map(d => d.message).join(', ')}`);
            }

            const result = await this.executeAuth(
                () => cognitoService.registerWithGroups(value.email, value.password, value.username),
                () => authService.register(value.email, value.password, value.username)
            );

            res.status(201).json({result, message: 'User registered with group assignment'});
        } catch (err) {
            next(err);
        }
    }

    // ============ EMAIL CONFIRMATION METHODS ============

    async confirmEmail(req, res, next) {
        try {
            const { email, confirmationCode, username } = req.body;

            if (!email || !confirmationCode) {
                throw BadRequest('Email and confirmation code are required');
            }

            // Use username if provided, otherwise fall back to email for legacy compatibility
            const usernameForConfirmation = username || email;

            const result = await this.executeAuth(
                () => cognitoService.confirmSignUp(usernameForConfirmation, confirmationCode),
                () => ({ message: 'Email confirmation not supported for legacy auth' })
            );

            res.status(200).json({result, message: 'Email confirmed successfully'});
        } catch (err) {
            next(err);
        }
    }

    async resendConfirmation(req, res, next) {
        try {
            const { email, username } = req.body;

            if (!email) {
                throw BadRequest('Email is required');
            }

            // Use username if provided, otherwise fall back to email for legacy compatibility
            const usernameForResend = username || email;

            const result = await this.executeAuth(
                () => cognitoService.resendConfirmationCode(usernameForResend),
                () => ({ message: 'Email confirmation not supported for legacy auth' })
            );

            res.status(200).json({result, message: 'Confirmation code sent'});
        } catch (err) {
            next(err);
        }
    }

    // ============ FEDERATED AUTHENTICATION ============

    async getOAuthUrl(req, res, next) {
        try {
            const { provider = 'Google', redirectUri } = req.query;

            const authUrl = await cognitoService.getOAuthAuthorizationUrl(provider, redirectUri);

            res.status(200).json({
                authUrl,
                message: 'OAuth authorization URL generated'
            });
        } catch (err) {
            next(err);
        }
    }

    async handleOAuthCallback(req, res, next) {
        try {
            const { code, redirectUri } = req.body;


            if (!code) {
                throw BadRequest('Authorization code is required');
            }

            // Check if we've already processed this code (simple in-memory cache)
            if (!this.processedCodes) {
                this.processedCodes = new Set();
            }

            if (this.processedCodes.has(code)) {
                throw BadRequest('Authorization code has already been used');
            }

            this.processedCodes.add(code);

            // Clean up old codes after 10 minutes (codes expire in 10 min anyway)
            setTimeout(() => {
                this.processedCodes.delete(code);
            }, 10 * 60 * 1000);

            const result = await cognitoService.exchangeCodeForTokens(code, redirectUri);

            res.status(200).json({
                user: result.user,
                token: result.tokens.idToken,
                message: result.message
            });
        } catch (err) {
            next(err);
        }
    }
}

module.exports = new AuthController();

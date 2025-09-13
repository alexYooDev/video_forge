const authSchema = require('../models/authSchema.js');
const authService = require('../services/authService.js');
const cognitoService = require('../services/cognitoService.js');
const { BadRequest } = require('../utils/errors');

class AuthController {
    constructor() {
        // Determine if Cognito is configured
        this.useCognito = !!(process.env.COGNITO_USER_POOL_ID && process.env.COGNITO_CLIENT_ID);
    }

    // if Cognito is configured, try using it first, otherwise fallback to legacy auth
    async executeAuth(cognitoMethod, legacyMethod, ...args) {
        if (!this.useCognito) {
            return await legacyMethod(...args);
        }

        try {
            return await cognitoMethod(...args);
        } catch (cognitoError) {
            console.log(`Cognito failed, using legacy auth:`, cognitoError.message);
            return await legacyMethod(...args);
        }
    }

    // ============ BASIC AUTH METHODS ============
    async register (req,res,next) {
        try {
            const {error, value} = authSchema.validate(req.body);
            if (error) {
                throw BadRequest(`Validation failed: ${error.details.map(d => d.message).join(', ')}`);
            }
            
            const result = await this.executeAuth(
                () => cognitoService.register(value.email, value.password, value.username),
                () => authService.register(value.email, value.password, value.username)
            );

            res.status(201).json({result, message: 'User registered successfully'});
        } catch (err) {
            next(err);
        }
    }

    async login (req, res, next) {
        try {
            const {error, value} = authSchema.validate(req.body);
            if (error) {
                throw BadRequest(`Validation failed: ${error.details.map(d => d.message).join(', ')}`);
            }

            const {email, password} = value;

            const result = await this.executeAuth(
                () => cognitoService.login(email, password),
                () => authService.login(email, password)
            );

            res.status(200).json({result, message: 'Login successful'});
        } catch (err) {
            next(err);
        }
    }

    async logout(_req, res) {
        res.status(200).json({result: null, message: 'Logout Successful'});
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

    // ============ MFA METHODS ============
    async setupMFA(req, res, next) {
        try {
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                throw BadRequest('Access token required');
            }
            
            const accessToken = authHeader.substring(7);
            
            const result = await this.executeAuth(
                () => cognitoService.setupTOTP(accessToken),
                () => ({ message: 'MFA not supported for legacy auth' })
            );

            res.status(200).json({result, message: 'MFA setup initiated'});
        } catch (err) {
            next(err);
        }
    }

    async verifyMFA(req, res, next) {
        try {
            const { totpCode } = req.body;
            if (!totpCode) {
                throw BadRequest('TOTP code is required');
            }

            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                throw BadRequest('Access token required');
            }
            
            const accessToken = authHeader.substring(7);
            
            const result = await this.executeAuth(
                () => cognitoService.verifyTOTP(accessToken, totpCode),
                () => ({ message: 'MFA not supported for legacy auth' })
            );

            res.status(200).json({result, message: 'MFA enabled successfully'});
        } catch (err) {
            next(err);
        }
    }

    async loginMFA(req, res, next) {
        try {
            const {error, value} = authSchema.validate(req.body);
            if (error) {
                throw BadRequest(`Validation failed: ${error.details.map(d => d.message).join(', ')}`);
            }

            const {email, password} = value;

            const result = await this.executeAuth(
                () => cognitoService.loginWithMFA(email, password),
                () => authService.login(email, password)
            );

            res.status(200).json({result, message: result.message || 'Login processed'});
        } catch (err) {
            next(err);
        }
    }

    async completeMFA(req, res, next) {
        try {
            const { session, totpCode } = req.body;
            
            if (!session || !totpCode) {
                throw BadRequest('Session and TOTP code are required');
            }

            const result = await this.executeAuth(
                () => cognitoService.completeMFAChallenge(session, totpCode),
                () => ({ message: 'MFA not supported for legacy auth' })
            );

            res.status(200).json({result, message: 'MFA login successful'});
        } catch (err) {
            next(err);
        }
    }

    async disableMFA(req, res, next) {
        try {
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                throw BadRequest('Access token required');
            }
            
            const accessToken = authHeader.substring(7);
            
            const result = await this.executeAuth(
                () => cognitoService.disableMFA(accessToken),
                () => ({ message: 'MFA not supported for legacy auth' })
            );

            res.status(200).json({result, message: 'MFA disabled successfully'});
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
            const {error, value} = authSchema.validate(req.body);
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
}

module.exports = new AuthController();
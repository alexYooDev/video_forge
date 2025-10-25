const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getCurrentModels } = require('../models/index');
const { UnauthorizedError, NotFoundError, ConflictError } = require('../utils/errors');
const awsConfig = require('../config/awsConfig');
const { apiLogger } = require('../utils/logger');

class AuthService {
    constructor() {
        this.initialized = false;
        this.jwtSecret = null;
        this.jwtExpiresIn = null;
    }

    async initialize() {
        if (this.initialized) return;

        // Load configuration from AWS
        const awsConfiguration = await awsConfig.loadConfiguration();
        this.jwtSecret = awsConfiguration.JWT_SECRET || 'fallback-secret';
        this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '12h'; // Not in AWS config yet
        this.initialized = true;
    }

    async ensureInitialized() {
        if (!this.initialized) {
            await this.initialize();
        }
    }

    // DRY: Extract user object creation (used in login, register, updateUserRole)
    formatUserResponse(user) {
        return {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role || 'user'
        };
    }

    async login(username, password) {
        const { User } = getCurrentModels();

        const user = await User.findOne({ where: { username } });
        
        if (!user) {
            throw UnauthorizedError('Invalid username or password');
        }
        
        const isPasswordValid = await bcrypt.compare(password, user.password);
        
        if (!isPasswordValid) {
            throw UnauthorizedError('Invalid username or password');
        }

        const userResponse = this.formatUserResponse(user);
        const token = await this.generateToken(userResponse);

        return {
            user: userResponse,
            token
        };
    }
    
    async generateToken(payload) {
        await this.ensureInitialized();
        return jwt.sign(
            payload,
            this.jwtSecret,
            {
                expiresIn: this.jwtExpiresIn,
                issuer: 'Video-Forge-api'
            }
        )
    }

    async verifyToken(token) {
        await this.ensureInitialized();
        try {
            return jwt.verify(token, this.jwtSecret);
        } catch(err) {
            if (err.name === 'TokenExpiredError') {
                throw UnauthorizedError('Token expired');
            }
            throw UnauthorizedError('Invalid token');
        }
    }
    
    async getUserById(userId) {
        const { User } = getCurrentModels();

        const user = await User.findByPk(userId, {
            attributes: ['id', 'username', 'email', 'role', 'created_at']
        });

        if (!user) {
            throw NotFoundError('User not found');
        }
        return user;
    }

    async register(email, password, username) {
        const { User } = getCurrentModels();

        // Check if user already exists by email
        const existingByEmail = await User.findOne({ where: { email } });
        if (existingByEmail) {
            throw ConflictError('User with this email already exists');
        }

        // Check if username is unique (now required)
        const existingByUsername = await User.findOne({ where: { username } });
        if (existingByUsername) {
            throw ConflictError('Username already taken');
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await User.create({
            username,
            email,
            password: hashedPassword
        });

        const userResponse = this.formatUserResponse(newUser);
        const token = await this.generateToken(userResponse);

        return {
            user: userResponse,
            token
        };
    }

    async getAllUsers() {
        const { User } = getCurrentModels();

        const users = await User.findAll({
            attributes: ['id', 'username', 'email', 'role', 'created_at'],
            order: [['created_at', 'DESC']]
        });
        return users;
    }

    async deleteUser(userId) {
        const { User } = getCurrentModels();

        const result = await User.destroy({
            where: { id: userId }
        });
        
        if (result === 0) {
            throw NotFoundError('User not found');
        }
        
        return result;
    }

    async updateUserRole(userId, role) {
        const { User } = getCurrentModels();

        const [updatedRowsCount] = await User.update(
            { role },
            { where: { id: userId } }
        );

        if (updatedRowsCount === 0) {
            throw NotFoundError('User not found');
        }

        return await this.getUserById(userId);
    }

    async ensureUserExists(userInfo) {
        try {
            const { User } = getCurrentModels();

            apiLogger.auth('Ensuring user exists for OAuth user', {
                userId: userInfo.id,
                email: userInfo.email,
                username: userInfo.username,
                role: userInfo.role
            });

            // Check if user already exists by ID
            let existingUser = await User.findByPk(userInfo.id);
            if (existingUser) {
                apiLogger.auth('User already exists in database', { userId: userInfo.id });
                return existingUser;
            }

            // Check if user exists by email (could be a different Cognito user with same email)
            existingUser = await User.findOne({ where: { email: userInfo.email } });
            if (existingUser) {
                apiLogger.auth('User exists by email, updating ID to match OAuth provider', {
                    userId: userInfo.id,
                    email: userInfo.email
                });
                // Update the existing user's ID to match OAuth provider
                await existingUser.update({ id: userInfo.id });
                return existingUser;
            }

            // Use Google-provided username or email as fallback
            const finalUsername = userInfo.username || userInfo.email;

            // Create user in local database
            const userData = {
                id: userInfo.id,
                email: userInfo.email,
                username: finalUsername,
                role: userInfo.role || 'user',
                password: null // OAuth users don't have passwords
            };

            apiLogger.auth('Creating new OAuth user', { userId: userInfo.id, email: userInfo.email });
            const newUser = await User.create(userData);
            apiLogger.auth('OAuth user created successfully', { userId: newUser.id });
            return newUser;
        } catch (error) {
            apiLogger.error('Failed to ensure user exists', error, {
                userId: userInfo.id,
                email: userInfo.email,
                username: userInfo.username
            });

            // Try to find user by email one more time (race condition handling)
            try {
                const { User } = getCurrentModels();
                const fallbackUser = await User.findOne({ where: { email: userInfo.email } });
                if (fallbackUser) {
                    apiLogger.auth('Found user in fallback search', { userId: fallbackUser.id });
                    return fallbackUser;
                }
            } catch (fallbackError) {
                apiLogger.error('Fallback search also failed', fallbackError, { email: userInfo.email });
            }

            // Throw error instead of returning null to prevent constraint violations
            throw new Error(`Failed to create user record for OAuth user: ${error.message}`);
        }
    }
}

module.exports = new AuthService();
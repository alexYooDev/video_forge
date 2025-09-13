const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models/index');
const { UnauthorizedError, NotFoundError, ConflictError } = require('../utils/errors');

class AuthService {
    // DRY: Extract user object creation (used in login, register, updateUserRole)
    formatUserResponse(user) {
        return {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role || 'user'
        };
    }

    async login(email, password) {
        const user = await User.findOne({ where: { email } });
        
        if (!user) {
            throw UnauthorizedError('Invalid email or password');
        }
        
        const isPasswordValid = await bcrypt.compare(password, user.password);
        
        if (!isPasswordValid) {
            throw UnauthorizedError('Invalid email or password');
        }

        const userResponse = this.formatUserResponse(user);
        const token = this.generateToken(userResponse);

        return {
            user: userResponse,
            token
        };
    }
    
    generateToken(payload) {
        return jwt.sign(
            payload,
            process.env.JWT_SECRET || 'fallback-secret',
            {
                expiresIn: process.env.JWT_EXPIRES_IN || '12h',
                issuer: 'Video-Forge-api'
            }
        )
    }

    verifyToken(token) {
        try {
            return jwt.verify(token, process.env.JWT_SECRET);
        } catch(err) {
            if (err.name === 'TokenExpiredError') {
                throw UnauthorizedError('Token expired');
            }
            throw UnauthorizedError('Invalid token');
        }
    }
    
    async getUserById(userId) {
        const user = await User.findByPk(userId, {
            attributes: ['id', 'username', 'email', 'role', 'created_at']
        });

        if (!user) {
            throw NotFoundError('User not found');
        }
        return user;
    }

    async register(email, password, username) {
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
        const token = this.generateToken(userResponse);

        return {
            user: userResponse,
            token
        };
    }

    async getAllUsers() {
        const users = await User.findAll({
            attributes: ['id', 'username', 'email', 'role', 'created_at'],
            order: [['created_at', 'DESC']]
        });
        return users;
    }

    async deleteUser(userId) {
        const result = await User.destroy({
            where: { id: userId }
        });
        
        if (result === 0) {
            throw NotFoundError('User not found');
        }
        
        return result;
    }

    async updateUserRole(userId, role) {
        const [updatedRowsCount] = await User.update(
            { role },
            { where: { id: userId } }
        );
        
        if (updatedRowsCount === 0) {
            throw NotFoundError('User not found');
        }
        
        return await this.getUserById(userId);
    }
}

module.exports = new AuthService();
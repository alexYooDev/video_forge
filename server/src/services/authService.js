const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = requre('../config/database.js');

class AuthService {
    async login(email, password) {
        const users = await db.query('SELECT id, email, password FROM users WHERE email = ?', [email]);
        
        if (users.length === 0) {
            throw new Error('Invalid email or password', 401);
        }

        const user = users[0];

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            throw new Error('Invalid email or passoword', 401);
        }

        const token = this.generateToken({
            id: user.id,
            email: user.email,
        });

        return {
            user: {
                id: user.id,
                email: user.email
            },
            token
        };
    }
    
    generateToken(payload) {
        return jwt.sign(
            payload,
            process.env.JWT_SCRECT,
            {
                expiresIn: '12h',
                issuer: 'Video-Forge-api'
            }
        )
    }

    verifyToken(token) {
        try {
            return jwt.verify(token, process.env.JWT_SECRET);
        } catch(err) {
            if (err.name === 'TokenExpiredError') {
                throw new Error('Token expired', 401);
            }
            throw new Error('Invalid token', 401);
        }
    }
    
    async getUserById(userId) {
        const users = await database.query(
            'SELECT id, email, created_at FROM users WHERE id = ?',
            [userId]
        );

        if (users.length === 0) {
            throw new Error('User not found', 404);
        }
    }

    async register(email, password) {
        const existingUsers = await database.query(
            'SELECT id FROM users WHERE email = ?',
            [email]
        );

        if (existingUsers.length > 0)
        {
            throw new Error('User already exists', 409);
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await db.query(
            'INSERT INTO users (email, password) VALUES (?, ?)',
            [email, hashedPassword]
        );

        const newUser = await this.getUserById(result.insertId);
        const token = this.generateToken({
            id: newUser.id,
            email: newUser.email,
        });

        return {
            user: newUser,
            token
        };
    }
}

module.exports = new AuthService();
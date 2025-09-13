const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const User = sequelize.define('User', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true
    },
    username: {
        type: DataTypes.STRING(255),
        unique: true,
        allowNull: true
    },
    email: {
        type: DataTypes.STRING(255),
        unique: true,
        allowNull: false,
        validate: {
            isEmail: true
        }
    },
    password: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    role: {
        type: DataTypes.ENUM('user', 'admin'),
        defaultValue: 'user',
        allowNull: false
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'users',
    timestamps: false,
    indexes: [
        {
            unique: true,
            fields: ['email']
        },
        {
            unique: true,
            fields: ['username']
        },
        {
            fields: ['role']
        }
    ]
});

module.exports = User;
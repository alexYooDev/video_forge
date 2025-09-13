const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const Job = sequelize.define('Job', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true
    },
    user_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    input_source: {
        type: DataTypes.STRING(1024),
        allowNull: true
    },
    output_format: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    status: {
        type: DataTypes.ENUM('PENDING', 'DOWNLOADING', 'PROCESSING', 'UPLOADING', 'COMPLETED', 'FAILED', 'CANCELLED'),
        defaultValue: 'PENDING',
        allowNull: false
    },
    progress: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    error_text: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'jobs',
    timestamps: false,
    indexes: [
        {
            fields: ['user_id']
        },
        {
            fields: ['status']
        },
        {
            fields: ['created_at']
        }
    ]
});

module.exports = Job;
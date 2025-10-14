const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    return sequelize.define('Job', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true
    },
    user_id: {
        type: DataTypes.STRING,
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
    metadata_s3_key: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    duration: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
    },
    original_size: {
        type: DataTypes.BIGINT,
        allowNull: true
    },
    original_bitrate: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    resolution: {
        type: DataTypes.STRING(20),
        allowNull: true
    },
    video_codec: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    audio_codec: {
        type: DataTypes.STRING(50),
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
};
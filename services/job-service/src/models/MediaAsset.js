const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    return sequelize.define('MediaAsset', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true
    },
    job_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        references: {
            model: 'jobs',
            key: 'id'
        }
    },
    asset_type: {
        type: DataTypes.ENUM('1080p', '720p', '480p', 'GIF', 'THUMBNAIL', 'METADATA_JSON'),
        allowNull: false
    },
    s3_key: {
        type: DataTypes.STRING(1024),
        allowNull: false,
        comment: 'S3 object key or file path'
    },
    file_size: {
        type: DataTypes.BIGINT,
        allowNull: true,
        comment: 'File size in bytes'
    },
    format: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    resolution: {
        type: DataTypes.STRING(20),
        allowNull: true
    },
    duration: {
        type: DataTypes.FLOAT,
        allowNull: true,
        comment: 'Duration in seconds'
    },
    bitrate: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Bitrate in kbps'
    },
    s3_url: {
        type: DataTypes.STRING(1024),
        allowNull: true,
        comment: 'Pre-signed S3 URL'
    },
    metadata: {
        type: DataTypes.JSON,
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
    tableName: 'media_assets',
    timestamps: true,
    indexes: [
        {
            fields: ['job_id']
        },
        {
            fields: ['asset_type']
        }
    ]
    });
};
const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const MediaAsset = sequelize.define('MediaAsset', {
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
        type: DataTypes.ENUM('TRANSCODE_1080', 'TRANSCODE_720', 'TRANSCODE_480', 'GIF', 'THUMBNAIL', 'METADATA_JSON'),
        allowNull: false
    },
    path: {
        type: DataTypes.STRING(1024),
        allowNull: false,
        comment: 'File path or S3 URL'
    },
    size_bytes: {
        type: DataTypes.BIGINT,
        allowNull: true,
        comment: 'File size in bytes'
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'media_assets',
    timestamps: false,
    indexes: [
        {
            fields: ['job_id']
        },
        {
            fields: ['asset_type']
        }
    ]
});

module.exports = MediaAsset;
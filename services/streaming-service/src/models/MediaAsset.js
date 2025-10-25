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
      allowNull: false
    },
    asset_type: {
      type: DataTypes.ENUM('480p', '720p', '1080p', '4K', 'GIF', 'THUMBNAIL', 'METADATA_JSON'),
      allowNull: false
    },
    s3_key: {
      type: DataTypes.STRING(1024),
      allowNull: false
    },
    file_size: {
      type: DataTypes.BIGINT,
      allowNull: true
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
      allowNull: true
    },
    bitrate: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    s3_url: {
      type: DataTypes.STRING(1024),
      allowNull: true
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
    underscored: true
  });
};

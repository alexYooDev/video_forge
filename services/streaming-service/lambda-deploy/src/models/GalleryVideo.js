const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('GalleryVideo', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    user_id: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    job_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
      comment: 'Link to processing job for transcoded assets'
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    s3_key: {
      type: DataTypes.STRING(1024),
      allowNull: false,
      comment: 'Original video S3 key'
    },
    visibility: {
      type: DataTypes.ENUM('public', 'private'),
      defaultValue: 'private'
    },
    status: {
      type: DataTypes.ENUM('uploaded', 'processing', 'ready', 'failed'),
      defaultValue: 'uploaded'
    },
    duration: {
      type: DataTypes.FLOAT,
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
    file_size: {
      type: DataTypes.BIGINT,
      allowNull: true
    },
    thumbnail_url: {
      type: DataTypes.STRING(1024),
      allowNull: true
    },
    views: {
      type: DataTypes.INTEGER,
      defaultValue: 0
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
    tableName: 'gallery_videos',
    timestamps: true,
    underscored: true
  });
};

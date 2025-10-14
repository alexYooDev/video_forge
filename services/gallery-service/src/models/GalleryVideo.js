const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const GalleryVideo = sequelize.define('GalleryVideo', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    user_id: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Cognito user ID'
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
      type: DataTypes.STRING(500),
      allowNull: false,
      comment: 'S3 key where original video is stored'
    },
    visibility: {
      type: DataTypes.ENUM('public', 'private'),
      defaultValue: 'public',
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('uploaded', 'processing', 'ready', 'failed'),
      defaultValue: 'uploaded',
      allowNull: false
    },
    duration: {
      type: DataTypes.FLOAT,
      allowNull: true,
      comment: 'Video duration in seconds'
    },
    resolution: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'e.g., 1920x1080'
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
      allowNull: true,
      comment: 'File size in bytes'
    },
    thumbnail_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'S3 key or URL for video thumbnail'
    },
    views: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false
    }
  }, {
    tableName: 'gallery_videos',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['user_id'] },
      { fields: ['visibility'] },
      { fields: ['status'] },
      { fields: ['created_at'] }
    ]
  });

  return GalleryVideo;
};

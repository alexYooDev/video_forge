const s3Service = require('../services/s3Service');
const { GalleryVideo } = require('../models');
const logger = require('../utils/logger');

class UploadController {
  async generateUploadUrl(req, res) {
    try {
      const { filename, contentType = 'video/mp4' } = req.body;
      const userId = req.user.sub;

      if (!filename) {
        return res.status(400).json({ error: 'Filename is required' });
      }

      const { uploadUrl, s3Key, expiresIn } = await s3Service.generateUploadUrl(
        userId,
        filename,
        contentType
      );

      res.json({
        uploadUrl,
        s3Key,
        expiresIn
      });
    } catch (error) {
      logger.error('Error generating upload URL:', error);
      res.status(500).json({ error: 'Failed to generate upload URL' });
    }
  }

  async confirmUpload(req, res) {
    try {
      const { s3Key, title, description, visibility = 'public' } = req.body;
      const userId = req.user.sub;

      if (!s3Key || !title) {
        return res.status(400).json({ error: 's3Key and title are required' });
      }

      // Verify file exists in S3
      const exists = await s3Service.fileExists(s3Key);
      if (!exists) {
        return res.status(404).json({ error: 'Video file not found in S3' });
      }

      // Create gallery video record
      const video = await GalleryVideo.create({
        user_id: userId,
        title,
        description,
        s3_key: s3Key,
        visibility,
        status: 'uploaded'
      });

      logger.info('Video upload confirmed', { videoId: video.id, userId });

      res.status(201).json({
        id: video.id,
        title: video.title,
        description: video.description,
        s3Key: video.s3_key,
        visibility: video.visibility,
        status: video.status
      });
    } catch (error) {
      logger.error('Error confirming upload:', error);
      res.status(500).json({ error: 'Failed to confirm upload' });
    }
  }
}

module.exports = new UploadController();

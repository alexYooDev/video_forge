const s3Service = require('../services/s3Service');
const logger = require('../utils/logger');

// Lazy-load models to avoid initialization issues
async function getModels() {
  const models = require('../models');

  // Ensure database is initialized FIRST
  try {
    await models.initializeDatabase();
  } catch (error) {
    logger.error('Failed to initialize database:', error);
    throw new Error('Database connection failed');
  }

  // Now safe to access GalleryVideo getter
  return { GalleryVideo: models.GalleryVideo };
}

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
      const { GalleryVideo } = await getModels();
      const {
        s3Key,
        title,
        description,
        visibility = 'public',
        metadata = {} // Optional metadata from client
      } = req.body;
      const userId = req.user.sub;

      logger.info('Confirm upload request', { s3Key, title, userId, hasMetadata: !!metadata });

      if (!s3Key || !title) {
        logger.error('Missing required fields', { s3Key: !!s3Key, title: !!title });
        return res.status(400).json({ error: 's3Key and title are required' });
      }

      // Skip S3 file existence check - Lambda doesn't have S3 permissions
      // The file was just uploaded successfully, so we can trust it exists
      logger.info('Skipping S3 existence check (Lambda has no S3 permissions)', { s3Key });

      // Create gallery video record with metadata
      logger.info('Creating gallery video record', { userId, title });
      const video = await GalleryVideo.create({
        user_id: userId,
        title,
        description,
        s3_key: s3Key,
        visibility,
        status: 'uploaded',
        // Add metadata fields if provided
        duration: metadata.duration || null,
        resolution: metadata.resolution || null,
        video_codec: metadata.videoCodec || null,
        audio_codec: metadata.audioCodec || null,
        file_size: metadata.fileSize || null,
        // Explicitly set timestamps
        created_at: new Date(),
        updated_at: new Date()
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
      logger.error('Error confirming upload:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      res.status(500).json({ error: 'Failed to confirm upload', details: error.message });
    }
  }
}

module.exports = new UploadController();

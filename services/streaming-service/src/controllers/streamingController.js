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

  // Now safe to access model getters
  return { GalleryVideo: models.GalleryVideo, MediaAsset: models.MediaAsset };
}

class StreamingController {
  /**
   * Get available qualities for a video (YouTube-style)
   * GET /api/stream/:videoId/qualities
   */
  async getAvailableQualities(req, res) {
    try {
      const { GalleryVideo, MediaAsset } = await getModels();
      const { videoId } = req.params;
      const userId = req.user?.sub;

      // Get video from gallery
      const video = await GalleryVideo.findByPk(videoId);

      if (!video) {
        return res.status(404).json({ error: 'Video not found' });
      }

      // Check access permissions
      if (video.visibility === 'private' && video.user_id !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Get job_id from video (need to link this)
      if (!video.job_id) {
        // If video hasn't been processed, return original only
        return res.json({
          videoId: video.id,
          qualities: [{
            quality: 'original',
            resolution: video.resolution || 'unknown',
            available: true
          }]
        });
      }

      // Query MediaAssets for this job
      const assets = await MediaAsset.findAll({
        where: {
          job_id: video.job_id,
          asset_type: ['480p', '720p', '1080p', '4K']
        },
        attributes: ['asset_type', 'resolution', 'file_size', 'bitrate', 's3_key']
      });

      // Format like YouTube quality selector
      const qualities = assets.map(asset => ({
        quality: asset.asset_type.toLowerCase(), // '1080p', '720p', etc.
        label: asset.asset_type, // Display label
        resolution: asset.resolution,
        fileSize: asset.file_size,
        bitrate: asset.bitrate,
        available: true
      }));

      // Sort by quality (highest first)
      const qualityOrder = { '4k': 4, '1080p': 3, '720p': 2, '480p': 1 };
      qualities.sort((a, b) => (qualityOrder[b.quality] || 0) - (qualityOrder[a.quality] || 0));

      res.json({
        videoId: video.id,
        title: video.title,
        thumbnail: video.thumbnail_url,
        qualities: qualities
      });

    } catch (error) {
      logger.error('Error getting available qualities:', error);
      res.status(500).json({ error: 'Failed to get available qualities' });
    }
  }

  /**
   * Get stream URL for specific quality (YouTube-style)
   * GET /api/stream/:videoId?quality=720p
   */
  async getStreamUrl(req, res) {
    try {
      const { GalleryVideo, MediaAsset } = await getModels();
      const { videoId } = req.params;
      const { quality = 'auto' } = req.query; // Default to 'auto'
      const userId = req.user?.sub;

      // Get video from gallery
      const video = await GalleryVideo.findByPk(videoId);

      if (!video) {
        return res.status(404).json({ error: 'Video not found' });
      }

      // Check access permissions
      if (video.visibility === 'private' && video.user_id !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      let s3Key;
      let selectedQuality = quality;

      // If video hasn't been processed yet, serve original
      if (!video.job_id) {
        s3Key = video.s3_key;
        selectedQuality = 'original';
      } else {
        // Get processed assets
        const assets = await MediaAsset.findAll({
          where: {
            job_id: video.job_id,
            asset_type: ['480p', '720p', '1080p', '4K']
          },
          attributes: ['asset_type', 's3_key', 'resolution', 'bitrate'],
          order: [['bitrate', 'DESC']]
        });

        if (assets.length === 0) {
          // No processed assets, serve original
          s3Key = video.s3_key;
          selectedQuality = 'original';
        } else if (quality === 'auto') {
          // Auto quality: select best available (highest bitrate)
          s3Key = assets[0].s3_key;
          selectedQuality = assets[0].asset_type.toLowerCase();
        } else {
          // Find requested quality
          const requestedAsset = assets.find(
            a => a.asset_type.toLowerCase() === quality.toLowerCase()
          );

          if (requestedAsset) {
            s3Key = requestedAsset.s3_key;
            selectedQuality = requestedAsset.asset_type.toLowerCase();
          } else {
            // Fallback to closest available quality
            s3Key = assets[0].s3_key;
            selectedQuality = assets[0].asset_type.toLowerCase();
            logger.warn(`Quality ${quality} not available, using ${selectedQuality}`);
          }
        }
      }

      // Generate presigned URL (expires in 1 hour)
      const streamUrl = await s3Service.generateStreamUrl(s3Key, 3600);

      // Increment view count (async, don't wait)
      video.increment('views').catch(err =>
        logger.error('Failed to increment views:', err)
      );

      res.json({
        streamUrl,
        quality: selectedQuality,
        videoId: video.id,
        expiresIn: 3600
      });

    } catch (error) {
      logger.error('Error generating stream URL:', error);
      res.status(500).json({ error: 'Failed to generate stream URL' });
    }
  }

  /**
   * Get thumbnail URL
   * GET /api/stream/:videoId/thumbnail
   */
  async getThumbnailUrl(req, res) {
    try {
      const { GalleryVideo, MediaAsset } = await getModels();
      const { videoId } = req.params;

      const video = await GalleryVideo.findByPk(videoId);

      if (!video) {
        return res.status(404).json({ error: 'Video not found' });
      }

      // Try to get thumbnail from processed assets
      if (video.job_id) {
        const thumbnail = await MediaAsset.findOne({
          where: {
            job_id: video.job_id,
            asset_type: 'THUMBNAIL'
          }
        });

        if (thumbnail) {
          const thumbnailUrl = await s3Service.generateStreamUrl(thumbnail.s3_key, 86400); // 24 hours
          return res.json({ thumbnailUrl });
        }
      }

      // Fallback to video's thumbnail_url
      if (video.thumbnail_url) {
        return res.json({ thumbnailUrl: video.thumbnail_url });
      }

      res.status(404).json({ error: 'Thumbnail not available' });

    } catch (error) {
      logger.error('Error getting thumbnail:', error);
      res.status(500).json({ error: 'Failed to get thumbnail' });
    }
  }

  /**
   * Health check
   */
  async health(req, res) {
    res.json({
      status: 'ok',
      service: 'streaming-service',
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = new StreamingController();

const s3Service = require('../services/s3Service');
const { GalleryVideo } = require('../models');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

class GalleryController {
  async listVideos(req, res) {
    try {
      const { page = 1, limit = 10, search, visibility } = req.query;
      const userId = req.user?.sub;

      const where = {};

      // Filter by visibility
      if (visibility) {
        where.visibility = visibility;
      } else {
        // If not authenticated, only show public videos
        if (!userId) {
          where.visibility = 'public';
        }
      }

      // Search by title or description
      if (search) {
        where[Op.or] = [
          { title: { [Op.iLike]: `%${search}%` } },
          { description: { [Op.iLike]: `%${search}%` } }
        ];
      }

      const offset = (page - 1) * limit;

      const { rows: videos, count } = await GalleryVideo.findAndCountAll({
        where,
        limit: parseInt(limit),
        offset,
        order: [['created_at', 'DESC']]
      });

      res.json({
        videos: videos.map(v => ({
          id: v.id,
          title: v.title,
          description: v.description,
          visibility: v.visibility,
          status: v.status,
          duration: v.duration,
          resolution: v.resolution,
          views: v.views,
          thumbnailUrl: v.thumbnail_url,
          createdAt: v.created_at,
          userId: v.user_id
        })),
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / limit)
        }
      });
    } catch (error) {
      logger.error('Error listing videos:', error);
      res.status(500).json({ error: 'Failed to list videos' });
    }
  }

  async getVideo(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user?.sub;

      const video = await GalleryVideo.findByPk(id);

      if (!video) {
        return res.status(404).json({ error: 'Video not found' });
      }

      // Check visibility permissions
      if (video.visibility === 'private' && video.user_id !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Increment view count
      await video.increment('views');

      res.json({
        id: video.id,
        title: video.title,
        description: video.description,
        visibility: video.visibility,
        status: video.status,
        duration: video.duration,
        resolution: video.resolution,
        videoCodec: video.video_codec,
        audioCodec: video.audio_codec,
        fileSize: video.file_size,
        thumbnailUrl: video.thumbnail_url,
        views: video.views + 1,
        createdAt: video.created_at,
        userId: video.user_id
      });
    } catch (error) {
      logger.error('Error getting video:', error);
      res.status(500).json({ error: 'Failed to get video' });
    }
  }

  async streamVideo(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user?.sub;

      const video = await GalleryVideo.findByPk(id);

      if (!video) {
        return res.status(404).json({ error: 'Video not found' });
      }

      // Check visibility permissions
      if (video.visibility === 'private' && video.user_id !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Generate pre-signed streaming URL
      const streamUrl = await s3Service.generateStreamUrl(video.s3_key);

      res.json({ streamUrl });
    } catch (error) {
      logger.error('Error streaming video:', error);
      res.status(500).json({ error: error.message || 'Failed to generate stream URL' });
    }
  }

  async updateVideo(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.sub;
      const { title, description, visibility } = req.body;

      const video = await GalleryVideo.findByPk(id);

      if (!video) {
        return res.status(404).json({ error: 'Video not found' });
      }

      // Only owner can update
      if (video.user_id !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Update fields
      if (title !== undefined) video.title = title;
      if (description !== undefined) video.description = description;
      if (visibility !== undefined) video.visibility = visibility;

      await video.save();

      logger.info('Video updated', { videoId: video.id, userId });

      res.json({
        id: video.id,
        title: video.title,
        description: video.description,
        visibility: video.visibility
      });
    } catch (error) {
      logger.error('Error updating video:', error);
      res.status(500).json({ error: 'Failed to update video' });
    }
  }

  async deleteVideo(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.sub;

      const video = await GalleryVideo.findByPk(id);

      if (!video) {
        return res.status(404).json({ error: 'Video not found' });
      }

      // Only owner can delete
      if (video.user_id !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      await video.destroy();

      logger.info('Video deleted', { videoId: id, userId });

      res.json({ message: 'Video deleted successfully' });
    } catch (error) {
      logger.error('Error deleting video:', error);
      res.status(500).json({ error: 'Failed to delete video' });
    }
  }
}

module.exports = new GalleryController();

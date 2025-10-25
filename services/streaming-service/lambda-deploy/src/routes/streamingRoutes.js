const express = require('express');
const router = express.Router();
const streamingController = require('../controllers/streamingController');
const { optionalAuth } = require('../middleware/auth');

// Health check
router.get('/health', streamingController.health);

// Get available qualities for a video
router.get('/:videoId/qualities', optionalAuth, streamingController.getAvailableQualities);

// Get stream URL for specific quality
router.get('/:videoId', optionalAuth, streamingController.getStreamUrl);

// Get thumbnail URL
router.get('/:videoId/thumbnail', streamingController.getThumbnailUrl);

module.exports = router;

const express = require('express');
const router = express.Router();
const galleryController = require('../controllers/galleryController');
const { authenticate, optionalAuth } = require('../middleware/auth');

router.get('/videos', optionalAuth, galleryController.listVideos);
router.get('/videos/:id', optionalAuth, galleryController.getVideo);
router.get('/videos/:id/stream', optionalAuth, galleryController.streamVideo);
router.put('/videos/:id', authenticate, galleryController.updateVideo);
router.delete('/videos/:id', authenticate, galleryController.deleteVideo);

module.exports = router;

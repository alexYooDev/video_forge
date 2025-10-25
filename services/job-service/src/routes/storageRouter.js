const express = require('express');
const { requireAuth, authenticate } = require('../middleware/auth');
const storageController = require('../controllers/storageController');

const router = express.Router();

// Upload URL generation (authenticated users)
router.post('/upload-url', authenticate, storageController.generateUploadUrl);

// All other storage routes require admin authentication
router.use(requireAuth('admin'));

// Storage statistics
router.get('/stats', storageController.getStorageStats);

// Storage management actions
router.post('/cleanup-temp', storageController.cleanupTempFiles);
router.post('/optimize', storageController.optimizeStorage);
router.get('/report', storageController.generateStorageReport);

// User-specific usage (optional userId parameter)
router.get('/usage', storageController.getDetailedUsage);
router.get('/usage/:userId', storageController.getDetailedUsage);

module.exports = router;
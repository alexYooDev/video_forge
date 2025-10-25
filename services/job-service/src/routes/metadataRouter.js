const express = require('express');
const { authenticate } = require('../middleware/auth');
const metadataController = require('../controllers/metadataController');

const router = express.Router();

// All metadata routes require authentication
router.use(authenticate);

/**
 * Extract video metadata from S3
 * POST /api/metadata/extract
 * Body: { s3Key: string }
 */
router.post('/extract', metadataController.extractMetadata);

module.exports = router;

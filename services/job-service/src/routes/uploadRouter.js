const express = require('express');
const router = express.Router();
const axios = require('axios');
const s3Service = require('../services/s3Service');
const { apiLogger } = require('../utils/logger');
const { PROXY_EXCLUDED_HEADERS } = require('../utils/constants');

const GALLERY_SERVICE_URL = process.env.GALLERY_SERVICE_URL || 'http://gallery-service.video-forge.local:5000';

/**
 * Generate pre-signed upload URL directly (API Gateway has S3 permissions)
 */
router.post('/generate-url', async (req, res) => {
  try {
    const { filename, contentType = 'video/mp4' } = req.body;
    const userId = req.user?.sub || 'anonymous';

    if (!filename) {
      return res.status(400).json({ error: 'Filename is required' });
    }

    // Generate S3 key with user ID
    const timestamp = Date.now();
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const s3Key = `gallery/${userId}/${timestamp}-${sanitizedFilename}`;

    // Generate pre-signed URL using API Gateway's S3 service (has EC2 permissions)
    const presignedUrl = await s3Service.getPresignedUrl(s3Key, 'putObject', {
      ContentType: contentType
    }, 3600);

    apiLogger.info('Generated upload URL via API Gateway', { s3Key, userId });

    res.json({
      uploadUrl: presignedUrl,
      s3Key,
      expiresIn: 3600
    });
  } catch (error) {
    apiLogger.error('Error generating upload URL:', error);
    res.status(500).json({ error: 'Failed to generate upload URL' });
  }
});

/**
 * Proxy confirm upload to gallery service Lambda
 */
router.post('/confirm', async (req, res) => {
  try {
    const targetUrl = `${GALLERY_SERVICE_URL}/api/upload/confirm`;

    apiLogger.info(`Proxying confirm to gallery service: ${targetUrl}`);

    const response = await axios({
      method: 'POST',
      url: targetUrl,
      data: req.body,
      headers: {
        ...req.headers,
        host: undefined,
      },
      validateStatus: () => true,
    });

    Object.entries(response.headers).forEach(([key, value]) => {
      if (!PROXY_EXCLUDED_HEADERS.includes(key.toLowerCase())) {
        res.set(key, value);
      }
    });

    res.status(response.status).send(response.data);
  } catch (error) {
    apiLogger.error('Gallery service confirm proxy error:', error);
    res.status(503).json({ error: 'Gallery service unavailable' });
  }
});

module.exports = router;

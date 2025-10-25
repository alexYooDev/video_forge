const express = require('express');
const router = express.Router();
const axios = require('axios');
const s3Service = require('../services/s3Service');
const { apiLogger } = require('../utils/logger');
const { PROXY_EXCLUDED_HEADERS } = require('../utils/constants');

const GALLERY_SERVICE_URL = process.env.GALLERY_SERVICE_URL || 'http://gallery-service.video-forge.local:5000';

/**
 * Intercept stream endpoint and generate S3 URL directly (Job Service has S3 permissions)
 */
router.get('/videos/:id/stream', async (req, res) => {
  try {
    const { id } = req.params;

    // First, get the video details from the gallery service Lambda
    const videoResponse = await axios.get(`${GALLERY_SERVICE_URL}/api/gallery/videos/${id}`, {
      headers: {
        ...req.headers,
        host: undefined,
      },
      validateStatus: () => true,
    });

    if (videoResponse.status !== 200) {
      return res.status(videoResponse.status).json(videoResponse.data);
    }

    const video = videoResponse.data;

    // Generate pre-signed S3 URL using job-service's S3 permissions
    const streamUrl = await s3Service.getPresignedUrl(video.s3Key || video.s3_key, 'getObject', {
      ResponseContentType: 'video/mp4',
      ResponseContentDisposition: 'inline'
    }, 3600);

    apiLogger.info('Generated stream URL via Job Service', { videoId: id, s3Key: video.s3Key || video.s3_key });

    res.json({ streamUrl });
  } catch (error) {
    apiLogger.error('Error generating stream URL:', error);
    res.status(500).json({ error: 'Failed to generate stream URL' });
  }
});

/**
 * Proxy all other gallery requests to gallery service (ECS or Lambda)
 */
router.use(async (req, res) => {
  try {
    const targetUrl = `${GALLERY_SERVICE_URL}/api/gallery${req.path}`;

    apiLogger.info(`Proxying ${req.method} ${req.path} to gallery service: ${targetUrl}`);

    const response = await axios({
      method: req.method,
      url: targetUrl,
      params: req.query,
      data: req.body,
      headers: {
        ...req.headers,
        host: undefined, // Remove original host header
      },
      validateStatus: () => true, // Don't throw on any status
    });

    // Forward response headers (exclude CORS, security, and Lambda-specific headers)
    Object.entries(response.headers).forEach(([key, value]) => {
      if (!PROXY_EXCLUDED_HEADERS.includes(key.toLowerCase())) {
        res.set(key, value);
      }
    });

    // Forward status and body
    res.status(response.status).send(response.data);

  } catch (error) {
    apiLogger.error('Gallery service proxy error:', error);
    res.status(503).json({ error: 'Gallery service unavailable' });
  }
});

module.exports = router;

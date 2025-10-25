const express = require('express');
const router = express.Router();
const axios = require('axios');
const { apiLogger } = require('../utils/logger');
const { PROXY_EXCLUDED_HEADERS } = require('../utils/constants');

const STREAMING_SERVICE_URL = process.env.STREAMING_SERVICE_URL || 'http://streaming-service.video-forge.local:5001';

/**
 * Proxy all streaming requests to streaming service (ECS or Lambda)
 */
router.use(async (req, res) => {
  try {
    const targetUrl = `${STREAMING_SERVICE_URL}/api/stream${req.path}`;

    apiLogger.info(`Proxying ${req.method} ${req.path} to streaming service: ${targetUrl}`);

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
    apiLogger.error('Streaming service proxy error:', error);
    res.status(503).json({ error: 'Streaming service unavailable' });
  }
});

module.exports = router;

// Express app for Lambda (no server.listen())
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const logger = require('./utils/logger');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// API Gateway path fix: prepend base path if missing
// API Gateway strips /api/gallery or /api/upload from path when using /{proxy+}
app.use((req, res, next) => {
  const originalPath = req.path;

  if (!req.path.startsWith('/api/') && req.path !== '/health') {
    // Determine which base path to prepend based on the route
    // Upload routes: /generate-url, /confirm
    if (req.path.startsWith('/generate-url') || req.path.startsWith('/confirm')) {
      req.url = '/api/upload' + req.url;
    } else {
      // All other routes go to gallery
      req.url = '/api/gallery' + req.url;
    }
    logger.info(`Path adjusted: ${originalPath} -> ${req.url}`);
  }
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'gallery-service', runtime: 'lambda' });
});

// Routes
app.use('/api/gallery', require('./routes/galleryRoutes'));
app.use('/api/upload', require('./routes/uploadRoutes'));

// Error handling
app.use((err, req, res, next) => {
  logger.error(err.message, { stack: err.stack });
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Export for Lambda
module.exports = app;

// For local development
if (require.main === module) {
  const { initializeDatabase } = require('./models');
  const PORT = process.env.PORT || 5000;

  initializeDatabase().then(() => {
    app.listen(PORT, () => {
      logger.info(`Gallery service running on port ${PORT}`);
    });
  }).catch(error => {
    logger.error('Failed to start server:', error);
    process.exit(1);
  });
}

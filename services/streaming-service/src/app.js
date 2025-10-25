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
// API Gateway strips /api/stream from path when using /{proxy+}
app.use((req, res, next) => {
  if (!req.path.startsWith('/api/') && req.path !== '/health') {
    req.url = '/api/stream' + req.url;
    logger.info(`Path adjusted to: ${req.url}`);
  }
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'streaming-service',
    runtime: 'lambda',
    timestamp: new Date().toISOString()
  });
});

// Routes
app.use('/api/stream', require('./routes/streamingRoutes'));

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
  const PORT = process.env.PORT || 5001;

  initializeDatabase().then(() => {
    app.listen(PORT, () => {
      logger.info(`Streaming service running on port ${PORT}`);
    });
  }).catch(error => {
    logger.error('Failed to start server:', error);
    process.exit(1);
  });
}

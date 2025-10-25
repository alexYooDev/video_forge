const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const awsConfig = require('./awsConfig');
const { apiLogger } = require('../utils/logger');

const authRouter = require('../routes/authRouter');
const jobsRouter = require('../routes/jobsRouter');
const storageRouter = require('../routes/storageRouter');
const galleryRouter = require('../routes/galleryRouter');
const uploadRouter = require('../routes/uploadRouter');
const streamingRouter = require('../routes/streamingRouter');
const metadataRouter = require('../routes/metadataRouter');
const errorHandler = require('../middleware/errorHandler');

require('dotenv').config();

class App {
    constructor () {
        this.app = express();
        this.config = null;
        this.PORT = parseInt(process.env.SERVER_PORT || '8000');
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;

        this.config = await awsConfig.getEnvironmentConfig();
        this.PORT = this.config.server.port;

        this.setupMiddleware();
        this.setupRoutes();
        this.initialized = true;
    }

    setupMiddleware() {
      this.app.use(helmet());

      this.app.use(
        cors({
          origin: true, // Allow all origins for API Gateway compatibility
          credentials: true,
          methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
          allowedHeaders: ['Content-Type', 'Authorization', 'x-requested-with', 'cache-control']
        })
      );

      // body parsing
      this.app.use(express.json());
      this.app.use(express.urlencoded({ extended: true }));

      // Request Logging => log monitoring and debugging
      this.app.use(
        morgan('combined', {
          stream: { write: (message) => apiLogger.api(message.trim()) },
        })
      );
    }

    setupRoutes() {
      this.app.use('/api/auth', authRouter);
      this.app.use('/api/jobs', jobsRouter);
      this.app.use('/api/storage', storageRouter);
      this.app.use('/api/metadata', metadataRouter);

      // Lambda proxy routes
      this.app.use('/api/gallery', galleryRouter);
      this.app.use('/api/upload', uploadRouter);
      this.app.use('/api/stream', streamingRouter);

      // Health check endpoint
      this.app.get('/api/health', (_req, res) => {
        res.status(200).json({ status: 'OK', timestamp: new Date().toISOString(), service: 'job-service' });
      });

      // Global error handler (must be last)
      this.app.use(errorHandler);
    }

    async start() {
        await this.initialize();

        this.app.listen(this.PORT, '0.0.0.0', () => {
            const serverUrl = `http://${this.config.server.host}:${this.PORT}`;
            apiLogger.system('Job Service running', { url: serverUrl, environment: this.config.environment });
        })
    }

    getApp() {
        return this.app;
    }
}

module.exports = App;
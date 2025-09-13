const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const awsConfig = require('./awsConfig');

require('dotenv').config();

class App {
    constructor () {
        this.app = express();
        this.config = awsConfig.getEnvironmentConfig();
        this.PORT = this.config.server.port;

        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
      this.app.use(helmet());

      this.app.use(
        cors({
          origin: awsConfig.getCorsOrigins(),
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
          stream: { write: (message) => console.log(message.trim()) },
        })
      );
    }

    setupRoutes() {
      const authRouter = require('../routes/authRouter');
      const jobsRouter = require('../routes/jobsRouter');
      const errorHandler = require('../middleware/errorHandler');

      this.app.use('/api/auth', authRouter);
      this.app.use('/api/jobs', jobsRouter);
      
      // Health check endpoint
      this.app.get('/api/health', (_req, res) => {
        res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
      });

      // Global error handler (must be last)
      this.app.use(errorHandler);
    }

    start() {
        this.app.listen(this.PORT, '0.0.0.0', () => {
            const serverUrl = `http://${this.config.server.host}:${this.PORT}`;
            console.log(`Server running on ${serverUrl}`);
            console.log(`Environment: ${this.config.environment}`);
        })
    }

    getApp() {
        return this.app;
    }
}

module.exports = App;
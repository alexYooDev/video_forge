const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');

require('dotenv').config();

class App {
    constructor () {
        this.app = express();
        this.PORT = process.env.PORT || 8000;

        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
      this.app.use(helmet());

      this.app.use(
        cors({
          origin: [
            `http://${process.env.CLIENT_HOST || 'localhost'}:3000`,
            `http://${process.env.CLIENT_HOST || 'localhost'}:80`,
            'http://localhost:3000',
            'http://localhost:80'
          ],
          credentials: true,
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

      this.app.use('/api/auth', authRouter);
      this.app.use('/api/jobs', jobsRouter);
      
      // Health check endpoint
      this.app.get('/api/health', (req, res) => {
        res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
      });
    }

    start() {
        this.app.listen(this.PORT, '0.0.0.0', () => {
            console.log(`Server running on port ${process.env.APP_BASE_URL}:${this.PORT}`);
        })
    }

    getApp() {
        return this.app;
    }
}

module.exports = App;
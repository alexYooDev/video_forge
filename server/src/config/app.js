const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');

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
          origin:
            process.env.NODE_ENV === 'production'
              ? [''] // production url
              : ['http://localhost:3000'], // React client url
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
        this.app.use('/api', (req, res) => {
            res.status(200).json({
                success: true,
                mesage: 'Video Forge API v1.0',
                endpoints: {
                    auth: '/api/auth',
                    jobs: '/api/jobs',
                    videos: '/api/videos'
                }
            });
        });
    }

    start() {
        this.app.listen(this.PORT, () => {
            console.log(`Server running on port http://localhost:${this.PORT}`);
        })
    }

    getApp() {
        return this.app;
    }
}

module.exports = App;
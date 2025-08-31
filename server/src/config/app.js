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
          origin:
            process.env.NODE_ENV === 'production'
              ? ['http://13.210.68.108:3000'] // production url
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
      const authRouter = require('../routes/authRouter');
      const jobsRouter = require('../routes/jobsRouter');

      this.app.use('/api/auth', authRouter);
      this.app.use('/api/jobs', jobsRouter)
    }

    start() {
        this.app.listen(this.PORT, () => {
            console.log(`Server running on port ${process.env.APP_BASE_URL}:${this.PORT}`);
        })
    }

    getApp() {
        return this.app;
    }
}

module.exports = App;
// Lambda handler for Streaming Service
// Converts Express routes to Lambda-compatible handlers
const awsServerlessExpress = require('aws-serverless-express');
const app = require('./src/app');
const { initializeDatabase } = require('./src/models');

const server = awsServerlessExpress.createServer(app);

// Initialize database connection lazily
let dbInitPromise = null;

exports.handler = async (event, context) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  // Skip DB initialization for health checks
  const isHealthCheck = event.path === '/health' || event.rawPath === '/health';

  if (!isHealthCheck && !dbInitPromise) {
    // Initialize database lazily on first real request (not health check)
    dbInitPromise = initializeDatabase()
      .then(() => {
        console.log('Database initialized successfully');
        return true;
      })
      .catch(error => {
        console.error('Database initialization failed:', error);
        dbInitPromise = null; // Reset to allow retry
        return false;
      });
  }

  return awsServerlessExpress.proxy(server, event, context, 'PROMISE').promise;
};

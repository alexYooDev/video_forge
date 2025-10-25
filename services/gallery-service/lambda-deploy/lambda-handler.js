// Lambda handler for Gallery Service
// Converts Express routes to Lambda-compatible handlers
const serverlessExpress = require('@vendia/serverless-express');
const app = require('./src/app');
const { initializeDatabase } = require('./src/models');

// Initialize database connection lazily
let dbInitPromise = null;

// Create the handler
const handler = serverlessExpress({ app });

// Wrap it to handle DB initialization
exports.handler = async (event, context) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  // Skip DB initialization for health checks
  const path = event.rawPath || event.path || (event.requestContext && event.requestContext.http && event.requestContext.http.path) || '';
  const isHealthCheck = path === '/health' || path.includes('/health');

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

  // Wait for database initialization before processing request
  if (!isHealthCheck && dbInitPromise) {
    await dbInitPromise;
  }

  // Call the serverless express handler
  return handler(event, context);
};

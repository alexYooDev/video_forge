// Load environment variables
const path = require('path');
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development';
require('dotenv').config({ path: path.join(__dirname, '../../../', envFile) });

const express = require('express');
const cors = require('cors');
const awsConfig = require('./config/awsConfig');
const adminRoutes = require('./routes/adminRoutes');

const app = express();
const PORT = process.env.PORT || 11434;

// Middleware
app.use(
  cors({
    origin: true, // Allow all origins for API Gateway compatibility
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-requested-with', 'cache-control']
  })
);
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'admin-dashboard-api',
    timestamp: new Date().toISOString()
  });
});

// Admin API routes (mounted at /api/admin to match ALB routing)
app.use('/api/admin', adminRoutes);

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.statusCode || 500).json({
    error: err.message || 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

async function startServer() {
  try {
    console.log('Starting Admin Dashboard API');

    // Load AWS configuration
    if (process.env.NODE_ENV === 'production' || process.env.AWS_ACCESS_KEY_ID || process.env.AWS_PROFILE) {
      try {
        console.log('Loading configuration from AWS Parameter Store and Secrets Manager');
        const config = await awsConfig.loadConfiguration();
        awsConfig.applyToEnvironment(config);
        console.log('AWS configuration loaded successfully');
      } catch (error) {
        console.warn('AWS configuration failed, using local environment:', error.message);
      }
    } else {
      console.log('Using local environment configuration');
    }

    app.listen(PORT, () => {
      console.log(`Admin Dashboard API listening on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
      console.log(`API endpoints: http://localhost:${PORT}/api/*`);
    });
  } catch (error) {
    console.error('Failed to start Admin Dashboard API:', error);
    process.exit(1);
  }
}

// Only start if this is the main module
if (require.main === module) {
  startServer();
}

module.exports = app;

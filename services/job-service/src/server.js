// Load environment variables based on NODE_ENV
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development';
require('dotenv').config({ path: `../../${envFile}` });

// Load AWS configuration if available (fallback to local env)
const awsConfig = require('./config/awsConfig');
const { apiLogger } = require('./utils/logger');

const App = require('./config/app');
const { initDatabase } = require('./models/index');
const jobService = require('./services/jobService');
const cacheService = require('./services/cacheService');
const cognitoService = require('./services/cognitoService');

async function startServer () {
    try {
        apiLogger.system('Starting API Gateway');

        // Load AWS configuration if in production, if AWS credentials are available, or if AWS SSO is configured
        if (process.env.NODE_ENV === 'production' || process.env.AWS_ACCESS_KEY_ID || process.env.AWS_PROFILE) {
            try {
                apiLogger.system('Attempting to load configuration from AWS');
                const config = await awsConfig.loadConfiguration();
                awsConfig.applyToEnvironment(config);
                apiLogger.system('AWS configuration loaded successfully');
            } catch (error) {
                apiLogger.warn('AWS configuration failed, using local environment', { error: error.message });
            }
        } else {
            apiLogger.system('Using local environment configuration');
        }

        // Initialize PostgreSQL database
        await initDatabase();

        // Update service configurations with AWS values
        apiLogger.system('Updating service configurations with AWS values');
        jobService.updateConfig();
        cacheService.updateConfig();

        // Initialize Cognito service for token verification
        apiLogger.system('Initializing Cognito service');
        await cognitoService.initialize();

        // Initialize cache service
        apiLogger.system('Initializing cache service');
        await cacheService.connect();

        const app = new App();
        await app.start();

        process.on('SIGTERM', async () => {
            apiLogger.system('Signal terminated, shutting down API Gateway');
            process.exit(0);
        });

        process.on('SIGINT', async() => {
            apiLogger.system('Signal interrupted, shutting down API Gateway');
            process.exit(0);
        })
    } catch(err) {
        apiLogger.systemError('Failed to start API Gateway', err);
    }
}

/* Only start the server via this module */
if (require.main === module) {
    startServer();
}

module.exports = { startServer }
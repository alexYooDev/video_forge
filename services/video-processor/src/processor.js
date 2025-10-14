// Load environment variables based on NODE_ENV
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development';
require('dotenv').config({ path: `../../${envFile}` });

// Load AWS configuration if available (fallback to local env)
const awsConfig = require('./config/awsConfig');
const { processorLogger } = require('./utils/logger');

const { initDatabase } = require('./models/index');
const sqsPollingService = require('./services/sqsPollingService');
const videoProcessingService = require('./services/videoProcessingService');

async function startProcessor() {
    try {
        processorLogger.system('Starting Video Processing Service');

        // Load AWS configuration if in production, if AWS credentials are available, or if AWS SSO is configured
        if (process.env.NODE_ENV === 'production' || process.env.AWS_ACCESS_KEY_ID || process.env.AWS_PROFILE) {
            try {
                processorLogger.system('Attempting to load configuration from AWS');
                const config = await awsConfig.loadConfiguration();
                awsConfig.applyToEnvironment(config);
                processorLogger.system('AWS configuration loaded successfully');
            } catch (error) {
                processorLogger.warn('AWS configuration failed, using local environment', { error: error.message });
            }
        } else {
            processorLogger.system('Using local environment configuration');
        }

        // Initialize PostgreSQL database
        await initDatabase();

        // Set up the processing function for SQS polling
        sqsPollingService.setProcessingFunction(async (jobData) => {
            processorLogger.job('Processing job from queue', { jobId: jobData.jobId });
            await videoProcessingService.processJob(jobData);
        });

        // Start SQS polling
        await sqsPollingService.startPolling();

        processorLogger.system('Video Processing Service is running and polling for jobs');

        // Graceful shutdown handlers
        process.on('SIGTERM', async () => {
            processorLogger.system('Signal terminated, shutting down Video Processing Service');
            await sqsPollingService.stopPolling();
            process.exit(0);
        });

        process.on('SIGINT', async() => {
            processorLogger.system('Signal interrupted, shutting down Video Processing Service');
            await sqsPollingService.stopPolling();
            process.exit(0);
        });

        // Keep the process alive
        process.on('uncaughtException', (error) => {
            processorLogger.systemError('Uncaught Exception', error);
            process.exit(1);
        });

        process.on('unhandledRejection', (reason, promise) => {
            processorLogger.error('Unhandled Rejection', reason, { promise: String(promise) });
            process.exit(1);
        });

    } catch(err) {
        processorLogger.systemError('Failed to start Video Processing Service', err);
        process.exit(1);
    }
}

/* Only start the processor via this module */
if (require.main === module) {
    startProcessor();
}

module.exports = { startProcessor };
// Load environment variables based on NODE_ENV
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development';
require('dotenv').config({ path: `../${envFile}` });

// Load AWS configuration if available (fallback to local env)
const awsConfig = require('./config/awsConfig');

const App = require('./config/app');
const { initDatabase } = require('./models/index');
const jobService = require('./services/jobService');
const cacheService = require('./services/cacheService');

async function startServer () {
    try {
        // Load AWS configuration if in production, if AWS credentials are available, or if AWS SSO is configured
        if (process.env.NODE_ENV === 'production' || process.env.AWS_ACCESS_KEY_ID || process.env.AWS_PROFILE) {
            try {
                console.log('Attempting to load configuration from AWS...');
                const config = await awsConfig.loadConfiguration();
                awsConfig.applyToEnvironment(config);
                console.log('AWS configuration loaded successfully');
            } catch (error) {
                console.warn('AWS configuration failed, using local environment:', error.message);
            }
        } else {
            console.log('Using local environment configuration');
        }

        // Initialize PostgreSQL database
        await initDatabase();

        // Update service configurations with AWS values
        console.log('Updating service configurations with AWS values...');
        jobService.updateConfig();
        cacheService.updateConfig();

        // Initialize cache service
        console.log('Initializing cache service...');
        await cacheService.connect();

        // Resume any stuck jobs from previous sessions
        await jobService.resumeStuckJobs();
        
        const app = new App();
        await app.start();

        process.on('SIGTERM', async () => {
            console.log('Signal terminated. shutting the server down...');
            await database.close();
            process.exit(0);
        });

        process.on('SIGINT', async() => {
            console.log('Signal interrupted. Shutting the server down...');
            await database.close();
            process.exit(0);
        })
    } catch(err) {
        console.error('Failed to start server:', err.message);
    }
}

/* Only start the server via this module */
if (require.main === module) {
    startServer();
}

module.exports = { startServer }

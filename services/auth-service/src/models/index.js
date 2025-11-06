const { createSequelizeInstance, reinitializeWithAWSConfig, getCurrentSequelize } = require('../config/sequelize');

// Models will be initialized after sequelize is ready
let User, Job, MediaAsset, sequelize;
let modelsInitialized = false;

// Initialize models and associations
const initializeModels = (sequelizeInstance) => {
    if (modelsInitialized) return { User, Job, MediaAsset, sequelize };

    sequelize = sequelizeInstance;

    // Import and initialize models with the sequelize instance
    const UserFactory = require('./User');
    const JobFactory = require('./Job');
    const MediaAssetFactory = require('./MediaAsset');

    User = UserFactory(sequelize);
    Job = JobFactory(sequelize);
    MediaAsset = MediaAssetFactory(sequelize);

    // Define associations
    User.hasMany(Job, {
        foreignKey: 'user_id',
        as: 'jobs'
    });

    Job.belongsTo(User, {
        foreignKey: 'user_id',
        as: 'user'
    });

    Job.hasMany(MediaAsset, {
        foreignKey: 'job_id',
        as: 'assets',
        onDelete: 'CASCADE'
    });

    MediaAsset.belongsTo(Job, {
        foreignKey: 'job_id',
        as: 'job'
    });

    modelsInitialized = true;
    return { User, Job, MediaAsset, sequelize };
};

// Function to get current models with fresh connection
const getCurrentModels = () => {
    return { User, Job, MediaAsset, sequelize: getCurrentSequelize() };
};

// Database initialization function
const initDatabase = async () => {
    try {
        console.log('Creating Sequelize instance with AWS configuration...');
        const awsSequelize = await createSequelizeInstance();

        console.log('Testing PostgreSQL connection...');
        await awsSequelize.authenticate();
        console.log('PostgreSQL connection established successfully.');

        // Initialize models with the sequelize instance
        console.log('Initializing models and associations...');
        const models = initializeModels(awsSequelize);

        console.log('Models initialized with database connection.');

        // Sync models with database (create tables if they don't exist)
        // Use { force: false } to avoid dropping existing tables
        console.log('Syncing database models...');
        await awsSequelize.sync({ force: false });
        console.log('Database models synced successfully.');

        return awsSequelize;
    } catch (error) {
        console.error('Database initialization failed:', error);
        throw error;
    }
};

module.exports = {
    initDatabase,
    getCurrentModels
};
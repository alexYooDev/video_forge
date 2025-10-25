const { Sequelize } = require('sequelize');
const awsConfig = require('./awsConfig');

let sequelize = null;
let currentSequelize = null;

const createSequelizeInstance = async () => {
    if (sequelize) return sequelize;

    console.log('Creating Sequelize instance...');
    const dbConfig = await awsConfig.getDatabaseConfig();

    sequelize = new Sequelize({
        ...dbConfig,
        schema: dbConfig.username || 's458',
        define: {
            freezeTableName: true,
            underscored: false,
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    });

    currentSequelize = sequelize;
    return sequelize;
};


// Re-initialize with AWS config later
const reinitializeWithAWSConfig = async () => {
    if (!sequelize) {
        return await createSequelizeInstance();
    }

    try {
        await sequelize.close();
        sequelize = null;
        const newInstance = await createSequelizeInstance();
        currentSequelize = newInstance;
        return newInstance;
    } catch (error) {
        console.warn('Error closing previous sequelize connection:', error.message);
        sequelize = null;
        const newInstance = await createSequelizeInstance();
        currentSequelize = newInstance;
        return newInstance;
    }
};

// Function to get current sequelize instance
const getCurrentSequelize = () => currentSequelize || sequelize;

// Export functions
module.exports = {
    createSequelizeInstance,
    reinitializeWithAWSConfig,
    getCurrentSequelize
};
const { Sequelize } = require('sequelize');
const logger = require('../utils/logger');
const { getDatabaseCredentials } = require('../config/secrets');

let sequelize;
let dbInitialized = false;

/**
 * Initialize database connection with credentials from Secrets Manager
 */
async function initializeDatabase() {
  if (dbInitialized && sequelize) {
    return sequelize;
  }

  try {
    // Fetch database password from Secrets Manager
    const credentials = await getDatabaseCredentials();

    sequelize = new Sequelize(
      process.env.DB_NAME,
      process.env.DB_USER,
      credentials.password,
      {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 5432,
        dialect: 'postgres',
        logging: msg => logger.debug(msg),
        define: {
          schema: 's458'
        },
        pool: {
          max: 5,
          min: 0,
          acquire: 30000,
          idle: 10000
        }
      }
    );

    // Test the connection
    await sequelize.authenticate();
    logger.info('Database connection established successfully');

    dbInitialized = true;
    return sequelize;
  } catch (error) {
    logger.error('Unable to connect to database:', error);
    throw error;
  }
}

// Import models (will be initialized after DB connection)
const GalleryVideo = require('./GalleryVideo');

// Export
module.exports = {
  initializeDatabase,
  get sequelize() {
    if (!sequelize) {
      throw new Error('Database not initialized. Call initializeDatabase() first.');
    }
    return sequelize;
  },
  get GalleryVideo() {
    if (!sequelize) {
      throw new Error('Database not initialized. Call initializeDatabase() first.');
    }
    return GalleryVideo(sequelize);
  }
};

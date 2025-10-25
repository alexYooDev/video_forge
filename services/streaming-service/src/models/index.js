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

    sequelize = new Sequelize({
      dialect: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'videoforge',
      username: process.env.DB_USER || 'postgres',
      password: credentials.password,
      logging: process.env.NODE_ENV === 'development' ? console.log : false,
      define: {
        schema: 's458'
      },
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
      }
    });

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

// Import models
const GalleryVideo = require('./GalleryVideo');
const MediaAsset = require('./MediaAsset');

/**
 * Define model associations after database initialization
 */
function defineAssociations() {
  const GalleryVideoModel = GalleryVideo(sequelize);
  const MediaAssetModel = MediaAsset(sequelize);

  GalleryVideoModel.hasMany(MediaAssetModel, {
    foreignKey: 'job_id',
    sourceKey: 'job_id',
    as: 'assets'
  });

  MediaAssetModel.belongsTo(GalleryVideoModel, {
    foreignKey: 'job_id',
    targetKey: 'job_id',
    as: 'video'
  });

  return { GalleryVideoModel, MediaAssetModel };
}

module.exports = {
  initializeDatabase,
  defineAssociations,
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
  },
  get MediaAsset() {
    if (!sequelize) {
      throw new Error('Database not initialized. Call initializeDatabase() first.');
    }
    return MediaAsset(sequelize);
  }
};

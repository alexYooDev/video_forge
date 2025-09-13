const sequelize = require('../config/sequelize');
const User = require('./User');
const Job = require('./Job');
const MediaAsset = require('./MediaAsset');

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

// Database initialization function
const initDatabase = async () => {
    try {
        console.log('Testing PostgreSQL connection...');
        await sequelize.authenticate();
        console.log('PostgreSQL connection established successfully.');

        // Sync models with database (create tables if they don't exist)
        // Use { force: false } to avoid dropping existing tables
        console.log('Syncing database models...');
        await sequelize.sync({ force: false });
        console.log('Database models synced successfully.');

        return sequelize;
    } catch (error) {
        console.error('Database initialization failed:', error);
        throw error;
    }
};

module.exports = {
    sequelize,
    User,
    Job,
    MediaAsset,
    initDatabase
};
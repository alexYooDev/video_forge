const { Sequelize } = require('sequelize');
const awsConfig = require('./awsConfig');

const dbConfig = awsConfig.getDatabaseConfig();

const sequelize = new Sequelize({
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

module.exports = sequelize;
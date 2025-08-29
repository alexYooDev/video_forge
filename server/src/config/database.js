const mysql = require('mysql2/promise');
require('dotenv').config();

class Database {
    constructor() {
        this.connection = null;
    }

    async connect () {
        try {
          this.connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || 'Free200209!',
            database: process.env.DB_NAME || 'video_transcoder',
          });

          console.log('Database connected successfully');
          return this.connection;
        } catch (error) {
          console.error('Database connection failed:', error.message);
          throw error;
        }
    }

    async query (sql, params) {
        try {
          const [rows] = await this.connection.execute(sql, params);
          return rows;
        } catch (error) {
          console.error('Database query failed:', error.message);
          throw error;
        }
    }

    async close () {
        if (this.connection) {
            await this.connection.end();
            console.log('Database connection closed.');
        }
    }
}

module.exports = new Database();
const mysql = require('mysql2/promise');
require('dotenv').config();

class Database {
  constructor() {
    this.pool = null;
    this.isInitialized = false;
  }

  async connect() {
    if (this.isInitialized && this.pool) {
      console.log('Database pool already initialized');
      return this.pool;
    }

    try {
      console.log('🏊 Creating MySQL connection pool...');

      this.pool = mysql.createPool({
        // Basic connection settings
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || 'video_forge',

        // Pool configuration
        keepAliveInitialDelay: 10000, // 0 by default.
        enableKeepAlive: true, // false by default.
      });

      console.log('MySQL connection pool created successfully');

      this.isInitialized = true;

      // Add pool event listeners for monitoring
      this.pool.on('connection', (connection) => {
        console.log(`New connection established ${connection.threadId}`);
      });

      this.pool.on('error', (err) => {
        console.error('Pool error:', err.code);
      });

      return this.pool;
    } catch (error) {
      console.error('Failed to create connection pool:', error.message);
      throw error;
    }
  }

  async query(sql, params = []) {
    try {
      // Ensure pool is initialized
      if (!this.pool || !this.isInitialized) {
        await this.connect();
      }

      // Execute query using pool (automatically handles connection management)
      const [rows, fields] = await this.pool.execute(sql, params);


      return rows;
    } catch (error) {
      console.error('Database query failed:', error.message);
      console.error('SQL:', sql);
      console.error('Params:', params);

      // Re-throw the error for handling by calling code
      throw error;
    }
  }

  // For transactions - gets a dedicated connection
  async getConnection() {
    try {
      if (!this.pool || !this.isInitialized) {
        await this.connect();
      }

      return await this.pool.getConnection();
    } catch (error) {
      console.error('Failed to get connection from pool:', error.message);
      throw error;
    }
  }

  // Execute transaction with automatic connection management
  async transaction(callback) {
    let connection;

    try {
      connection = await this.getConnection();

      // Start transaction
      await connection.beginTransaction();

      // Execute callback with connection
      const result = await callback(connection);

      // Commit if successful
      await connection.commit();

      return result;
    } catch (error) {
      // Rollback on error
      if (connection) {
        try {
          await connection.rollback();
          console.log('Transaction rolled back');
        } catch (rollbackError) {
          console.error('Rollback failed:', rollbackError.message);
        }
      }

      throw error;
    } finally {
      // Always release connection back to pool
      if (connection) {
        connection.release();
      }
    }
  }

  async close() {
    if (this.pool) {
      try {
        console.log('Closing connection pool...');
        await this.pool.end();
        console.log('Connection pool closed successfully');
      } catch (error) {
        console.error('Error closing connection pool:', error.message);
      } finally {
        this.pool = null;
        this.isInitialized = false;
      }
    }
  }
}

module.exports = new Database();
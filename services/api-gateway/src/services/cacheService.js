const redis = require('redis');

class CacheService {
    constructor() {
        this.client = null;
        this.isConnected = false;
        this.config = {
            host: 'localhost', // Will be updated after AWS config loads
            port: 6379,
            password: null,
            retryDelayOnFailover: 100,
            enableReadyCheck: true,
            maxRetriesPerRequest: null,
        };

        // Cache TTL settings (in seconds)
        this.ttl = {
            jobStatus: 30,           // Job status and progress - 30 seconds
            userProfile: 900,        // User profile data - 15 minutes
            userStats: 300,          // User statistics - 5 minutes
            assetMetadata: 3600,     // Asset metadata - 1 hour
            externalAPI: 1800,       // External API responses - 30 minutes
            adminStats: 120,         // Admin dashboard stats - 2 minutes
            processingQueue: 60,     // Processing queue status - 1 minute
            default: 300             // Default TTL - 5 minutes
        };

        // Don't auto-connect in constructor, wait for config update
    }

    // Update configuration with AWS values
    updateConfig() {
        this.config.host = process.env.REDIS_HOST || 'localhost';
        this.config.port = parseInt(process.env.REDIS_PORT || '6379');
        this.config.password = process.env.REDIS_PASSWORD || null;
        console.log(`Cache service config updated: ${this.config.host}:${this.config.port}`);
    }

    async connect() {
        try {
            if (!process.env.CACHE_ENABLED || process.env.CACHE_ENABLED === 'false') {
                console.log('Cache disabled via CACHE_ENABLED environment variable');
                return;
            }

            console.log('Connecting to Redis cache...');
            this.client = redis.createClient({
                socket: {
                    host: this.config.host,
                    port: this.config.port,
                    connectTimeout: 2000
                },
                password: this.config.password
            });

            this.client.on('error', (err) => {
                console.error('Redis Client Error:', err);
                this.isConnected = false;
            });

            this.client.on('connect', () => {
                console.log('Redis client connected');
                this.isConnected = true;
            });

            this.client.on('ready', () => {
                console.log('Redis client ready');
                this.isConnected = true;
            });

            this.client.on('end', () => {
                console.log('Redis client connection ended');
                this.isConnected = false;
            });

            await this.client.connect();
            console.log('✅ Redis cache service initialized successfully');

        } catch (error) {
            console.error('❌ Failed to connect to Redis cache:', error.message);
            console.log('📝 Cache will be disabled - application will continue without caching');
            this.isConnected = false;
        }
    }

    // Generic cache operations
    async get(key) {
        if (!this.isConnected || !this.client) {
            return null;
        }

        try {
            const value = await this.client.get(key);
            if (value) {
                console.log(`🎯 Cache HIT: ${key}`);
                return JSON.parse(value);
            }
            console.log(`❌ Cache MISS: ${key}`);
            return null;
        } catch (error) {
            console.error(`Cache GET error for key ${key}:`, error.message);
            return null;
        }
    }

    async set(key, value, ttlSeconds = this.ttl.default) {
        if (!this.isConnected || !this.client) {
            return false;
        }

        try {
            await this.client.setEx(key, ttlSeconds, JSON.stringify(value));
            console.log(`💾 Cache SET: ${key} (TTL: ${ttlSeconds}s)`);
            return true;
        } catch (error) {
            console.error(`Cache SET error for key ${key}:`, error.message);
            return false;
        }
    }

    async del(key) {
        if (!this.isConnected || !this.client) {
            return false;
        }

        try {
            await this.client.del(key);
            console.log(`🗑️ Cache DELETE: ${key}`);
            return true;
        } catch (error) {
            console.error(`Cache DELETE error for key ${key}:`, error.message);
            return false;
        }
    }

    async flush() {
        if (!this.isConnected || !this.client) {
            return false;
        }

        try {
            await this.client.flushAll();
            console.log('🧹 Cache FLUSH: All keys deleted');
            return true;
        } catch (error) {
            console.error('Cache FLUSH error:', error.message);
            return false;
        }
    }

    // Application-specific cache methods

    // Job-related caching
    async getJobStatus(jobId) {
        return await this.get(`job:${jobId}:status`);
    }

    async setJobStatus(jobId, jobData) {
        return await this.set(`job:${jobId}:status`, jobData, this.ttl.jobStatus);
    }

    async invalidateJob(jobId) {
        await this.del(`job:${jobId}:status`);
        await this.del(`job:${jobId}:assets`);
    }

    // User-related caching
    async getUserProfile(userId) {
        return await this.get(`user:${userId}:profile`);
    }

    async setUserProfile(userId, userData) {
        return await this.set(`user:${userId}:profile`, userData, this.ttl.userProfile);
    }

    async getUserStats(userId) {
        return await this.get(`user:${userId}:stats`);
    }

    async setUserStats(userId, statsData) {
        return await this.set(`user:${userId}:stats`, statsData, this.ttl.userStats);
    }

    async invalidateUser(userId) {
        await this.del(`user:${userId}:profile`);
        await this.del(`user:${userId}:stats`);
    }

    // Asset metadata caching
    async getJobAssets(jobId) {
        return await this.get(`job:${jobId}:assets`);
    }

    async setJobAssets(jobId, assetsData) {
        return await this.set(`job:${jobId}:assets`, assetsData, this.ttl.assetMetadata);
    }

    // External API caching (Pixabay)
    async getPixabayResults(searchQuery) {
        const key = `pixabay:search:${Buffer.from(searchQuery).toString('base64')}`;
        return await this.get(key);
    }

    async setPixabayResults(searchQuery, results) {
        const key = `pixabay:search:${Buffer.from(searchQuery).toString('base64')}`;
        return await this.set(key, results, this.ttl.externalAPI);
    }

    // Admin stats caching
    async getAdminStats() {
        return await this.get('admin:stats');
    }

    async setAdminStats(statsData) {
        return await this.set('admin:stats', statsData, this.ttl.adminStats);
    }

    // Processing queue caching
    async getProcessingStatus() {
        return await this.get('processing:status');
    }

    async setProcessingStatus(statusData) {
        return await this.set('processing:status', statusData, this.ttl.processingQueue);
    }

    // Cache statistics
    async getCacheStats() {
        if (!this.isConnected || !this.client) {
            return {
                connected: false,
                message: 'Cache not connected'
            };
        }

        try {
            const info = await this.client.info('stats');
            const keyspace = await this.client.info('keyspace');

            return {
                connected: this.isConnected,
                info: info,
                keyspace: keyspace,
                config: {
                    host: this.config.host,
                    port: this.config.port,
                    ttl_settings: this.ttl
                }
            };
        } catch (error) {
            console.error('Error getting cache stats:', error);
            return {
                connected: this.isConnected,
                error: error.message
            };
        }
    }

    // Test connection for health checks
    async testConnection() {
        if (!this.isConnected || !this.client) {
            throw new Error('Cache not connected');
        }

        try {
            const result = await this.client.ping();
            if (result !== 'PONG') {
                throw new Error('Cache ping test failed');
            }
            return true;
        } catch (error) {
            throw new Error(`Cache connection test failed: ${error.message}`);
        }
    }

    // Graceful shutdown
    async disconnect() {
        if (this.client) {
            try {
                await this.client.disconnect();
                console.log('Redis client disconnected');
            } catch (error) {
                console.error('Error disconnecting Redis client:', error);
            }
        }
    }
}

// Create singleton instance
const cacheService = new CacheService();

// Graceful shutdown handling
process.on('SIGINT', async () => {
    console.log('Gracefully shutting down cache service...');
    await cacheService.disconnect();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('Gracefully shutting down cache service...');
    await cacheService.disconnect();
    process.exit(0);
});

module.exports = cacheService;
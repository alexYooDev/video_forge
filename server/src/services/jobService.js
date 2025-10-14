const { getCurrentModels } = require('../models/index');
const {JOB_STATUS, SUPPORTED_FORMATS} = require('../utils/constants');
const videoProcessingOrchestrator = require('./videoProcessingOrchestrator');
const { ValidationError, NotFoundError, ForbiddenError, InternalServerError } = require('../utils/errors');
const { Op, Sequelize } = require('sequelize');
const cacheService = require('./cacheService');
const s3Service = require('./s3Service');

class JobService {
    constructor() {
        // Queue management properties
        this.maxConcurrentJobs = 2; // Will be updated after AWS config loads
        this.processingQueue = [];
        this.currentJobs = 0;

        console.log(`Job service initialized: max concurrent jobs = ${this.maxConcurrentJobs}`);
    }

    // Update configuration with AWS values
    updateConfig() {
        this.maxConcurrentJobs = parseInt(process.env.MAX_CONCURRENT_JOBS) || 2;
        console.log(`Job service config updated: max concurrent jobs = ${this.maxConcurrentJobs}`);
    }

    async createJob(userId, jobData) {
        const {inputSource, outputFormats = ['720p'] } = jobData;

        // Validate input source (basic validation for intial stage)
        if (!inputSource || inputSource.trim().length === 0) {
            throw ValidationError("Input source is required");
        }

        const validFormats = outputFormats.filter(format => SUPPORTED_FORMATS.includes(format));

        if (validFormats.length === 0) {
            throw ValidationError('At least one valid output format is required');
        }

        try {
            const { Job } = getCurrentModels();
            // Create job in db
            const job = await Job.create({
                user_id: userId,
                input_source: inputSource.trim(),
                output_format: outputFormats.join(','),
                status: JOB_STATUS.PENDING,
                progress: 0
            });

            const jobId = job.id;

            const processingTask = await videoProcessingOrchestrator.processJob(jobId, outputFormats);
            this.addJobToQueue(processingTask.jobId, processingTask.processor).catch(
              (error) => {
                console.error(
                  `Background processing failed for job: ${jobId}`,
                  error
                );
              }
            );

            // Invalidate user stats cache since a new job was created
            await cacheService.invalidateUser(userId);

            return job.toJSON();

        } catch(err) {
            throw InternalServerError(`Failed to create job: ${err.message}`);
        }
    }

    async getJobById(jobId, userId) {
        // Try cache first
        const cachedJob = await cacheService.getJobStatus(jobId);
        if (cachedJob && cachedJob.user_id === userId) {
            return cachedJob;
        }

        const { Job } = getCurrentModels();
        const job = await Job.findOne({
            where: {
                id: jobId,
                user_id: userId
            }
        });

        if (!job) {
            throw NotFoundError('Job not found');
        }

        const jobData = job.toJSON();

        // Cache the job data
        await cacheService.setJobStatus(jobId, jobData);

        return jobData;
    }

    async getAllJobs(userId, options= {}) {
        const {
            page = 1,
            limit =10,
            status,
            sortBy = 'created_at',
            sortOrder = 'DESC',
        } = options;

        const { pageNum, limitNum, offset } = this._validatePagination(page, limit);
        const { safeSortBy, safeSortOrder } = this._validateSortParameters(sortBy, sortOrder);

        let whereClause = { user_id: userId };

        if (status && Object.values(JOB_STATUS).includes(status)) {
            whereClause.status = status;
        }

        const { Job, MediaAsset } = getCurrentModels();
        const total = await Job.count({ where: whereClause });

        const jobs = await Job.findAll({
            where: whereClause,
            order: [[safeSortBy, safeSortOrder]],
            limit: limitNum,
            offset: offset,
            raw: true
        });
        
        // Then add asset counts for completed jobs
        for (let job of jobs) {
            if (job.status === 'COMPLETED') {
                const assetCount = await MediaAsset.count({
                    where: { job_id: job.id }
                });
                job.asset_count = assetCount;
            } else {
                job.asset_count = 0;
            }
        }

        return {
            jobs,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum)
            }
        }
    }

    async updateJob(jobId, userId, updateData) {

        // Check if job exists and belongs to user
        await this.getJobById(jobId, userId);

        const { Job } = getCurrentModels();
        // Filter allowed fields for update
        const allowedFields = ['status', 'progress', 'error_text'];
        const updateObject = {};

        for (const [key, value] of Object.entries(updateData)) {
            if (allowedFields.includes(key) && value !== undefined) {
                updateObject[key] = value;
            }
        }

        if (Object.keys(updateObject).length === 0) {
            throw ValidationError('No valid fields to update');
        }

        const [affectedRows] = await Job.update(updateObject, {
            where: {
                id: jobId,
                user_id: userId
            }
        });

        if (affectedRows === 0) {
            throw NotFoundError('Job not found');
        }

        // Invalidate cache after update
        await cacheService.invalidateJob(jobId);

        // Invalidate user stats cache since job status may have changed
        await cacheService.invalidateUser(userId);

        return await this.getJobById(jobId, userId);
    }

    async deleteJob(jobId, userId) {
      const job = await this.getJobById(jobId, userId);

      // Only allow delete jobs when the file is not being currently processed
      if (
        [
          JOB_STATUS.DOWNLOADING,
          JOB_STATUS.PROCESSING,
          JOB_STATUS.UPLOADING,
        ].includes(job.status)
      ) {
        throw ForbiddenError('Cannot delete job in current status');
      }

      // Use Sequelize transaction to ensure atomic deletion
      const { sequelize, Job, MediaAsset } = getCurrentModels();

      return await sequelize.transaction(async (t) => {
        // First get all media assets to delete S3 files
        const assets = await MediaAsset.findAll({
          where: { job_id: jobId },
          transaction: t
        });

        // Delete S3 files for all assets
        for (const asset of assets) {
          if (asset.s3_key) {
            try {
              await s3Service.deleteFile(asset.s3_key);
              console.log(`Deleted S3 file: ${asset.s3_key}`);
            } catch (deleteError) {
              console.error(`Failed to delete S3 file ${asset.s3_key}:`, deleteError);
              // Continue with deletion even if S3 delete fails
            }
          }
        }

        // Then delete media asset records from database
        await MediaAsset.destroy({
          where: { job_id: jobId },
          transaction: t
        });

        // Then delete the job
        const deletedRows = await Job.destroy({
          where: { 
            id: jobId,
            user_id: userId
          },
          transaction: t
        });

        if (deletedRows === 0) {
          throw NotFoundError('Job not found or access denied');
        }

        // Invalidate cache after deletion
        await cacheService.invalidateJob(jobId);

        // Invalidate user stats cache since a job was deleted
        await cacheService.invalidateUser(userId);

        return true;
      });
    }

    async getJobAssets(jobId, userId) {
        await this.getJobById(jobId, userId);

        const { MediaAsset } = getCurrentModels();
        // Try cache first
        const cachedAssets = await cacheService.getJobAssets(jobId);
        if (cachedAssets) {
            return cachedAssets;
        }

        const assets = await MediaAsset.findAll({
            where: { job_id: jobId },
            order: [['created_at', 'DESC']],
            raw: true
        });

        console.log(`Fetched ${assets.length} assets for job ${jobId}`);

        // Cache the assets data
        await cacheService.setJobAssets(jobId, assets);

        return assets;
    }

    async getUserJobStats(userId) {
        // Try cache first
        const cachedStats = await cacheService.getUserStats(userId);
        if (cachedStats) {
            return cachedStats;
        }

        const statsObj = await this._aggregateJobStats({ user_id: userId });

        // Cache the stats
        await cacheService.setUserStats(userId, statsObj);

        return statsObj;
    }

    async _aggregateJobStats(whereClause = {}) {
        const { Job, sequelize } = getCurrentModels();

        const stats = await Job.findAll({
            attributes: [
                'status',
                [sequelize.fn('COUNT', '*'), 'count'],
                [sequelize.fn('AVG', sequelize.col('progress')), 'avg_progress']
            ],
            where: whereClause,
            group: ['status'],
            raw: true
        });

        const statsObj = {};
        Object.values(JOB_STATUS).forEach(status => {
            statsObj[status] = 0;
        });

        stats.forEach(stat => {
            statsObj[stat.status] = {
                count: parseInt(stat.count),
                avg_progress: Math.round(stat.avg_progress || 0)
            };
        });

        return statsObj;
    }

    async getProcessingStatus() {
        // Try cache first
        const cachedStatus = await cacheService.getProcessingStatus();
        if (cachedStatus) {
            return {
                ...cachedStatus,
                queue: this.getQueueStatus(), // Always get fresh queue status
                systemHealth: await this.getSystemHealth() // Always get fresh system health
            };
        }

        const { Job } = getCurrentModels();

        const activeJobs = await Job.findAll({
            attributes: ['id', 'status', 'progress', 'created_at'],
            where: {
                status: {
                    [Op.in]: ['DOWNLOADING', 'PROCESSING', 'UPLOADING']
                }
            },
            order: [['created_at', 'ASC']],
            raw: true
        });

        const stats = await Job.findAll({
            attributes: [
                'status',
                [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
            ],
            group: ['status'],
            raw: true
        });

        const statusCounts = {};
        stats.forEach(stat => {
            statusCounts[stat.status] = parseInt(stat.count);
        });

        // Check system health
        const systemHealth = await this.getSystemHealth();

        const statusData = {
            jobCounts: statusCounts,
            totalJobs: stats.reduce((sum, stat) => sum + parseInt(stat.count), 0),
            activeJobs,
            systemHealth
        };

        // Cache processing status
        await cacheService.setProcessingStatus(statusData);

        return {
            ...statusData,
            queue: this.getQueueStatus()
        };
    }

    async getAdminJobStats() {
        // Try cache first
        const cachedStats = await cacheService.getAdminStats();
        if (cachedStats) {
            return cachedStats;
        }

          const { User, Job, sequelize } = getCurrentModels();

        const statsObj = await this._aggregateJobStats();

        const userCount = await User.count();

        const recentJobs = await Job.count({
            where: {
                created_at: {
                    [Op.gte]: sequelize.literal("NOW() - INTERVAL '24 hours'")
                }
            }
        });

        const adminStats = {
            jobStats: statsObj,
            totalUsers: userCount,
            recentJobs: recentJobs
        };

        // Cache admin stats
        await cacheService.setAdminStats(adminStats);

        return adminStats;
    }

    async getAllJobsAdmin(options = {}) {
        const {
            page = 1,
            limit = 10,
            status,
            sortBy = 'created_at',
            sortOrder = 'DESC'
        } = options;

        const { User, Job } = getCurrentModels();

        const { pageNum, limitNum, offset } = this._validatePagination(page, limit);
        const { safeSortBy: orderBy, safeSortOrder: order } = this._validateSortParameters(
            sortBy,
            sortOrder,
            ['id', 'created_at', 'updated_at', 'status', 'progress']
        );

        let whereCondition = {};
        if (status && Object.values(JOB_STATUS).includes(status)) {
            whereCondition.status = status;
        }

        const jobs = await Job.findAll({
            where: whereCondition,
            include: [{
                model: User,
                as: 'user',
                attributes: ['email']
            }],
            order: [[orderBy, order]],
            limit: limitNum,
            offset: offset,
            raw: true,
            nest: true
        });

        const total = await Job.count({ where: whereCondition });

        return {
            jobs,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total: parseInt(total),
                totalPages: Math.ceil(total / limitNum)
            }
        };
    }

    async deleteJobAdmin(jobId) {
        const { Job, MediaAsset } = getCurrentModels();
        const job = await Job.findByPk(jobId);

        if (!job) {
            throw NotFoundError('Job not found');
        }

        // Get all media assets to delete S3 files
        const assets = await MediaAsset.findAll({
            where: { job_id: jobId }
        });

        // Delete S3 files for all assets
        for (const asset of assets) {
            if (asset.s3_key) {
                try {
                    await s3Service.deleteFile(asset.s3_key);
                    console.log(`Admin deleted S3 file: ${asset.s3_key}`);
                } catch (deleteError) {
                    console.error(`Failed to delete S3 file ${asset.s3_key}:`, deleteError);
                    // Continue with deletion even if S3 delete fails
                }
            }
        }

        await MediaAsset.destroy({ where: { job_id: jobId } });
        await Job.destroy({ where: { id: jobId } });

        return { deleted: true };
    }

    // ===== QUEUE MANAGEMENT METHODS =====

    async resumeStuckJobs() {
        try {
            console.log('Checking for stuck jobs...');

            const { Job, sequelize } = getCurrentModels();

            const stuckJobs = await Job.findAll({
                attributes: ['id', 'status', 'created_at'],
                where: {
                    status: {
                        [Op.in]: ['DOWNLOADING', 'PROCESSING', 'UPLOADING']
                    },
                    updated_at: {
                        [Op.lt]: sequelize.literal("NOW() - INTERVAL '10 minutes'")
                    }
                },
                raw: true
            });

            if (stuckJobs.length > 0) {
                console.log(`Found ${stuckJobs.length} stuck jobs, resetting to PENDING...`);
                
                await Job.update(
                    { 
                        status: 'PENDING', 
                        progress: 0, 
                        error_text: null,
                        updated_at: new Date()
                    },
                    {
                        where: {
                            id: { [Op.in]: stuckJobs.map(job => job.id) }
                        }
                    }
                );

                console.log('Stuck jobs reset successfully');
            } else {
                console.log('No stuck jobs found');
            }
        } catch (error) {
            console.error('Failed to resume stuck jobs:', error.message);
        }
    }

    async addJobToQueue(jobId, processingFunction) {
        this.processingQueue.push({ jobId, processingFunction });
        console.log(`Job ${jobId} added to queue. Queue length: ${this.processingQueue.length}`);
        
        this.processNextJob();
    }

    async processNextJob() {
        if (this.currentJobs >= this.maxConcurrentJobs) {
            console.log(`Max concurrent jobs (${this.maxConcurrentJobs}) reached. Queued jobs: ${this.processingQueue.length}`);
            return;
        }

        const nextJob = this.processingQueue.shift();
        if (!nextJob) {
            return;
        }

        this.currentJobs++;
        console.log(`Starting job ${nextJob.jobId}. Active jobs: ${this.currentJobs}/${this.maxConcurrentJobs}`);

        try {
            await nextJob.processingFunction();
            console.log(`Job ${nextJob.jobId} completed successfully`);
        } catch (error) {
            console.error(`Job ${nextJob.jobId} failed:`, error.message);
        } finally {
            this.currentJobs--;
            console.log(`Job ${nextJob.jobId} finished. Active jobs: ${this.currentJobs}/${this.maxConcurrentJobs}`);
            
            // Process next job in queue
            setImmediate(() => this.processNextJob());
        }
    }

    getQueueStatus() {
        return {
            activeJobs: this.currentJobs,
            maxConcurrentJobs: this.maxConcurrentJobs,
            queuedJobs: this.processingQueue.length,
            queuedJobIds: this.processingQueue.map(job => job.jobId)
        };
    }

    async restartFailedJobs() {
        const { Job } = getCurrentModels();
        try {
            const [affectedRows] = await Job.update(
                { status: JOB_STATUS.PENDING },
                {
                    where: { status: JOB_STATUS.FAILED },
                    returning: true
                }
            );

            console.log(`Restarted ${affectedRows} failed jobs`);
            return { restartedCount: affectedRows };
        } catch (error) {
            console.error('Error restarting failed jobs:', error);
            throw new InternalServerError('Failed to restart failed jobs');
        }
    }

    async cleanupOldJobs() {
        try {
            const { Job, MediaAsset } = getCurrentModels();
            // Delete jobs older than 30 days that are completed
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

            const oldJobs = await Job.findAll({
                where: {
                    status: JOB_STATUS.COMPLETED,
                    created_at: {
                        [Op.lt]: thirtyDaysAgo
                    }
                },
                include: [{
                    model: MediaAsset,
                    as: 'assets'
                }]
            });

            let deletedCount = 0;
            for (const job of oldJobs) {
                // Delete associated S3 files
                if (job.assets && job.assets.length > 0) {
                    for (const asset of job.assets) {
                        if (asset.s3_key) {
                            try {
                                await s3Service.deleteFile(asset.s3_key);
                            } catch (deleteError) {
                                console.error(`Failed to delete S3 file ${asset.s3_key}:`, deleteError);
                            }
                        }
                    }
                }

                // Delete job and associated assets
                await job.destroy();
                deletedCount++;
            }

            console.log(`Cleaned up ${deletedCount} old jobs`);
            return { deletedCount };
        } catch (error) {
            console.error('Error cleaning up old jobs:', error);
            throw new InternalServerError('Failed to cleanup old jobs');
        }
    }

    async getRecentJobs(limit = 5) {
        try {
            const models = getCurrentModels();
            const { Job } = models;

            const recentJobs = await Job.findAll({
                attributes: ['id', 'status', 'created_at', 'updated_at'],
                order: [['updated_at', 'DESC']],
                limit: limit,
                raw: true
            });

            return recentJobs;
        } catch (error) {
            console.error('Error getting recent jobs:', error);
            throw InternalServerError('Failed to get recent jobs');
        }
    }

    async getSystemHealth() {
        const health = {
            cache: { status: 'unknown', message: '' },
            database: { status: 'unknown', message: '' }
        };

        // Check cache status
        try {
            await cacheService.testConnection();
            health.cache = { status: 'connected', message: 'Cache is responding' };
        } catch (error) {
            health.cache = { status: 'disconnected', message: `Cache error: ${error.message}` };
        }

        // Check database status
        try {
            const models = getCurrentModels();
            const { sequelize } = models;
            await sequelize.authenticate();
            health.database = { status: 'connected', message: 'Database is responding' };
        } catch (error) {
            health.database = { status: 'disconnected', message: `Database error: ${error.message}` };
        }

        return health;
    }

    // ===== HELPER METHODS =====

    _validateSortParameters(sortBy, sortOrder, allowedColumns = ['id', 'created_at', 'status', 'progress']) {
        const safeSortBy = allowedColumns.includes(sortBy) ? sortBy : 'created_at';
        const safeSortOrder = ['ASC', 'DESC'].includes(sortOrder?.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';
        return { safeSortBy, safeSortOrder };
    }

    _validatePagination(page, limit, maxLimit = 50) {
        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(maxLimit, Math.max(1, parseInt(limit)));
        const offset = (pageNum - 1) * limitNum;
        return { pageNum, limitNum, offset };
    }

}

module.exports = new JobService;
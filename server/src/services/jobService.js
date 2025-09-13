const { Job, MediaAsset, User } = require('../models/index');
const {JOB_STATUS, SUPPORTED_FORMATS} = require('../utils/constants');
const videoProcessingOrchestrator = require('./videoProcessingOrchestrator');
const { ValidationError, NotFoundError, ForbiddenError, InternalServerError } = require('../utils/errors');
const { Op } = require('sequelize');

class JobService {
    constructor() {
        // Queue management properties
        this.maxConcurrentJobs = parseInt(process.env.MAX_CONCURRENT_JOBS) || 2;
        this.processingQueue = [];
        this.currentJobs = 0;
        
        console.log(`Job service initialized: max concurrent jobs = ${this.maxConcurrentJobs}`);
    }
    async createJob(userId, jobData) {
        const {inputSource, outputFormats = ['720p'] } = jobData;

        // Validate input source (basic validation for intial stage)
        if (!inputSource || inputSource.trim().length === 0) {
            throw new ValidationError("Input source is required");
        }

        const validFormats = outputFormats.filter(format => SUPPORTED_FORMATS.includes(format));

        if (validFormats.length === 0) {
            throw new ValidationError('At least one valid output format is required');
        }

        try {
            // Create job in db
            const job = await Job.create({
                user_id: userId,
                input_source: inputSource.trim(),
                output_format: outputFormats.join(','),
                status: JOB_STATUS.PENDING,
                progress: 0
            });

            const jobId = job.id;

            const processingTask = videoProcessingOrchestrator.processJob(jobId, outputFormats);
            this.addJobToQueue(processingTask.jobId, processingTask.processor).catch(
              (error) => {
                console.error(
                  `Background processing failed for job: ${jobId}`,
                  error
                );
              }
            );

            return job.toJSON();

        } catch(err) {
            throw new InternalServerError(`Failed to create job: ${err.message}`);
        }
    }

    async getJobById(jobId, userId) {
        const job = await Job.findOne({
            where: { 
                id: jobId,
                user_id: userId 
            }
        });

        if (!job) {
            throw new NotFoundError('Job not found');
        }

        return job.toJSON();
    }

    async getAllJobs(userId, options= {}) {
        const {
            page = 1,
            limit =10,
            status,
            sortBy = 'created_at',
            sortOrder = 'DESC',
        } = options;

        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
        const offset = (pageNum - 1) * limitNum;

        let where = 'WHERE user_id = ?';
        let params = [parseInt(userId)];

        if (status && Object.values(JOB_STATUS).includes(status)) {
            where += ' AND status = ?';
            params.push(status);
        }

        // safety sort to prevent SQL injection
        const allowedSortColumns = ['id', 'created_at', 'status', 'progress'];
        const safeSortBy = allowedSortColumns.includes(sortBy) ? sortBy : 'created_at';
        const safeSortOrder = ['ASC', 'DESC'].includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';
    
        let whereClause = { user_id: parseInt(userId) };
        
        if (status && Object.values(JOB_STATUS).includes(status)) {
            whereClause.status = status;
        }

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

        // Build update query SQL injection safe
        const allowedFields = ['status', 'progress', 'error_text'];
        const updateFields = [];
        const updateValues = [];

        for (const [key, value] of Object.entries(updateData)) {
            if (allowedFields.includes(key) && value !== undefined) {
                updateFields.push(`${key} = ?`);
                updateValues.push(value);
            }
        }

        if (updateFields.length === 0) {
            throw new ValidationError('No valid fields to update');
        }

        const updateObject = {};
        for (let i = 0; i < updateFields.length; i++) {
            const field = updateFields[i].split(' = ')[0];
            updateObject[field] = updateValues[i];
        }

        const [affectedRows] = await Job.update(updateObject, {
            where: {
                id: jobId,
                user_id: userId
            }
        });

        if (affectedRows === 0) {
            throw new NotFoundError('Job not found');
        }

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
        throw new ForbiddenError('Cannot delete job in current status');
      }

      // Use Sequelize transaction to ensure atomic deletion
      const { sequelize } = require('../models/index');
      
      return await sequelize.transaction(async (t) => {
        // First delete related media assets
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
          throw new NotFoundError('Job not found or access denied');
        }

        return true;
      });
    }

    async getJobAssets(jobId, userId) {
        await this.getJobById(jobId, userId);

        const assets = await MediaAsset.findAll({
            where: { job_id: jobId },
            order: [['created_at', 'DESC']],
            raw: true
        });

        return assets;
    }

    async getUserJobStats(userId) {
        const { sequelize } = require('../models/index');
        
        const stats = await Job.findAll({
            attributes: [
                'status',
                [sequelize.fn('COUNT', '*'), 'count'],
                [sequelize.fn('AVG', sequelize.col('progress')), 'avg_progress']
            ],
            where: { user_id: userId },
            group: ['status'],
            raw: true
        });

        const statsObj = {};

        Object.values(JOB_STATUS).forEach(status => {
            statsObj[status] = 0;
        });

        stats.forEach(stat => {
            statsObj[stat.status] = { 
                count : parseInt(stat.count),
                avg_progress: Math.round(stat.avg_progress || 0)
            };
        });

        return statsObj;
    }
    
    async getProcessingStatus() {
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
                [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
            ],
            group: ['status'],
            raw: true
        });

        const statusCounts = {};
        stats.forEach(stat => {
            statusCounts[stat.status] = parseInt(stat.count);
        });

        return {
            jobCounts: statusCounts,
            queue: this.getQueueStatus(),
            totalJobs: stats.reduce((sum, stat) => sum + parseInt(stat.count), 0),
            activeJobs
        };
    }

    async getAdminJobStats() {
        const { sequelize } = require('../models/index');
        
        const stats = await Job.findAll({
            attributes: [
                'status',
                [sequelize.fn('COUNT', '*'), 'count'],
                [sequelize.fn('AVG', sequelize.col('progress')), 'avg_progress']
            ],
            group: ['status'],
            raw: true
        });

        const userCount = await User.count();

        const recentJobs = await Job.count({
            where: {
                created_at: {
                    [Op.gte]: sequelize.literal("NOW() - INTERVAL '24 hours'")
                }
            }
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

        return {
            jobStats: statsObj,
            totalUsers: userCount,
            recentJobs: recentJobs
        };
    }

    async getAllJobsAdmin(options = {}) {
        const { 
            page = 1, 
            limit = 10, 
            status, 
            sortBy = 'created_at', 
            sortOrder = 'DESC' 
        } = options;

        const offset = (page - 1) * limit;
        const validSortColumns = ['id', 'created_at', 'updated_at', 'status', 'progress'];
        const validSortOrders = ['ASC', 'DESC'];
        
        const orderBy = validSortColumns.includes(sortBy) ? sortBy : 'created_at';
        const order = validSortOrders.includes(sortOrder) ? sortOrder : 'DESC';

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
            limit: parseInt(limit),
            offset: offset,
            raw: true,
            nest: true
        });

        const total = await Job.count({ where: whereCondition });

        return {
            jobs,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: parseInt(total),
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    async deleteJobAdmin(jobId) {
        const job = await Job.findByPk(jobId);
        
        if (!job) {
            throw new NotFoundError('Job not found');
        }

        await MediaAsset.destroy({ where: { job_id: jobId } });
        await Job.destroy({ where: { id: jobId } });

        return { deleted: true };
    }

    // ===== QUEUE MANAGEMENT METHODS =====

    async resumeStuckJobs() {
        try {
            console.log('Checking for stuck jobs...');
            
            const { sequelize } = require('../models/index');
            
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

}

module.exports = new JobService;
const database = require('../config/database');
const {JOB_STATUS, SUPPORTED_FORMATS} = require('../utils/constants');
const VideoProcessingService = require('./videoProcessingService');

class JobService {
    async createJob(userId, jobData) {
        const {inputSource, outputFormats = ['720p'] } = jobData;

        // Validate input source (basic validation for intial stage)
        if (!inputSource || inputSource.trim().length === 0) {
            throw new Error("Input source is required");
        }

        const validFormats = outputFormats.filter(format => SUPPORTED_FORMATS.includes(format));

        if (validFormats.length === 0) {
            throw new Error('At least one valid output format is required');
        }

        try {
            // Create job in db
            const result = await database.query(
                'INSERT INTO jobs (user_id, input_source, status, progress) VALUES (?, ?, ?, ?)',
                [userId, inputSource.trim(), JOB_STATUS.PENDING, 0]
            );

            const jobId = result.insertId;
            const job = await this.getJobById(jobId, userId);

            console.log(`Video processing for job: ${jobId} started...`);

            VideoProcessingService.processJob(jobId).catch(error => {
                console.error(`Background processing failed for job: ${jobId}`, error);
            });

            return job

        } catch(err) {
            throw new Error(`Failed to create job: ${err.message}`, 500);
        }
    }

    async getJobById(jobId, userId) {

        const jobs = await database.query(
          'SELECT * FROM jobs WHERE id = ? AND user_id = ?',
          [jobId, userId]
        );

        if (jobs.length === 0) {
            throw new Error('Job not found');
        }

        return jobs[0];
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
        const offset = (pageNum -1) * limitNum;

        let where = 'WHERE user_id = ?';
        let params = [userId];

        if (status && Object.values(JOB_STATUS).includes(status)) {
            where += ' AND status = ?';
            params.push(status);
        }

        // safety sort to prevent SQL injection
        const allowedSortColumns = ['id', 'created_at', 'status', 'progress'];
        const safeSortBy = allowedSortColumns.includes(sortBy) ? sortBy : 'created_at';
        const safeSortOrder = ['ASC', 'DESC'].includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';
    
        const countQuery = `SELECT COUNT(*) as total FROM jobs ${where}`;
        const countResult = await database.query(countQuery, params);
        const total = countResult[0].total;

        const jobsQuery = `
            SELECT 
                j.*, 
                CASE
                 WHEN j.status = 'COMPLETED' THEN
                  (SELECT COUNT(*) FROM media_assets WHERE job_id = j.id)
                 ELSE 0
            FROM jobs j
            ${where}
            ORDER BY j.${safeSortBy} ${safeSortOrder}
            LIMIT ? OFFSET ?
        `;

        const jobs = await database.query(jobsQuery, [...params, limitNum, offset]);

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
            throw new Error('No valid fields to update', 400);
        }

        updateValues.push(jobId, userId);
        const query = `UPDATE jobs SET ${updateFields.join(', ')} WHERE id = ? AND user_id = ?`;

        const result = await database.query(query, updateValues);

        if (result.affectedRows === 0) {
            throw new Error('Job not found');
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
        throw Error('Cannot delete job in current status');
      }

      const result = await database.query(
        'DELETE FROM jobs where id = ? AND user_id = ?',
        [jobId, userId]
      );

      if (result.affectedRows === 0) {
        throw new Error('Job not found', 404);
      }

      return { message: 'Job deleted successfully' };
    }

    async getJobAssets(jobId, userId) {
        await this.getJobById(jobId, userId);

        const assets = await database.query(
            'SELECT * FROM media_assets WHERE job_id = ? ORDER BY created_at DESC',
            [jobId]
        );

        return assets;
    }

    async getUserJobStats(userId) {
        const stats = await database.query(`
            SELECT
                status,
                COUNT(*) as count
                AVG(progress) as avg_progress
            FROM jobs
            WHERE user_id = ?
            GROUP BY status
            `, [userId]
        );

        const statsObj = {};

        Object.values(JOB_STATUS).forEach(status => {
            statsObj[status] = 0;
        });

        stats.forEach(stat => {
            statsObj[stat.status] = { 
                count : parseInt(stat.count),
                avg_progres: Math.round(stat.avg_progress || 0)
            };
        });

        return statsObj;
    }
    
    async getProcessingStatus() {
        const processingStats = VideoProcessingService.getProcessingStats();

        const activeJobs = await database.query(`
                SELECT id, status, progress, created_at
                FROM jobs
                WHERE status IN ('DOWNLOADING', 'PROCESSING', 'UPLOADING')
                ORDER BY created_at ASC
            `);
        
        return {
            ...processingStats,
            activeJobs
        };
    } 

}

module.exports = new JobService;
const database = require('../config/database');
const {JOB_STATUS} = require('../utils/constants');

class JobService {
    async createJob(userId, jobData) {
        const {inputSource, outputFormats = ['720p'] } = jobData;

        // Validate input source (basic validation for intial stage)
        if (!inputSource || inputSource.trim().length() === 0) {
            throw new Error("Input source is required");
        }

        try {
            // Create job in db
            const result = await database.query(
                'INSERT INTO jobs (user_id, input_source, status, progress) VALUES (?, ?, ?, ?)',
                [userId, inputSource.trim(), JOB_STATUS.PENDING, 0]
            );

            const jobId = result.insertId;

            // return the created job at this initial stage
            // later to be replaced by video processing
            const job = await this.getJobById(jobId, userId);

            return job

        } catch(err) {
            throw new Error(`Failed to create job: ${err.message}`)
        }
    }

    async getJobById(jobId, userId) {
        let query = 'SELECT * FROM WHERE id = ?';
        let params = [jobId];

        const jobs = await database.query(query, params);

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

        const jobQuery = `
            SELECT * FROM jobs
            ${where}
            ORDER BY ${safeSortBy} ${safeSortOrder}
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
            throw new Error('No valid fields to update');
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

        // Only allow delete jobs when the file is not in being processed, downloaded, or cancelled
        if (![JOB_STATUS.PENDING, JOB_STATUS.FAILED, JOB_STATUS.CANCELLED].includes(job.status)) {
            throw Error('Cannot delete job in current status');
        }

        const result = await database.query(
            'DELETE FROM jobs where id = ? AND user_id = ?',
            [jobId, userId]
        );

        if (result.affectedRows === 0) {
            throw new Error('Job not found');
        }

        return {message: 'Job deleted successfully'};
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
                count(*) as count
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
            statsObj[stat.status] = parseInt(stat.count);
        });

        return statsObj;
    }
}

module.exports = new JobService;
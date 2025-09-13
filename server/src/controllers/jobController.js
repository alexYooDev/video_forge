
const Joi = require('joi');
const jobService = require('../services/jobService');
const {JOB_STATUS} = require('../utils/constants');
const jobSchema = require('../models/jobSchema')
const path = require('path');
const fs = require('fs-extra');
const { LoadTester, startCPUMonitoring, CONFIG } = require('../scripts/load-test');
const s3Service = require('../services/s3Service');
const { InternalServerError } = require('../utils/errors');

class JobController {

    async createJob(req, res, next) {
        try {
          const { error, value } = jobSchema.validate(req.body);

          if (error) {
            return res
              .status(400)
              .json({ message: 'validation failed', error: error.details });
          }

          const job = await jobService.createJob(req.user.id, value);

          res
            .status(201)
            .json({ job, message: 'Job created successfully' });
        } catch (err) {
            next(err);
        }
    } 

    async getAllJobs(req, res, next) {
        try {
            const options = {
                page: req.query.page,
                limit: req.query.limit,
                staus: req.query.status,
                sortBy: req.query.sortBy,
                sortOrder: req.query.sortOrder
            };

            const result = await jobService.getAllJobs(req.user.id, options);

            res.status(200).json({
                jobs: result.jobs, 
                pagination: result.pagination
            });
        } catch(err) {
            next(err);
        }
    }

    async getJobById(req, res, next) {
        try {
            const jobId = parseInt(req.params.id);
            
            if (isNaN(jobId)) {
                return res.status(400).json({message: 'Invalid job ID'});
            }

            const job = await jobService.getJobById(jobId, req.user.id);

            res.status(200).json({
                job, message: 'Job retrieved successfully'
            });

        } catch(err) {
            next(err);
        }
    }

    async updateJob(req, res, next) {
        try {
            const jobId = parseInt(req.params.id);

            if (isNaN(jobId)) {
                return res.status(400).json({message: 'Invalid Job ID'});
            }

            const {error, value} = Joi.object({
                status: Joi.string().valid(...Object.values(JOB_STATUS)),
                progress: Joi.string().integer().min(0).max(100),
                error_text: Joi.string().allow(null, '')
            }).min(1).validate(req.body);

            if (error) {
                return res.status(400).json({
                    message: 'Validation failed',
                    error: error.details
                });
            }

            const job = await jobService.updateJob(jobId, req.user.id, value);

            res.status(200).json({job, message: 'Job updated successfully'})
        } catch(err) {
            next(err);
        }
    }
    
    async deleteJob(req, res, next) {
        try {
            const jobId = parseInt(req.params.id);

            if (isNaN(jobId)) {
                return res.status(400).json({message: 'Invalid job ID'});
            }

            const result = await jobService.deleteJob(jobId, req.user.id);

            res.status(200).json({result: jobId, message: 'Job deleted successfully'})
        } catch(err) {
            next(err);
        }
    }

    async getJobAssets(req, res, next) {
        try {
            const jobId = parseInt(req.params.id);
            
            if (isNaN(jobId)) {
                return res.status(400).json({message: 'Invalid job ID'});
            }

            const assets = await jobService.getJobAssets(jobId, req.user.id);

            res.status(200).json({assets, message: 'Job assets retrieved successfully'})
        } catch(err) {
            next(err);
        }
    }

    async downloadAsset(req, res, next) {
        try {
            const jobId = parseInt(req.params.id);
            const assetId = parseInt(req.params.assetId);

            if (isNaN(jobId) || isNaN(assetId)) {
                return res.status(400).json({message: 'Invalid job or asset ID'});
            }

            await jobService.getJobById(jobId, req.user.id);

            const assets = await jobService.getJobAssets(jobId, req.user.id);
            const asset = assets.find(asset => asset.id === assetId);

            if (!asset) {
                return res.status(404).json({message: "Asset not found."});
            }
            
            // Check if asset is stored in S3
            if (asset.path && asset.path.startsWith('s3://')) {
                const s3Key = asset.path.replace('s3://', '').split('/').slice(1).join('/');
                const filename = path.basename(asset.path);
                
                // Generate pre-signed URL for download
                const presignedUrl = await s3Service.getPresignedUrl(s3Key, 'getObject', {
                    ResponseContentDisposition: `attachment; filename="${filename}"`,
                    ResponseContentType: this.getAssetType(asset.asset_type)
                });

                return res.status(200).json({
                    downloadUrl: presignedUrl,
                    filename: filename,
                    message: 'Pre-signed download URL generated successfully'
                });
            }

            // Fallback for local file storage
            const filename = path.basename(asset.path);
            const assetType = this.getAssetType(asset.asset_type);

            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.setHeader('Content-Type', assetType);

            const fileStream = fs.createReadStream(asset.path);
            fileStream.pipe(res);

            fileStream.on('error', (error) => {
                console.error('Error streaming file:', error);
                if (!res.headersSent) {
                    next(InternalServerError('Error downloading file'));
                }
            });
        } catch (err) {
            next(err);
        }
    }

    getAssetType(assetType) {
        const type = {
            'TRANSCODE_1080': 'video/mp4',
            'TRNSCODE_720': 'video/mp4',
            'TRANSCODE_480': 'video/mp4',
            'GIF': 'image/gif',
            'THUMBNAIL': 'image/jpeg',
            'METADATA_JSON': 'application/json'
        };

        return type[assetType] || 'application/octet-stream';
    }

    async getUserStats(req, res, next ) {
        try {
            const stats = await jobService.getUserJobStats(req.user.id);

            res.status(200).json({stats, message: 'Job stats retrieved successfully'});

        } catch(err) {
            next(err);
        }
    }

    async getProcessingStatus(req, res, next) {
        try {
            const status = await jobService.getProcessingStatus();
            
            res.status(200).json({status, message: 'processing status retrieved successfully'});
        } catch (err) {
            next(err);
        }
    }

    async getAdminJobStats(_req, res, next) {
        try {
            const stats = await jobService.getAdminJobStats();
            res.status(200).json({stats, message: 'Admin job stats retrieved successfully'});
        } catch (err) {
            next(err);
        }
    }

    async getAllJobsAdmin(req, res, next) {
        try {
            const options = {
                page: req.query.page,
                limit: req.query.limit,
                status: req.query.status,
                sortBy: req.query.sortBy,
                sortOrder: req.query.sortOrder
            };

            const result = await jobService.getAllJobsAdmin(options);
            
            res.status(200).json({
                jobs: result.jobs, 
                pagination: result.pagination
            });
        } catch(err) {
            next(err);
        }
    }

    async deleteJobAdmin(req, res, next) {
        try {
            const jobId = parseInt(req.params.id);

            if (isNaN(jobId)) {
                return res.status(400).json({message: 'Invalid job ID'});
            }

            await jobService.deleteJobAdmin(jobId);

            res.status(200).json({result: jobId, message: 'Job deleted successfully'})
        } catch(err) {
            next(err);
        }
    }

    async getJobEvents(req, res, next) {
        try {
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Cache-Control, Authorization'
            });

            const userId = req.user.id;
            const sendUpdate = (data) => {
                res.write(`data: ${JSON.stringify(data)}\n\n`);
            };

            const heartbeat = setInterval(() => {
                res.write(': heartbeat\n\n');
            }, 30000);

            const checkJobs = async () => {
                try {
                    const jobs = await jobService.getAllJobs(userId, {});
                    const activeJobs = jobs.jobs.filter(job => 
                        ['PENDING', 'DOWNLOADING', 'PROCESSING', 'UPLOADING'].includes(job.status)
                    );
                    
                    for (const job of activeJobs) {
                        sendUpdate({
                            type: 'job_update',
                            jobId: job.id,
                            status: job.status,
                            progress: job.progress,
                            updated_at: job.updated_at
                        });
                    }

                    const stats = await jobService.getProcessingStatus();
                    sendUpdate({
                        type: 'system_stats',
                        stats: stats
                    });
                } catch (error) {
                    console.error('Error sending job updates:', error);
                }
            };

            const updateInterval = setInterval(checkJobs, 2000);
            checkJobs();

            req.on('close', () => {
                clearInterval(heartbeat);
                clearInterval(updateInterval);
                console.log('SSE connection closed for user', userId);
            });

        } catch (err) {
            next(err);
        }
    }

    async runLoadTest(req, res, next) {
        try {
            const { concurrent = 4, durationMinutes = 6, jobInterval = 2000 } = req.body;
            
            console.log(`Starting advanced load test with LoadTester class...`);
            console.log(`Configuration: ${concurrent} concurrent jobs for ${durationMinutes} minutes`);
            
            // Start CPU monitoring
            const cpuMonitor = startCPUMonitoring();
            
            // Override default configuration if provided
            if (concurrent) CONFIG.CONCURRENT_JOBS = concurrent;
            if (durationMinutes) CONFIG.DURATION_MINUTES = durationMinutes;
            if (jobInterval) CONFIG.JOB_INTERVAL_MS = jobInterval;
            
            // Create LoadTester instance with authentication token from current user session
            const authToken = req.headers.authorization?.replace('Bearer ', '');
            const loadTester = new LoadTester(authToken);
            
            // Start the load test asynchronously
            loadTester.startLoadTest().catch(error => {
                console.error('Load test execution error:', error);
            });
            
            res.status(200).json({
                success: true,
                message: `Advanced load test started successfully`,
                result: {
                    concurrent,
                    durationMinutes,
                    jobInterval,
                    status: 'Load test running in background',
                    cpuMonitoring: 'CPU monitoring started'
                }
            });
            
            // Clean up CPU monitoring after test duration + buffer
            setTimeout(() => {
                try {
                    clearInterval(cpuMonitor);
                    console.log('CPU monitoring stopped');
                } catch (e) {
                    console.log('CPU monitoring cleanup completed');
                }
            }, (durationMinutes + 2) * 60 * 1000);
            
        } catch (err) {
            console.error('Load test error:', err);
            next(err);
        }
    }
}

module.exports = new JobController();
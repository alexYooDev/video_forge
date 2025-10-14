
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

    async streamVideo(req, res, next) {
        try {
            const jobId = parseInt(req.params.id);
            const { quality = '720p' } = req.query;

            if (isNaN(jobId)) {
                return res.status(400).json({ message: 'Invalid job ID' });
            }

            // Get job without user_id check to allow public streaming
            const job = await jobService.getJobByIdPublic(jobId);

            if (!job) {
                return res.status(404).json({ message: 'Video not found' });
            }

            // Check if user has access (owner or public video)
            if (job.visibility === 'private' && job.user_id !== req.user?.id) {
                return res.status(403).json({ message: 'Access denied. This video is private.' });
            }

            if (job.status !== 'COMPLETED') {
                return res.status(400).json({
                    message: 'Video is not ready for streaming',
                    status: job.status
                });
            }

            // Check if input_source is a URL or S3 key
            const inputSource = job.input_source;

            if (!inputSource) {
                return res.status(404).json({ message: 'Video source not found' });
            }

            // If input_source is a URL (old workflow - download & transcode)
            // we need to serve from media_assets instead
            if (inputSource.startsWith('http://') || inputSource.startsWith('https://')) {
                // This is an old workflow job - check for transcoded assets
                const assets = await jobService.getJobAssetsPublic(jobId);

                if (assets.length === 0) {
                    return res.status(404).json({
                        message: 'This video has not been transcoded yet. Please use the Dashboard to transcode it first.',
                        note: 'Videos from URLs need to be transcoded before streaming.'
                    });
                }

                // Serve any available transcoded asset
                const asset = assets.find(a => a.asset_type.startsWith('TRANSCODE_')) || assets[0];

                if (asset.s3_key && asset.s3_key.startsWith('s3://')) {
                    const s3Key = asset.s3_key.replace('s3://', '').split('/').slice(1).join('/');

                    const streamUrl = await s3Service.getPresignedUrl(s3Key, 'getObject', {
                        ResponseContentType: 'video/mp4',
                        ResponseContentDisposition: 'inline'
                    }, 3600);

                    return res.status(200).json({
                        streamUrl,
                        quality: asset.asset_type,
                        duration: asset.duration,
                        resolution: asset.resolution,
                        message: 'Streaming transcoded video'
                    });
                }

                return res.status(404).json({ message: 'Transcoded video not found' });
            }

            // For gallery videos (new workflow), stream the original uploaded file from S3
            // input_source contains the S3 key where the video was uploaded
            const streamUrl = await s3Service.getPresignedUrl(inputSource, 'getObject', {
                ResponseContentType: 'video/mp4',
                ResponseContentDisposition: 'inline'
            }, 3600);

            return res.status(200).json({
                streamUrl,
                quality: 'original',
                duration: job.duration,
                resolution: job.resolution,
                message: 'Streaming URL generated successfully'
            });

        } catch (error) {
            next(error);
        }
    }

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
                status: req.query.status,
                sortBy: req.query.sortBy,
                sortOrder: req.query.sortOrder
            };

            // If user is admin, show all jobs from all users
            let result;
            if (req.user.role === 'admin') {
                result = await jobService.getAllJobsAdmin(options);
            } else {
                // Regular users only see their own jobs
                result = await jobService.getAllJobs(req.user.id, options);
            }

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

            // Check if user is authenticated - use public method if not
            let job;
            if (req.user?.id) {
                // Try to get as owner first
                try {
                    job = await jobService.getJobById(jobId, req.user.id);
                } catch (err) {
                    // If not owner, try public access
                    job = await jobService.getJobByIdPublic(jobId);

                    // Check visibility
                    if (job && job.visibility === 'private') {
                        return res.status(403).json({message: 'Access denied. This video is private.'});
                    }
                }
            } else {
                // No authentication, try public access
                job = await jobService.getJobByIdPublic(jobId);

                if (!job) {
                    return res.status(404).json({message: 'Job not found'});
                }

                // Check visibility
                if (job.visibility === 'private') {
                    return res.status(403).json({message: 'Access denied. This video is private.'});
                }
            }

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

           
            const asset = assets.find(asset => parseInt(asset.id) === assetId);

            if (!asset) {
                return res.status(404).json({message: "Asset not found."});
            }
            
            // Check if asset is stored in S3
            if (asset.s3_key && asset.s3_key.startsWith('s3://')) {
                const s3Key = asset.s3_key.replace('s3://', '').split('/').slice(1).join('/');
                const filename = path.basename(asset.s3_key);

                console.log(this.getAssetType(asset.asset_type));

                try {
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
                } catch (error) {
                    if (error.name === 'NotFound') {
                        return res.status(404).json({
                            message: 'Asset file not found in storage',
                            error: 'The requested asset file could not be found in cloud storage. It may have been moved or deleted.',
                            assetId: assetId,
                            filename: filename
                        });
                    }
                    // Re-throw other errors to be handled by the outer catch block
                    throw error;
                }
            }

            // Fallback for local file storage
            const filename = path.basename(asset.s3_key);
            const assetType = this.getAssetType(asset.asset_type);

            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.setHeader('Content-Type', assetType);

            const fileStream = fs.createReadStream(asset.s3_key);
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

    async getProcessingStatus(_req, res, next) {
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
            
            
            // Start CPU monitoring
            const cpuMonitor = startCPUMonitoring();
            
            // Override default configuration if provided
            if (concurrent) CONFIG.CONCURRENT_JOBS = concurrent;
            if (durationMinutes) CONFIG.DURATION_MINUTES = durationMinutes;
            if (jobInterval) CONFIG.JOB_INTERVAL_MS = jobInterval;
            
            // Create LoadTester instance with authentication token from current user session
            const authToken = req.headers.authorization?.replace('Bearer ', '');

            // Pass the correct server URL to LoadTester - ensure HTTPS for remote servers
            let serverUrl = `${req.protocol}://${req.get('host')}`;

            // Force HTTPS for remote servers to avoid 301 redirects
            if (req.get('host').includes('cab432.com')) {
                serverUrl = serverUrl.replace('http://', 'https://');
            }

            const loadTester = new LoadTester(authToken, serverUrl);
            
            // Start the load test asynchronously
            loadTester.startLoadTest().catch(error => {
                console.error('Load test execution error:', error);
            });
            
            // Generate monitoring instructions for frontend display
            const platform = require('os').platform();
            const monitoringInstructions = platform === 'darwin'
                ? 'Open Activity Monitor > CPU tab OR run "htop" in terminal (CMD+T)'
                : 'SSH to server and run: htop (or btop if installed)';

            res.status(200).json({
                success: true,
                message: `Load test started successfully`,
                result: {
                    concurrent,
                    durationMinutes,
                    jobInterval,
                    status: 'Load test running in background',
                    target: `Maintain 80%+ CPU usage for 5+ minutes`,
                    monitoringInstructions,
                    platform: platform === 'darwin' ? 'macOS' : 'Linux'
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

    async restartFailedJobs(_req, res, next) {
        try {
            const result = await jobService.restartFailedJobs();
            res.status(200).json({
                result,
                message: `Restarted ${result.restartedCount} failed jobs`
            });
        } catch (error) {
            next(error);
        }
    }

    async cleanupOldJobs(_req, res, next) {
        try {
            const result = await jobService.cleanupOldJobs();
            res.status(200).json({
                result,
                message: `Deleted ${result.deletedCount} old jobs`
            });
        } catch (error) {
            next(error);
        }
    }

    async getRecentActivity(_req, res, next) {
        try {
            const recentJobs = await jobService.getRecentJobs(5); // Get last 5 jobs

            const activities = recentJobs.map(job => {
                const timeAgo = Math.floor((Date.now() - new Date(job.created_at).getTime()) / (1000 * 60));
                let activity, color;

                switch (job.status) {
                    case 'COMPLETED':
                        activity = 'Job completed';
                        color = 'green';
                        break;
                    case 'FAILED':
                        activity = 'Job failed';
                        color = 'red';
                        break;
                    case 'PROCESSING':
                        activity = 'Job processing';
                        color = 'blue';
                        break;
                    case 'PENDING':
                        activity = 'Job queued';
                        color = 'yellow';
                        break;
                    default:
                        activity = 'Job status updated';
                        color = 'gray';
                }

                return {
                    id: job.id,
                    activity,
                    color,
                    timeAgo: timeAgo < 60 ? `${timeAgo} min ago` : `${Math.floor(timeAgo / 60)}h ago`,
                    timestamp: job.created_at
                };
            });

            res.status(200).json({
                activities,
                message: 'Recent activity retrieved successfully'
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new JobController();
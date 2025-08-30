
const Joi = require('joi');
const jobService = require('../services/jobService');
const {JOB_STATUS} = require('../utils/constants');
const jobSchema = require('../models/jobSchema')
const path = require('path');
const fs = require('fs-extra');

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
            .json({ data: job, message: 'Job created successfully' });
        } catch (err) {
            next(err);
        }
    } 

    async getAllJobs(req, res, next) {
        try {
            const options = {
                page: req.query.page,
                limit: req.query.limit,
                staus: req.query.staus,
                sortBy: req.query.sortBy,
                sortOrder: req.query.sortOrder
            };

            const result = await jobService.getAllJobs(req.user.id, options);

            res.status(200).json({
                data: result.jobs, 
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
                data:job, message: 'Job retrieved successfully'
            });

        } catch(err) {
            next(err);
        }
    }

    async updateJob(req, res, next) {
        try {
            const jobId = parseIn(req.params.id);

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

            const job = await jobService.updateJob(jobId, req,user.id, value);

            res.status(200).json({data: job, message: 'Job updated successfully'})
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

            res.status(200).json({data: result, message: 'Job deleted successfully'})
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

            res.status(200).json({data: assets, message: 'Job assets retrieved successfully'})
        } catch(err) {
            next(err);
        }
    }

    async downloadAsset(req,res,next) {
        try {
            const jobId = parseInt(req.params.id);
            const assetId = parseInt(req.paramas.assetId);

            if (isNaN(jobId) || isNaN(assetId)) {
                return res.status(400).json({message: 'Invalid job or asset ID'});
            }

            await jobService.getJobById(jobId, req.user.id);

            const assets = await jobService.getJobAssets(jobId, req.user.id);
            const asset = assets.find(asset => asset.id === assetId);

            if (!asset) {
                return res.status(404).json({message: "Asset not found."});
            }

            const filename = path.basename(asset.path);
            const assetType = this.getAssetType(asset.asset_type);

            res.setHeader(`Content-Disposition', 'attachment; filename="${filename}"`);
            res.setHeader('Content-Type', assetType);

            const fileStream = fs.createReadStream(asset.path);
            fileStream.pipe(res);

            fileStream.on('error', (error) => {
                console.error('Error streaming file:', error);
                if (!res.headersSent) {
                    res.status(500).json({message: 'Error downloading file'});
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

        return type[assetType] || 'application/octect-stream';
    }

    async getUserStats(req, res, next ) {
        try {
            const stats = await jobService.getUserJobStats(req.user.id);

            res.status(200).json({data: stats, message: 'Job stats retrieved successfully'});

        } catch(err) {
            next(err);
        }
    }

    async getProcesseingStatus(req, res, next) {
        try {
            const status = await jobService.getProcessingStatus();
            
            res.status(200).json({data: status, message: 'processing status retrieved successfully'});
        } catch (err) {
            next(err);
        }
    }

    async processSample(req, res, next) {
        try {
            const sampleJob = {
              inputSource: process.env.SAMPLE_VIDEO_URL,
              outputFormats: ['720p', '480p', 'gif'], // multiple formats for CPU intensive jobs
            };

            console.log(`Creating sample job for load testing (user: ${req.user.id}`);
            const job = await jobService.createJob(req.user.id, sampleJob);


            res.status(201).json({data: job, message: 'Sample processing job created'})
        } catch(err) {
            next(err);
        }
    }
}

module.exports = new JobController();
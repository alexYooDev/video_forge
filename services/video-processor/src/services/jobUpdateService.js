const { getCurrentModels } = require('../models/index');
const { JOB_STATUS } = require('../utils/constants');

class JobUpdateService {
    constructor() {
        console.log('Job Update Service initialized for video processor');
    }

    async updateJobStatus(jobId, status, progress = null) {
        try {
            const updateData = { status };
            if (progress !== null) {
                updateData.progress = Math.min(100, Math.max(0, progress));
            }

            const { Job } = getCurrentModels();
            await Job.update(updateData, { where: { id: jobId } });
            console.log(`Job ${jobId} status updated: ${status}${progress !== null ? ` (${progress}%)` : ''}`);
        } catch (error) {
            console.error(`Failed to update job ${jobId} status:`, error.message);
            throw error;
        }
    }

    async handleProcessingError(jobId, error) {
        try {
            const { Job } = getCurrentModels();
            await Job.update(
                {
                    status: JOB_STATUS.FAILED,
                    error_text: error.message,
                    updated_at: new Date()
                },
                { where: { id: jobId } }
            );
            console.log(`Job ${jobId} marked as failed: ${error.message}`);
        } catch (updateError) {
            console.error(`Failed to update job ${jobId} error status:`, updateError);
        }
    }

    async getJobById(jobId) {
        try {
            const { Job } = getCurrentModels();
            const job = await Job.findByPk(jobId);
            if (!job) {
                throw new Error(`Job not found: ${jobId}`);
            }
            return job;
        } catch (error) {
            console.error(`Failed to get job ${jobId}:`, error.message);
            throw error;
        }
    }

    async saveMediaAsset(jobId, assetData) {
        try {
            const { MediaAsset } = getCurrentModels();
            const mediaAsset = await MediaAsset.create({
                job_id: jobId,
                asset_type: assetData.format,
                s3_key: assetData.s3Key || assetData.path,
                file_size: assetData.size || null,
                format: assetData.format_type || null,
                resolution: assetData.resolution || null,
                duration: assetData.duration || null,
                bitrate: assetData.bitrate || null,
                s3_url: assetData.s3Url || null,
                metadata: assetData.metadata || null
            });

            console.log(`Media asset saved: ${assetData.format} for job ${jobId}`);
            return mediaAsset;
        } catch (error) {
            console.error(`Failed to save media asset for job ${jobId}:`, error.message);
            throw error;
        }
    }

    async saveMetadata(jobId, metadata) {
        try {
            // Extract key fields for structured storage in RDS
            const videoStream = metadata.video || {};
            const audioStream = metadata.audio || {};
            const format = metadata.format || {};

            const metadataUpdate = {
                duration: parseFloat(metadata.duration) || null,
                original_size: parseInt(format.size) || null,
                original_bitrate: parseInt(format.bit_rate) || null,
                resolution: videoStream.width && videoStream.height ? `${videoStream.width}x${videoStream.height}` : null,
                video_codec: videoStream.codec_name || null,
                audio_codec: audioStream.codec_name || null
            };

            const { Job } = getCurrentModels();
            await Job.update(metadataUpdate, { where: { id: jobId } });
            console.log(`Metadata saved for job ${jobId}`);
        } catch (error) {
            console.error(`Failed to save metadata for job ${jobId}:`, error.message);
            throw error;
        }
    }
}

module.exports = new JobUpdateService();
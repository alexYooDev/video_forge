/**
 * VideoProcessingOrchestrator - Coordinates video processing workflow
 * SOLID: Single responsibility for orchestrating the video processing pipeline
 * Much smaller and focused compared to the original 611-line service
 */

const { Job, MediaAsset } = require('../models/index');
const { JOB_STATUS, ASSET_TYPES } = require('../utils/constants');
const { InternalServerError } = require('../utils/errors');

const videoDownloadService = require('./videoDownloadService');
const videoTranscodeService = require('./videoTranscodeService');
const s3Service = require('./s3Service');

class VideoProcessingOrchestrator {
  constructor() {
    console.log('Video processing orchestrator initialized');
  }

  async processJob(jobId, validFormats) {
    // Note: We'll pass this to jobService from the calling code to avoid circular dependency
    return { jobId, validFormats, processor: () => this.executeProcessing(jobId, validFormats) };
  }

  async executeProcessing(jobId, validFormats) {
    let inputVideoPath = null;

    try {
      await this.updateJobStatus(jobId, JOB_STATUS.DOWNLOADING);
      
      // Get job details
      const job = await this.getJobById(jobId);
      
      // Download video
      inputVideoPath = await videoDownloadService.downloadVideo(job.input_source, jobId);
      
      // Extract and save metadata
      await this.updateJobStatus(jobId, JOB_STATUS.PROCESSING, 10);
      const metadata = await videoTranscodeService.getVideoMetadata(inputVideoPath);
      await this.saveMetadata(jobId, metadata);

      // Generate thumbnail and GIF
      const thumbnail = await videoTranscodeService.generateThumbnail(inputVideoPath, jobId);
      await this.saveMediaAsset(jobId, thumbnail);
      
      const gif = await videoTranscodeService.generateGIF(inputVideoPath, jobId);
      await this.saveMediaAsset(jobId, gif);

      // Transcode videos
      const totalFormats = validFormats.length;
      for (let i = 0; i < totalFormats; i++) {
        const format = validFormats[i];
        console.log(`Transcoding to ${format} for job ${jobId}...`);

        const result = await videoTranscodeService.transcodeVideo(
          inputVideoPath, 
          format, 
          jobId,
          (progress) => {
            // Calculate overall progress: 10% download + 10% metadata + 80% transcoding
            const baseProgress = 20;
            const transcodeProgress = (80 / totalFormats) * (i + (progress / 100));
            this.updateJobStatus(jobId, JOB_STATUS.PROCESSING, Math.round(baseProgress + transcodeProgress));
          }
        );

        await this.saveMediaAsset(jobId, result);
      }

      await this.updateJobStatus(jobId, JOB_STATUS.COMPLETED, 100);
    } catch (error) {
      console.error(`Processing failed for job ${jobId}:`, error);
      await this.handleProcessingError(jobId, error);
      throw error;
    } finally {
      // Always clean up input file
      if (inputVideoPath) {
        try {
          await videoTranscodeService.cleanup([inputVideoPath]);
          console.log(`Cleaned up input file: ${inputVideoPath}`);
        } catch (cleanupErr) {
          console.error(`Failed to clean up input file ${inputVideoPath}:`, cleanupErr.message);
        }
      }
    }
  }

  async getJobById(jobId) {
    const job = await Job.findByPk(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }
    return job;
  }

  async updateJobStatus(jobId, status, progress = null) {
    const updateData = { status };
    if (progress !== null) {
      updateData.progress = Math.min(100, Math.max(0, progress));
    }

    await Job.update(updateData, { where: { id: jobId } });
    console.log(`Job ${jobId} status updated: ${status}${progress !== null ? ` (${progress}%)` : ''}`);
  }

  async saveMediaAsset(jobId, assetData) {
    try {
      const useS3 = !!(process.env.S3_BUCKET_NAME);
      let finalPath = assetData.path;

      if (useS3) {
        console.log(`Uploading ${assetData.format} to S3...`);
        const s3Key = s3Service.generateS3Key(jobId, assetData.filename, 'output');
        const s3Url = await s3Service.uploadFile(assetData.path, s3Key, this.getContentType(assetData.format));
        finalPath = s3Url;

        // Clean up local file after upload
        try {
          await videoTranscodeService.cleanup([assetData.path]);
          console.log(`Local output file cleaned up: ${assetData.path}`);
        } catch (cleanupError) {
          console.error(`Failed to cleanup local file: ${cleanupError.message}`);
        }
      }

      await MediaAsset.create({
        job_id: jobId,
        asset_type: assetData.format,
        path: finalPath,
        size_bytes: null // Could add file size if needed
      });

      console.log(`Media asset saved: ${assetData.format} -> ${finalPath}`);
    } catch (error) {
      console.error(`Failed to save media asset:`, error);
      throw InternalServerError(`Failed to save media asset: ${error.message}`);
    }
  }

  async saveMetadata(jobId, metadata) {
    const metadataFileName = `${jobId}_metadata.json`;
    const metadataPath = `/tmp/${metadataFileName}`;
    
    try {
      await require('fs-extra').writeJson(metadataPath, metadata, { spaces: 2 });
      
      await this.saveMediaAsset(jobId, {
        path: metadataPath,
        format: 'METADATA_JSON',
        filename: metadataFileName
      });
    } catch (error) {
      console.error(`Failed to save metadata:`, error);
      throw InternalServerError(`Failed to save metadata: ${error.message}`);
    }
  }

  async handleProcessingError(jobId, error) {
    try {
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

  getContentType(assetType) {
    const types = {
      'TRANSCODE_1080': 'video/mp4',
      'TRANSCODE_720': 'video/mp4',
      'TRANSCODE_480': 'video/mp4',
      'GIF': 'image/gif',
      'THUMBNAIL': 'image/jpeg',
      'METADATA_JSON': 'application/json'
    };
    return types[assetType] || 'application/octet-stream';
  }

  // Queue operations removed - now handled by jobService directly
}

module.exports = new VideoProcessingOrchestrator();
/**
 * VideoProcessingOrchestrator - Coordinates video processing workflow
 * SOLID: Single responsibility for orchestrating the video processing pipeline
 * Much smaller and focused compared to the original 611-line service
 */

const { getCurrentModels } = require('../models/index');
const { JOB_STATUS, ASSET_TYPES } = require('../utils/constants');
const { InternalServerError } = require('../utils/errors');

const videoDownloadService = require('./videoDownloadService');
const videoTranscodeService = require('./videoTranscodeService');
const s3Service = require('./s3Service');
const awsConfig = require('../config/awsConfig');
const fs = require('fs-extra');

class VideoProcessingOrchestrator {
  constructor() {
    console.log('Video processing orchestrator initialized');
  }

  // Check if S3 is configured using AWS config
  async isS3Configured() {
    try {
      await s3Service.ensureInitialized();
      return !!(s3Service.bucketName);
    } catch (error) {
      console.warn('Failed to check S3 configuration:', error.message);
      return false;
    }
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
      await this.saveMetadataHybrid(jobId, metadata);

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
    const { Job } = getCurrentModels();
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

    const { Job } = getCurrentModels();
    await Job.update(updateData, { where: { id: jobId } });
    console.log(`Job ${jobId} status updated: ${status}${progress !== null ? ` (${progress}%)` : ''}`);
  }

  async saveMediaAsset(jobId, assetData) {
    try {
      const useS3 = await this.isS3Configured();
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

      const { MediaAsset } = getCurrentModels();
      await MediaAsset.create({
        job_id: jobId,
        asset_type: assetData.format,
        s3_key: finalPath,
        file_size: assetData.size || null,
        format: assetData.format_type || null,
        resolution: assetData.resolution || null,
        duration: assetData.duration || null,
        bitrate: assetData.bitrate || null,
        s3_url: useS3 ? finalPath : null,
        metadata: assetData.metadata || null
      });

      console.log(`Media asset saved: ${assetData.format} -> ${finalPath}`);
    } catch (error) {
      console.error(`Failed to save media asset:`, error);
      throw InternalServerError(`Failed to save media asset: ${error.message}`);
    }
  }

  async saveMetadataHybrid(jobId, metadata) {
    const metadataFileName = `${jobId}_metadata.json`;
    const metadataPath = `/tmp/${metadataFileName}`;
    
    try {
      // Save complete metadata file to local temp
      await fs.writeJson(metadataPath, metadata, { spaces: 2 });
      
      // Upload to S3 if configured
      const useS3 = await this.isS3Configured();
      let metadataS3Key = null;
      
      if (useS3) {
        const s3Key = s3Service.generateS3Key(jobId, metadataFileName, 'metadata');
        await s3Service.uploadFile(metadataPath, s3Key, 'application/json');
        metadataS3Key = s3Key;
        
        // Clean up local file after upload
        try {
          await fs.remove(metadataPath);
          console.log(`Local metadata file cleaned up: ${metadataPath}`);
        } catch (cleanupError) {
          console.error(`Failed to cleanup local metadata file: ${cleanupError.message}`);
        }
      }
      
      // Extract key fields for structured storage in RDS
      const videoStream = metadata.video || {};
      const audioStream = metadata.audio || {};
      const format = metadata.format || {};
      
      const metadataUpdate = {
        metadata_s3_key: metadataS3Key,
        duration: parseFloat(metadata.duration) || null,
        original_size: parseInt(format.size) || null,
        original_bitrate: parseInt(format.bit_rate) || null,
        resolution: videoStream.width && videoStream.height ? `${videoStream.width}x${videoStream.height}` : null,
        video_codec: videoStream.codec_name || null,
        audio_codec: audioStream.codec_name || null
      };

      const { Job } = getCurrentModels();
      await Job.update(metadataUpdate, { where: { id: jobId } });
      console.log(`Metadata saved: structured data in RDS${useS3 ? ` and complete file in S3 (${metadataS3Key})` : ''}`);
    } catch (error) {
      console.error(`Failed to save metadata:`, error);
      throw InternalServerError(`Failed to save metadata: ${error.message}`);
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

  getContentType(assetType) {
    const types = {
      'TRANSCODE_4K': 'video/mp4',
      'TRANSCODE_1080': 'video/mp4',
      'TRANSCODE_720': 'video/mp4',
      'TRANSCODE_480': 'video/mp4',
      'GIF': 'image/gif',
      'THUMBNAIL': 'image/jpeg',
      'METADATA_JSON': 'application/json'
    };
    return types[assetType] || 'application/octet-stream';
  }
}

module.exports = new VideoProcessingOrchestrator();
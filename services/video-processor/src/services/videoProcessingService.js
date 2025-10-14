/**
 * VideoProcessingService - Handles video processing for the Video Processor microservice
 * This replaces the original VideoProcessingOrchestrator for the standalone processing service
 */

const { JOB_STATUS, ASSET_TYPES } = require('../utils/constants');
const { InternalServerError } = require('../utils/errors');

const videoDownloadService = require('./videoDownloadService');
const videoTranscodeService = require('./videoTranscodeService');
const s3Service = require('./s3Service');
const jobUpdateService = require('./jobUpdateService');
const fs = require('fs-extra');

class VideoProcessingService {
  constructor() {
    console.log('Video processing service initialized');
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

  async processJob(jobData) {
    const { jobId, inputSource, outputFormats } = jobData;
    let inputVideoPath = null;

    try {
      console.log(`Starting processing for job ${jobId}`);

      await jobUpdateService.updateJobStatus(jobId, JOB_STATUS.DOWNLOADING);

      // Get job details
      const job = await jobUpdateService.getJobById(jobId);

      // Download video
      inputVideoPath = await videoDownloadService.downloadVideo(inputSource, jobId);

      // Extract and save metadata
      await jobUpdateService.updateJobStatus(jobId, JOB_STATUS.PROCESSING, 10);
      const metadata = await videoTranscodeService.getVideoMetadata(inputVideoPath);
      await jobUpdateService.saveMetadata(jobId, metadata);

      // Generate thumbnail and GIF
      const thumbnail = await videoTranscodeService.generateThumbnail(inputVideoPath, jobId);
      await this.saveMediaAsset(jobId, thumbnail);

      const gif = await videoTranscodeService.generateGIF(inputVideoPath, jobId);
      await this.saveMediaAsset(jobId, gif);

      // Transcode videos
      const totalFormats = outputFormats.length;
      for (let i = 0; i < totalFormats; i++) {
        const format = outputFormats[i];
        console.log(`Transcoding to ${format} for job ${jobId}...`);

        const result = await videoTranscodeService.transcodeVideo(
          inputVideoPath,
          format,
          jobId,
          (progress) => {
            // Calculate overall progress: 10% download + 10% metadata + 80% transcoding
            const baseProgress = 20;
            const transcodeProgress = (80 / totalFormats) * (i + (progress / 100));
            jobUpdateService.updateJobStatus(jobId, JOB_STATUS.PROCESSING, Math.round(baseProgress + transcodeProgress));
          }
        );

        await this.saveMediaAsset(jobId, result);
      }

      await jobUpdateService.updateJobStatus(jobId, JOB_STATUS.COMPLETED, 100);
      console.log(`Job ${jobId} completed successfully`);
    } catch (error) {
      console.error(`Processing failed for job ${jobId}:`, error);
      await jobUpdateService.handleProcessingError(jobId, error);
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

  async saveMediaAsset(jobId, assetData) {
    try {
      const useS3 = await this.isS3Configured();
      let finalPath = assetData.path;
      let s3Url = null;

      if (useS3) {
        console.log(`Uploading ${assetData.format} to S3...`);
        const s3Key = s3Service.generateS3Key(jobId, assetData.filename, 'output');
        s3Url = await s3Service.uploadFile(assetData.path, s3Key, this.getContentType(assetData.format));
        finalPath = s3Key;

        // Clean up local file after upload
        try {
          await videoTranscodeService.cleanup([assetData.path]);
          console.log(`Local output file cleaned up: ${assetData.path}`);
        } catch (cleanupError) {
          console.error(`Failed to cleanup local file: ${cleanupError.message}`);
        }
      }

      const assetDataForSave = {
        format: assetData.format,
        s3Key: finalPath,
        s3Url: s3Url,
        path: finalPath,
        size: assetData.size || null,
        format_type: assetData.format_type || null,
        resolution: assetData.resolution || null,
        duration: assetData.duration || null,
        bitrate: assetData.bitrate || null,
        metadata: assetData.metadata || null
      };

      await jobUpdateService.saveMediaAsset(jobId, assetDataForSave);
      console.log(`Media asset saved: ${assetData.format} -> ${finalPath}`);
    } catch (error) {
      console.error(`Failed to save media asset:`, error);
      throw InternalServerError(`Failed to save media asset: ${error.message}`);
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

module.exports = new VideoProcessingService();
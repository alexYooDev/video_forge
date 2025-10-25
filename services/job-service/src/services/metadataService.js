const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const s3Service = require('./s3Service');
const { apiLogger } = require('../utils/logger');

class MetadataService {
  /**
   * Extract video metadata from S3 video
   * @param {string} s3Key - S3 key of the video
   * @returns {Promise<Object>} Metadata object
   */
  async extractMetadata(s3Key) {
    let tempFilePath = null;

    try {
      apiLogger.info('Starting metadata extraction', { s3Key });

      // Download video from S3 to temp location
      const tempDir = '/tmp';
      await fs.ensureDir(tempDir);
      const tempFileName = `${uuidv4()}_${path.basename(s3Key)}`;
      tempFilePath = path.join(tempDir, tempFileName);

      apiLogger.info('Downloading video from S3', { s3Key, tempFilePath });
      await s3Service.downloadFile(s3Key, tempFilePath);

      // Extract metadata using ffprobe
      apiLogger.info('Extracting metadata with ffprobe', { tempFilePath });
      const metadata = await this.getVideoMetadata(tempFilePath);

      // Get file size
      const stats = await fs.stat(tempFilePath);
      metadata.fileSize = stats.size;

      apiLogger.info('Metadata extraction successful', { s3Key, metadata });

      return metadata;
    } catch (error) {
      apiLogger.error('Metadata extraction failed', { s3Key, error: error.message });
      throw error;
    } finally {
      // Clean up temp file
      if (tempFilePath) {
        try {
          await fs.remove(tempFilePath);
          apiLogger.info('Temp file cleaned up', { tempFilePath });
        } catch (cleanupError) {
          apiLogger.error('Failed to cleanup temp file', {
            tempFilePath,
            error: cleanupError.message
          });
        }
      }
    }
  }

  /**
   * Get video metadata using ffprobe
   * @param {string} filePath - Local file path
   * @returns {Promise<Object>} Metadata
   */
  async getVideoMetadata(filePath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          return reject(new Error(`FFprobe error: ${err.message}`));
        }

        try {
          const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
          const audioStream = metadata.streams.find(stream => stream.codec_type === 'audio');

          const result = {
            duration: metadata.format.duration ? parseFloat(metadata.format.duration) : null,
            resolution: videoStream ? `${videoStream.width}x${videoStream.height}` : null,
            videoCodec: videoStream?.codec_name || null,
            audioCodec: audioStream?.codec_name || null,
            bitrate: metadata.format.bit_rate ? parseInt(metadata.format.bit_rate) : null,
            format: metadata.format.format_name || null,
            width: videoStream?.width || null,
            height: videoStream?.height || null
          };

          resolve(result);
        } catch (parseError) {
          reject(new Error(`Failed to parse metadata: ${parseError.message}`));
        }
      });
    });
  }
}

module.exports = new MetadataService();

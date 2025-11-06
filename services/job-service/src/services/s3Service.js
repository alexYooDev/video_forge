const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const fs = require('fs-extra');
const path = require('path');
const { InternalServerError, NotFound } = require('../utils/errors');
const awsConfig = require('../config/awsConfig');
const { Sequelize } = require('sequelize');
const { MediaAsset, Job } = require('../models/index');
const { Op } = require('sequelize');
const { apiLogger } = require('../utils/logger');

class S3Service {
  constructor() {
    this.region = process.env.AWS_REGION || 'ap-southeast-2';
    this.bucketName = null;
    this.cloudFrontDomain = process.env.CLOUDFRONT_DOMAIN || 'd3vlpici5fmp7i.cloudfront.net';
    this.s3Client = new S3Client({ region: this.region });
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    const config = await awsConfig.getEnvironmentConfig();
    this.region = config.aws.region;
    this.bucketName = config.aws.s3BucketName;
    this.s3Client = new S3Client({ region: this.region });
    this.initialized = true;

    apiLogger.s3('S3 Service initialized', { bucket: this.bucketName, region: this.region });
  }

  async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /* Generate S3 key for a file */
  generateS3Key(jobId, filename, type = 'output') {
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `videos/${type}/${jobId}/${sanitizedFilename}`;
  }

  /* Upload file to S3 */
  async uploadFile(filePath, s3Key, contentType = 'video/mp4') {
    await this.ensureInitialized();
    try {
      // Check if local file exists
      if (!(await fs.pathExists(filePath))) {
        throw NotFound(`Local file not found: ${filePath}`);
      }

      // Read file stream
      const fileStream = fs.createReadStream(filePath);
      const stats = await fs.stat(filePath);

      const uploadParams = {
        Bucket: this.bucketName,
        Key: s3Key,
        Body: fileStream,
        ContentType: contentType,
        ContentLength: stats.size,
      };

      const command = new PutObjectCommand(uploadParams);
      await this.s3Client.send(command);

      const s3Url = `s3://${this.bucketName}/${s3Key}`;
      apiLogger.s3('File uploaded to S3', { filePath, s3Key, s3Url });

      return s3Url;
    } catch (error) {
      apiLogger.error('S3 upload failed', error, { filePath, s3Key });
      throw InternalServerError(`Failed to upload file to S3: ${error.message}`);
    }
  }

  /* Upload file buffer to S3 */
  async uploadBuffer(buffer, s3Key, contentType = 'application/octet-stream') {
    await this.ensureInitialized();
    try {
      const uploadParams = {
        Bucket: this.bucketName,
        Key: s3Key,
        Body: buffer,
        ContentType: contentType,
      };

      const command = new PutObjectCommand(uploadParams);
      await this.s3Client.send(command);

      const s3Url = `s3://${this.bucketName}/${s3Key}`;
      apiLogger.s3('Buffer uploaded to S3', { s3Key, s3Url });

      return s3Url;
    } catch (error) {
      apiLogger.error('S3 buffer upload failed', error, { s3Key });
      throw InternalServerError(`Failed to upload buffer to S3: ${error.message}`);
    }
  }

  /* Download file from S3 to local path */
  async downloadFile(s3Key, localPath) {
    await this.ensureInitialized();
    try {
      // Ensure local directory exists
      await fs.ensureDir(path.dirname(localPath));

      const getParams = {
        Bucket: this.bucketName,
        Key: s3Key
      };

      const command = new GetObjectCommand(getParams);
      const response = await this.s3Client.send(command);

      // Write stream to file
      const writeStream = fs.createWriteStream(localPath);
      
      return new Promise((resolve, reject) => {
        response.Body.pipe(writeStream);

        writeStream.on('finish', () => {
          apiLogger.s3('File downloaded from S3', { s3Key, localPath });
          resolve(localPath);
        });

        writeStream.on('error', (error) => {
          apiLogger.error('Download write failed', error, { s3Key });
          reject(new InternalServerError(`Failed to write downloaded file: ${error.message}`));
        });

        response.Body.on('error', (error) => {
          apiLogger.error('Download stream failed', error, { s3Key });
          reject(new InternalServerError(`Failed to download from S3: ${error.message}`));
        });
      });
    } catch (error) {
      apiLogger.error('S3 download failed', error, { s3Key });
      throw InternalServerError(`Failed to download file from S3: ${error.message}`);
    }
  }

  /* Check if file exists in S3 */
  async fileExists(s3Key) {
    await this.ensureInitialized();
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key
      });

      await this.s3Client.send(command);
      return true;
    } catch (error) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return false;
      }
      // Re-throw other errors (permissions, etc.)
      throw error;
    }
  }

  /* Generate pre-signed URL for file access */
  async getPresignedUrl(s3Key, operation = 'getObject', options = {}, expiresIn = 3600) {
    await this.ensureInitialized();
    try {
      // For getObject operations, use CloudFront for edge caching
      if (operation === 'getObject') {
        const exists = await this.fileExists(s3Key);
        if (!exists) {
          throw NotFound(`File not found in S3: ${s3Key}`);
        }

        // Return CloudFront URL (cached at edge locations globally)
        const cloudFrontUrl = `https://${this.cloudFrontDomain}/${s3Key}`;
        apiLogger.s3('Generated CloudFront URL', { s3Key, cloudFrontDomain: this.cloudFrontDomain });
        return cloudFrontUrl;
      }

      // For putObject (uploads), use S3 presigned URLs
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
        ...options
      });

      const presignedUrl = await getSignedUrl(this.s3Client, command, { expiresIn });
      apiLogger.s3('Generated S3 pre-signed URL for upload', { operation, s3Key });

      return presignedUrl;
    } catch (error) {
      apiLogger.error('Failed to generate URL', error, { s3Key, operation });
      if (error.name === 'NotFound') {
        throw error; // Re-throw NotFound errors as-is
      }
      throw InternalServerError(`Failed to generate URL: ${error.message}`);
    }
  }

  /* Generate pre-signed upload URL for direct client uploads */
  async generateUploadUrl(filename, contentType = 'video/mp4', metadata = {}) {
    await this.ensureInitialized();
    try {
      const uploadId = `upload-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const s3Key = this.generateS3Key(uploadId, filename, 'uploads');

      const presignedUrl = await this.getPresignedUrl(
        s3Key,
        'putObject',
        {
          ContentType: contentType,
          Metadata: metadata
        },
        3600 // 1 hour expiration
      );

      apiLogger.s3('Generated upload URL', { filename, s3Key, uploadId });

      return {
        uploadUrl: presignedUrl,
        s3Key,
        uploadId,
        expiresIn: 3600
      };
    } catch (error) {
      apiLogger.error('Failed to generate upload URL', error, { filename });
      throw InternalServerError(`Failed to generate upload URL: ${error.message}`);
    }
  }

  /* Delete file from S3 */
  async deleteFile(s3Key) {
    await this.ensureInitialized();
    try {
      const deleteParams = {
        Bucket: this.bucketName,
        Key: s3Key
      };

      const command = new DeleteObjectCommand(deleteParams);
      await this.s3Client.send(command);

      apiLogger.s3('File deleted from S3', { s3Key });
    } catch (error) {
      apiLogger.error('S3 delete failed', error, { s3Key });
      throw InternalServerError(`Failed to delete file from S3: ${error.message}`);
    }
  }

  /* Check if file exists in S3 */
  async fileExists(s3Key) {
    await this.ensureInitialized();
    try {
      const headParams = {
        Bucket: this.bucketName,
        Key: s3Key
      };

      const command = new HeadObjectCommand(headParams);
      await this.s3Client.send(command);
      
      return true;
    } catch (error) {
      if (error.name === 'NotFound') {
        return false;
      }
      throw InternalServerError(`Failed to check file existence: ${error.message}`);
    }
  }

  /* Extract S3 key from S3 URL */
  async extractS3Key(s3Url) {
    await this.ensureInitialized();
    if (s3Url.startsWith('s3://')) {
      return s3Url.replace(`s3://${this.bucketName}/`, '');
    }
    return s3Url;
  }

  // ===== STORAGE MANAGEMENT METHODS =====

  async getBucketStats() {
    await this.ensureInitialized();

    try {
      let totalSize = 0;
      let totalFiles = 0;
      let continuationToken;

      do {
        const listParams = {
          Bucket: this.bucketName,
          MaxKeys: 1000,
          ContinuationToken: continuationToken
        };

        const command = new ListObjectsV2Command(listParams);
        const response = await this.s3Client.send(command);

        if (response.Contents) {
          totalFiles += response.Contents.length;
          totalSize += response.Contents.reduce((sum, obj) => sum + (obj.Size || 0), 0);
        }

        continuationToken = response.NextContinuationToken;
      } while (continuationToken);

      return {
        totalFiles,
        totalSize: Math.round(totalSize / (1024 * 1024 * 1024) * 100) / 100, // GB
        totalSizeMB: Math.round(totalSize / (1024 * 1024) * 100) / 100, // MB
        bucketName: this.bucketName,
        lastChecked: new Date().toISOString()
      };
    } catch (error) {
      apiLogger.error('Failed to get bucket stats', error, { bucket: this.bucketName });
      return {
        totalFiles: 0,
        totalSize: 0,
        totalSizeMB: 0,
        bucketName: this.bucketName,
        error: error.message
      };
    }
  }

  async cleanupTempFiles() {
    await this.ensureInitialized();

    try {
      // Find temp files older than 24 hours
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const listParams = {
        Bucket: this.bucketName,
        Prefix: 'videos/temp/'
      };

      const command = new ListObjectsV2Command(listParams);
      const response = await this.s3Client.send(command);

      let deletedCount = 0;
      let freedSpace = 0;

      if (response.Contents && response.Contents.length > 0) {
        const oldFiles = response.Contents.filter(obj =>
          obj.LastModified && obj.LastModified < oneDayAgo
        );

        for (const file of oldFiles) {
          try {
            await this.deleteFile(file.Key);
            deletedCount++;
            freedSpace += file.Size || 0;
          } catch (deleteError) {
            apiLogger.error('Failed to delete temp file', deleteError, { s3Key: file.Key });
          }
        }
      }

      return {
        deletedCount,
        freedSpace: Math.round(freedSpace / (1024 * 1024) * 100) / 100 // MB
      };
    } catch (error) {
      apiLogger.error('Cleanup temp files failed', error, { bucket: this.bucketName });
      throw InternalServerError(`Cleanup failed: ${error.message}`);
    }
  }

  async findOrphanedFiles() {
    await this.ensureInitialized();

    try {
      // Get all S3 objects
      const listParams = {
        Bucket: this.bucketName,
        Prefix: 'videos/output/'
      };

      const command = new ListObjectsV2Command(listParams);
      const response = await this.s3Client.send(command);

      if (!response.Contents || response.Contents.length === 0) {
        return [];
      }

      // Get all S3 keys from database
      const dbAssets = await MediaAsset.findAll({
        attributes: ['s3_key'],
        raw: true
      });

      const dbKeys = new Set(dbAssets.map(asset => asset.s3_key));

      // Find orphaned files (in S3 but not in database)
      const orphanedFiles = response.Contents.filter(obj =>
        obj.Key && !dbKeys.has(obj.Key)
      );

      return orphanedFiles.map(file => ({
        key: file.Key,
        size: file.Size,
        lastModified: file.LastModified
      }));
    } catch (error) {
      apiLogger.error('Find orphaned files failed', error, { bucket: this.bucketName });
      throw InternalServerError(`Find orphaned files failed: ${error.message}`);
    }
  }

  async removeOrphanedFiles(orphanedFiles) {
    let deletedCount = 0;
    let freedSpace = 0;

    for (const file of orphanedFiles) {
      try {
        await this.deleteFile(file.key);
        deletedCount++;
        freedSpace += file.size || 0;
      } catch (error) {
        apiLogger.error('Failed to delete orphaned file', error, { s3Key: file.key });
      }
    }

    return {
      deletedCount,
      freedSpace: Math.round(freedSpace / (1024 * 1024) * 100) / 100 // MB
    };
  }

  async compressOldAssets() {
    // This is a placeholder for asset compression logic
    // In a real implementation, you might compress files older than X days
    return {
      compressedCount: 0,
      spaceSaved: 0
    };
  }

  async generateStorageReport({ format = 'json', periodDays = 30 }) {
    await this.ensureInitialized();

    try {
      const startDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

      // Get bucket stats
      const bucketStats = await this.getBucketStats();

      // Get usage by period
      const usageByDay = await MediaAsset.findAll({
        attributes: [
          [Sequelize.fn('DATE', Sequelize.col('MediaAsset.created_at')), 'date'],
          [Sequelize.fn('COUNT', Sequelize.col('MediaAsset.id')), 'file_count'],
          [Sequelize.fn('SUM', Sequelize.col('file_size')), 'total_size']
        ],
        where: {
          created_at: {
            [Op.gte]: startDate
          }
        },
        group: [Sequelize.fn('DATE', Sequelize.col('MediaAsset.created_at'))],
        order: [[Sequelize.fn('DATE', Sequelize.col('MediaAsset.created_at')), 'DESC']],
        raw: true
      });

      // Get top users by storage usage
      const topUsers = await MediaAsset.findAll({
        attributes: [
          'job.user_id',
          [Sequelize.fn('COUNT', Sequelize.col('MediaAsset.id')), 'file_count'],
          [Sequelize.fn('SUM', Sequelize.col('file_size')), 'total_size']
        ],
        include: [{
          model: Job,
          as: 'job',
          attributes: []
        }],
        where: {
          created_at: {
            [Op.gte]: startDate
          }
        },
        group: ['job.user_id'],
        order: [[Sequelize.fn('SUM', Sequelize.col('file_size')), 'DESC']],
        limit: 10,
        raw: true
      });

      const report = {
        generatedAt: new Date().toISOString(),
        period: `${periodDays} days`,
        bucket: bucketStats,
        usage: {
          byDay: usageByDay,
          topUsers: topUsers
        }
      };

      if (format === 'csv') {
        // Convert to CSV format
        let csv = 'Date,File Count,Total Size (MB)\n';
        usageByDay.forEach(day => {
          const sizeMB = Math.round((day.total_size || 0) / (1024 * 1024) * 100) / 100;
          csv += `${day.date},${day.file_count},${sizeMB}\n`;
        });
        return csv;
      }

      return report;
    } catch (error) {
      apiLogger.error('Generate storage report failed', error, { periodDays, format });
      throw InternalServerError(`Report generation failed: ${error.message}`);
    }
  }
}

module.exports = new S3Service();
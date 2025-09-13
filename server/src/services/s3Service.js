const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const fs = require('fs-extra');
const path = require('path');
const { InternalServerError, NotFound } = require('../utils/errors');
const awsConfig = require('../config/awsConfig');

class S3Service {
  constructor() {
    const config = awsConfig.getEnvironmentConfig();
    this.region = config.aws.region;
    this.bucketName = config.aws.s3BucketName;
    
    this.s3Client = new S3Client({ region: this.region });
    
    console.log(`S3 Service initialized: bucket=${this.bucketName}, region=${this.region}`);
  }

  /* Generate S3 key for a file */
  generateS3Key(jobId, filename, type = 'output') {
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `videos/${type}/${jobId}/${sanitizedFilename}`;
  }

  /* Upload file to S3 */
  async uploadFile(filePath, s3Key, contentType = 'video/mp4') {
    try {
      // Check if local file exists
      if (!(await fs.pathExists(filePath))) {
        throw new NotFound(`Local file not found: ${filePath}`);
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
        Metadata: {
          'uploaded-by': 'video-forge',
          'upload-timestamp': new Date().toISOString()
        }
      };

      const command = new PutObjectCommand(uploadParams);
      await this.s3Client.send(command);

      const s3Url = `s3://${this.bucketName}/${s3Key}`;
      console.log(`File uploaded to S3: ${filePath} -> ${s3Url}`);
      
      return s3Url;
    } catch (error) {
      console.error(`S3 upload failed: ${filePath} -> ${s3Key}`, error.message);
      throw new InternalServerError(`Failed to upload file to S3: ${error.message}`);
    }
  }

  /**
   * Upload file buffer to S3
   * @param {Buffer} buffer - File buffer
   * @param {string} s3Key - S3 object key
   * @param {string} contentType - MIME type
   * @returns {Promise<string>} S3 URL
   */
  async uploadBuffer(buffer, s3Key, contentType = 'application/octet-stream') {
    try {
      const uploadParams = {
        Bucket: this.bucketName,
        Key: s3Key,
        Body: buffer,
        ContentType: contentType,
        Metadata: {
          'uploaded-by': 'video-forge',
          'upload-timestamp': new Date().toISOString()
        }
      };

      const command = new PutObjectCommand(uploadParams);
      await this.s3Client.send(command);

      const s3Url = `s3://${this.bucketName}/${s3Key}`;
      console.log(`Buffer uploaded to S3: ${s3Key}`);
      
      return s3Url;
    } catch (error) {
      console.error(`S3 buffer upload failed: ${s3Key}`, error.message);
      throw new InternalServerError(`Failed to upload buffer to S3: ${error.message}`);
    }
  }

  /* Download file from S3 to local path */
  async downloadFile(s3Key, localPath) {
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
          console.log(`File downloaded from S3: ${s3Key} -> ${localPath}`);
          resolve(localPath);
        });
        
        writeStream.on('error', (error) => {
          console.error(`Download write failed: ${s3Key}`, error);
          reject(new InternalServerError(`Failed to write downloaded file: ${error.message}`));
        });
        
        response.Body.on('error', (error) => {
          console.error(`Download stream failed: ${s3Key}`, error);
          reject(new InternalServerError(`Failed to download from S3: ${error.message}`));
        });
      });
    } catch (error) {
      console.error(`S3 download failed: ${s3Key}`, error.message);
      throw new InternalServerError(`Failed to download file from S3: ${error.message}`);
    }
  }

  /* Generate pre-signed URL for file access */
  async getPresignedUrl(s3Key, operation = 'getObject', expiresIn = 3600) {
    try {
      let command;
      
      if (operation === 'putObject') {
        command = new PutObjectCommand({
          Bucket: this.bucketName,
          Key: s3Key
        });
      } else {
        command = new GetObjectCommand({
          Bucket: this.bucketName,
          Key: s3Key
        });
      }

      const presignedUrl = await getSignedUrl(this.s3Client, command, { expiresIn });
      console.log(`Generated pre-signed URL: ${operation} ${s3Key}`);
      
      return presignedUrl;
    } catch (error) {
      console.error(`Failed to generate pre-signed URL: ${s3Key}`, error.message);
      throw new InternalServerError(`Failed to generate pre-signed URL: ${error.message}`);
    }
  }

  /* Delete file from S3 */
  async deleteFile(s3Key) {
    try {
      const deleteParams = {
        Bucket: this.bucketName,
        Key: s3Key
      };

      const command = new DeleteObjectCommand(deleteParams);
      await this.s3Client.send(command);

      console.log(`File deleted from S3: ${s3Key}`);
    } catch (error) {
      console.error(`S3 delete failed: ${s3Key}`, error.message);
      throw new InternalServerError(`Failed to delete file from S3: ${error.message}`);
    }
  }

  /* Check if file exists in S3 */
  async fileExists(s3Key) {
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
      throw new InternalServerError(`Failed to check file existence: ${error.message}`);
    }
  }

  /**
   * Get file metadata from S3
   */
  async getFileMetadata(s3Key) {
    try {
      const headParams = {
        Bucket: this.bucketName,
        Key: s3Key
      };

      const command = new HeadObjectCommand(headParams);
      const response = await this.s3Client.send(command);

      return {
        size: response.ContentLength,
        contentType: response.ContentType,
        lastModified: response.LastModified,
        metadata: response.Metadata
      };
    } catch (error) {
      console.error(`Failed to get S3 metadata: ${s3Key}`, error.message);
      throw new InternalServerError(`Failed to get file metadata: ${error.message}`);
    }
  }

  /**
   * Extract S3 key from S3 URL
   */
  extractS3Key(s3Url) {
    if (s3Url.startsWith('s3://')) {
      return s3Url.replace(`s3://${this.bucketName}/`, '');
    }
    return s3Url;
  }
}

module.exports = new S3Service();
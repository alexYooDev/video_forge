const { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const logger = require('../utils/logger');

class S3Service {
  constructor() {
    this.s3Client = null;
    this.bucketName = process.env.S3_BUCKET_NAME;
    this.region = process.env.AWS_REGION;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    // In Lambda, use the execution role's credentials automatically
    // Only use explicit credentials if running locally
    const s3Config = {
      region: this.region,
      requestChecksumCalculation: 'WHEN_REQUIRED', // Disable automatic checksums
      responseChecksumValidation: 'WHEN_REQUIRED'
    };

    // Only add credentials if explicitly provided (for local development)
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      s3Config.credentials = {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      };
    }

    this.s3Client = new S3Client(s3Config);

    this.initialized = true;
    logger.info('S3 Service initialized', { useExplicitCreds: !!s3Config.credentials });
  }

  async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  generateS3Key(userId, filename) {
    const timestamp = Date.now();
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `gallery/${userId}/${timestamp}-${sanitizedFilename}`;
  }

  async generateUploadUrl(userId, filename, contentType = 'video/mp4') {
    await this.ensureInitialized();

    const s3Key = this.generateS3Key(userId, filename);

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: s3Key,
      ContentType: contentType
      // Don't specify ServerSideEncryption - let bucket default encryption handle it
    });

    const uploadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: 3600
    });

    logger.info('Generated upload URL', { s3Key, userId });

    return {
      uploadUrl,
      s3Key,
      expiresIn: 3600
    };
  }

  async generateStreamUrl(s3Key, expiresIn = 3600) {
    await this.ensureInitialized();

    // Check if file exists
    try {
      const headCommand = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key
      });
      await this.s3Client.send(headCommand);
    } catch (error) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        throw new Error('Video file not found in S3');
      }
      throw error;
    }

    // Generate pre-signed URL
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: s3Key,
      ResponseContentType: 'video/mp4',
      ResponseContentDisposition: 'inline'
    });

    const streamUrl = await getSignedUrl(this.s3Client, command, { expiresIn });

    logger.info('Generated stream URL', { s3Key });

    return streamUrl;
  }

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
      throw error;
    }
  }
}

module.exports = new S3Service();

const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const logger = require('../utils/logger');

class S3Service {
  constructor() {
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'ap-southeast-2'
    });
    this.bucketName = process.env.S3_BUCKET_NAME || 'video-forge-storage';
  }

  async generateStreamUrl(s3Key, expiresIn = 3600) {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
        ResponseContentType: 'video/mp4', // Set appropriate content type
        ResponseCacheControl: 'max-age=31536000' // Cache for 1 year
      });

      const url = await getSignedUrl(this.s3Client, command, { expiresIn });

      logger.info('Generated stream URL', {
        s3Key,
        expiresIn,
        bucket: this.bucketName
      });

      return url;
    } catch (error) {
      logger.error('Error generating stream URL:', error);
      throw new Error(`Failed to generate stream URL: ${error.message}`);
    }
  }

  async generateThumbnailUrl(s3Key, expiresIn = 86400) {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
        ResponseContentType: 'image/jpeg',
        ResponseCacheControl: 'max-age=604800' // Cache for 1 week
      });

      const url = await getSignedUrl(this.s3Client, command, { expiresIn });

      return url;
    } catch (error) {
      logger.error('Error generating thumbnail URL:', error);
      throw new Error(`Failed to generate thumbnail URL: ${error.message}`);
    }
  }
}

module.exports = new S3Service();

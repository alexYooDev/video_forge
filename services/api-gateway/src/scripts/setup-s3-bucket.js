/**
 * Script to create and configure S3 buckets for video storage
 * Run this script to set up development and production S3 buckets
 */

const { S3Client, CreateBucketCommand, PutBucketCorsCommand, PutBucketVersioningCommand, PutBucketLifecycleConfigurationCommand } = require('@aws-sdk/client-s3');

require('dotenv').config({ path: '../../../.env.development' });

class S3BucketSetup {
  constructor() {
    this.region = process.env.AWS_REGION || 'ap-southeast-2';
    this.s3Client = new S3Client({ region: this.region });
    
    this.bucketName = 'video-forge-storage'
  }

  async createBucket(bucketName) {
    try {
      console.log(`Creating S3 bucket: ${bucketName}`);
      
      const createParams = {
        Bucket: bucketName,
        CreateBucketConfiguration: {
          LocationConstraint: this.region
        }
      };

      const command = new CreateBucketCommand(createParams);
      await this.s3Client.send(command);
      
      console.log(`Bucket created successfully: ${bucketName}`);
    } catch (error) {
      if (error.name === 'BucketAlreadyOwnedByYou') {
        console.log(`Bucket already exists: ${bucketName}`);
      } else {
        console.error(`Failed to create bucket ${bucketName}:`, error.message);
        throw error;
      }
    }
  }

  async configureBucketCORS(bucketName) {
    try {
      console.log(`Configuring CORS for bucket: ${bucketName}`);
      
      const corsConfig = {
        Bucket: bucketName,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedHeaders: ['*'],
              AllowedMethods: ['GET', 'PUT', 'POST', 'HEAD'],
              AllowedOrigins: [
                'http://localhost:3000',
                'http://video-forge.cab432.com:3000',
                'https://video-forge.cab432.com'
              ],
              ExposeHeaders: ['ETag'],
              MaxAgeSeconds: 3000
            }
          ]
        }
      };

      const command = new PutBucketCorsCommand(corsConfig);
      await this.s3Client.send(command);
      
      console.log(`CORS configured for: ${bucketName}`);
    } catch (error) {
      console.error(`Failed to configure CORS for ${bucketName}:`, error.message);
    }
  }

  async configureBucketVersioning(bucketName) {
    try {
      console.log(`Enabling versioning for bucket: ${bucketName}`);
      
      const versioningConfig = {
        Bucket: bucketName,
        VersioningConfiguration: {
          Status: 'Enabled'
        }
      };

      const command = new PutBucketVersioningCommand(versioningConfig);
      await this.s3Client.send(command);
      
      console.log(`Versioning enabled for: ${bucketName}`);
    } catch (error) {
      console.error(`Failed to enable versioning for ${bucketName}:`, error.message);
    }
  }

  async configureBucketLifecycle(bucketName) {
    try {
      console.log(`Configuring lifecycle policy for bucket: ${bucketName}`);
      
      const lifecycleConfig = {
        Bucket: bucketName,
        LifecycleConfiguration: {
          Rules: [
            {
              ID: 'VideoProcessingCleanup',
              Status: 'Enabled',
              Filter: {
                Prefix: 'videos/input/'
              },
              Expiration: {
                Days: 7 // Delete input videos after 7 days
              }
            },
            {
              ID: 'TempFileCleanup', 
              Status: 'Enabled',
              Filter: {
                Prefix: 'videos/temp/'
              },
              Expiration: {
                Days: 1 // Delete temp files after 1 day
              }
            }
          ]
        }
      };

      const command = new PutBucketLifecycleConfigurationCommand(lifecycleConfig);
      await this.s3Client.send(command);
      
      console.log(`Lifecycle policy configured for: ${bucketName}`);
    } catch (error) {
      console.error(`Failed to configure lifecycle for ${bucketName}:`, error.message);
    }
  }

  async setupBuckets() {
    console.log('Setting up S3 buckets for Video Forge...');
    console.log(`Region: ${this.region}`);
    
    try {
      await this.createBucket(this.bucketName);
      await this.configureBucketCORS(this.bucketName);
      await this.configureBucketVersioning(this.bucketName);
      await this.configureBucketLifecycle(this.bucketName);
      
      console.log(`Bucket setup completed: ${this.bucketName}`);
    } catch (error) {
      console.error(`Failed to setup bucket ${this.bucketName}:`, error.message);
    }
    
    console.log('\nS3 bucket setup completed!');
    console.log('\nNext steps:');
    console.log('1. Update your environment variables:');
    console.log('S3_BUCKET_NAME=video-forge-storage');
    console.log('2. Ensure your AWS credentials have S3 permissions');
    console.log('3. Test the integration with your application');
  }

  async printBucketInfo() {
    console.log('\nS3 Bucket Information:');
    console.log('======================');
    
    console.log(`\nBucket: ${this.bucketName}`);
    console.log(`Region: ${this.region}`);
    console.log(`URL: s3://${this.bucketName}`);
    console.log(
      `Console: https://s3.console.aws.amazon.com/s3/buckets/${this.bucketName}`
    );

  }
}

// Run setup if this script is executed directly
if (require.main === module) {
  const setup = new S3BucketSetup();
  setup.setupBuckets()
    .then(() => setup.printBucketInfo())
    .catch(console.error);
}

module.exports = S3BucketSetup;
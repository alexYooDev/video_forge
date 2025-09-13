/**
 * Script to setup AWS Parameter Store and Secrets Manager values
 * Run this script after setting up AWS credentials to populate your parameters and secrets
 */

const awsConfig = require('../config/awsConfig');
const { SSMClient, PutParameterCommand } = require('@aws-sdk/client-ssm');
const { SecretsManagerClient, CreateSecretCommand } = require('@aws-sdk/client-secrets-manager');

require('dotenv').config({ path: '../../../.env.development' });

class AWSConfigSetup {
  constructor() {
    const region = process.env.AWS_REGION || 'ap-southeast-2';
    this.ssmClient = new SSMClient({ region });
    this.secretsClient = new SecretsManagerClient({ region });
  }

  async createParameter(name, value, type = 'String') {
    try {
      const command = new PutParameterCommand({
        Name: name,
        Value: value,
        Type: type,
        Overwrite: true
      });
      await this.ssmClient.send(command);
      console.log(`Created parameter: ${name}`);
    } catch (error) {
      console.error(`Failed to create parameter ${name}:`, error.message);
    }
  }

  async createSecret(name, value) {
    try {
      const command = new CreateSecretCommand({
        Name: name,
        SecretString: value
      });
      await this.secretsClient.send(command);
      console.log(`Created secret: ${name}`);
    } catch (error) {
      if (error.name === 'ResourceExistsException') {
        console.log(`Secret already exists: ${name}`);
      } else {
        console.error(`Failed to create secret ${name}:`, error.message);
      }
    }
  }

  async setupConfiguration() {
    console.log('Setting up AWS Parameter Store and Secrets Manager...');

    const mapping = awsConfig.getConfigMapping();

    // Create parameters
    console.log('\nCreating parameters...');
    const parameterValues = {
      '/video-forge/config/app-base-url': process.env.APP_BASE_URL || 'http://localhost:8000',
      '/video-forge/database/postgres-host': process.env.PG_HOST,
      '/video-forge/database/postgres-port': process.env.PG_PORT || '5432',
      '/video-forge/database/postgres-database': process.env.PG_DATABASE,
      '/video-forge/database/postgres-username': process.env.PG_USERNAME,
      '/video-forge/processing/max-concurrent-jobs': process.env.MAX_CONCURRENT_JOBS || '2',
      '/video-forge/config/sample-video-url': process.env.SAMPLE_VIDEO_URL,
      '/video-forge/processing/ffmpeg-threads': process.env.FFMPEG_THREADS || '2',
      '/video-forge/config/log-level': process.env.LOG_LEVEL || 'info'
    };

    for (const [name, value] of Object.entries(parameterValues)) {
      if (value) {
        await this.createParameter(name, value);
      }
    }

    // Create secrets
    console.log('\nCreating secrets...');
    const secretValues = {
      '/video-forge/database/postgres-password': process.env.PG_PASSWORD,
      '/video-forge/auth/jwt-secret': process.env.JWT_SECRET,
      '/video-forge/external-apis/pixabay-key': process.env.PIXABAY_API_KEY
    };

    for (const [name, value] of Object.entries(secretValues)) {
      if (value) {
        await this.createSecret(name, value);
      }
    }

    console.log('\nAWS configuration setup completed!');
    console.log('You can now run your application with AWS configuration enabled.');
  }
}

// Run the setup if this script is executed directly
if (require.main === module) {
  const setup = new AWSConfigSetup();
  setup.setupConfiguration().catch(console.error);
}

module.exports = AWSConfigSetup;
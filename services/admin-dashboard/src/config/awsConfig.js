const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { SSMClient, GetParametersCommand } = require('@aws-sdk/client-ssm');

class AWSConfigService {
  constructor() {
    const region = process.env.AWS_REGION || 'ap-southeast-2';
    this.secretsClient = new SecretsManagerClient({ region });
    this.ssmClient = new SSMClient({ region });
  }

  // Configuration mapping
  getConfigMapping() {
    return {
      // Secrets (sensitive data)
      secrets: {
        PG_PASSWORD: '/video-forge/database/postgres-password',
        COGNITO_CLIENT_SECRET: '/video-forge/auth/cognito-client-secret',
      },

      // Parameters (configuration data)
      parameters: {
        PG_HOST: '/video-forge/database/postgres-host',
        PG_PORT: '/video-forge/database/postgres-port',
        PG_DATABASE: '/video-forge/database/postgres-database',
        PG_USERNAME: '/video-forge/database/postgres-username',
        S3_BUCKET_NAME: '/video-forge/config/s3-bucket-name',
        COGNITO_USER_POOL_ID: '/video-forge/auth/cognito-user-pool-id',
        COGNITO_CLIENT_ID: '/video-forge/auth/cognito-client-id',
        SQS_QUEUE_URL: '/video-forge/processing/sqs-queue-url',
      },
    };
  }

  async getSecret(secretPath) {
    try {
      const command = new GetSecretValueCommand({ SecretId: secretPath });
      const response = await this.secretsClient.send(command);
      const secretString = response.SecretString || Buffer.from(response.SecretBinary).toString();

      // Handle JSON secrets
      try {
        const parsed = JSON.parse(secretString);
        const keys = Object.keys(parsed);
        if (keys.length === 1) {
          return parsed[keys[0]];
        }
        return parsed;
      } catch {
        return secretString;
      }
    } catch (error) {
      console.error(`Failed to get secret ${secretPath}:`, error.message);
      return null;
    }
  }

  async getParameters(parameterPaths) {
    try {
      const command = new GetParametersCommand({
        Names: parameterPaths,
        WithDecryption: true
      });
      const response = await this.ssmClient.send(command);

      const result = {};
      response.Parameters.forEach(param => {
        result[param.Name] = param.Value;
      });

      return result;
    } catch (error) {
      console.error('Failed to get parameters:', error.message);
      return {};
    }
  }

  async loadConfiguration() {
    console.log('Loading AWS configuration for admin-dashboard...');

    const mapping = this.getConfigMapping();
    const config = {};

    try {
      // Load secrets
      for (const [envVar, secretPath] of Object.entries(mapping.secrets)) {
        const secretValue = await this.getSecret(secretPath);
        config[envVar] = secretValue || process.env[envVar];
        console.log(`Loaded secret ${envVar}: ${config[envVar] ? 'SUCCESS' : 'FAILED'}`);
      }

      // Load parameters in batches (AWS limit: 10 per batch)
      const paramPaths = Object.values(mapping.parameters);
      const parameters = {};

      for (let i = 0; i < paramPaths.length; i += 10) {
        const batch = paramPaths.slice(i, i + 10);
        const batchResults = await this.getParameters(batch);
        Object.assign(parameters, batchResults);
      }

      // Map back to environment variables
      for (const [envVar, paramPath] of Object.entries(mapping.parameters)) {
        config[envVar] = parameters[paramPath] || process.env[envVar];
        console.log(`Loaded parameter ${envVar}: ${config[envVar] ? 'SUCCESS' : 'FAILED'}`);
      }

      console.log(`AWS configuration loaded: ${Object.keys(config).length} items`);
      return config;
    } catch (error) {
      console.error('AWS configuration load failed:', error.message);
      return {};
    }
  }

  // Apply configuration to process.env
  applyToEnvironment(config) {
    Object.entries(config).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        process.env[key] = String(value);
        const maskedValue = key.includes('PASSWORD') || key.includes('SECRET') ? '***' : value;
        console.log(`Set environment variable ${key}: ${maskedValue}`);
      }
    });
  }

  // Get environment-specific configuration
  async getEnvironmentConfig() {
    let config = {};
    try {
      config = await this.loadConfiguration();
    } catch (error) {
      console.log('Failed to load AWS config, using environment variables');
    }

    return {
      environment: process.env.NODE_ENV || 'development',
      aws: {
        region: process.env.AWS_REGION || 'ap-southeast-2',
        s3BucketName: config.S3_BUCKET_NAME || process.env.S3_BUCKET_NAME || 'video-forge-storage',
        cognitoUserPoolId: config.COGNITO_USER_POOL_ID || process.env.COGNITO_USER_POOL_ID,
        cognitoClientId: config.COGNITO_CLIENT_ID || process.env.COGNITO_CLIENT_ID,
        sqsQueueUrl: config.SQS_QUEUE_URL || process.env.SQS_QUEUE_URL
      },
      database: {
        host: config.PG_HOST || process.env.PG_HOST,
        port: parseInt(config.PG_PORT || process.env.PG_PORT || '5432'),
        database: config.PG_DATABASE || process.env.PG_DATABASE,
        username: config.PG_USERNAME || process.env.PG_USERNAME,
        password: config.PG_PASSWORD || process.env.PG_PASSWORD
      }
    };
  }
}

module.exports = new AWSConfigService();

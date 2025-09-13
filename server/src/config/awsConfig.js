const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { SSMClient, GetParametersCommand } = require('@aws-sdk/client-ssm');

class AWSConfigService {
  constructor() {
    const region = process.env.AWS_REGION || 'ap-southeast-2';
    this.secretsClient = new SecretsManagerClient({ region });
    this.ssmClient = new SSMClient({ region });
  }

  // Configuration mapping - much cleaner than hardcoding everywhere
  getConfigMapping() {
    return {
      // Secrets (sensitive data)
      secrets: {
        'PG_PASSWORD': '/video-forge/database/postgres-password',
        'JWT_SECRET': '/video-forge/auth/jwt-secret',
        'PIXABAY_API_KEY': '/video-forge/external-apis/pixabay-key'
      },
      
      // Parameters (configuration data)
      parameters: {
        'APP_BASE_URL': '/video-forge/config/app-base-url',
        'PG_HOST': '/video-forge/database/postgres-host',
        'PG_PORT': '/video-forge/database/postgres-port',
        'PG_DATABASE': '/video-forge/database/postgres-database',
        'PG_USERNAME': '/video-forge/database/postgres-username',
        'MAX_CONCURRENT_JOBS': '/video-forge/processing/max-concurrent-jobs',
        'SAMPLE_VIDEO_URL': '/video-forge/config/sample-video-url',
        'FFMPEG_THREADS': '/video-forge/processing/ffmpeg-threads',
        'LOG_LEVEL': '/video-forge/config/log-level',
        'S3_BUCKET_NAME': '/video-forge/storage/s3-bucket-name'
      }
    };
  }

  async getSecret(secretPath) {
    try {
      const command = new GetSecretValueCommand({ SecretId: secretPath });
      const response = await this.secretsClient.send(command);
      return response.SecretString || Buffer.from(response.SecretBinary).toString();
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
    console.log('Loading AWS configuration...');
    
    const mapping = this.getConfigMapping();
    const config = {};

    try {
      // Load secrets
      for (const [envVar, secretPath] of Object.entries(mapping.secrets)) {
        config[envVar] = await this.getSecret(secretPath);
      }

      // Load parameters in batch
      const paramPaths = Object.values(mapping.parameters);
      const parameters = await this.getParameters(paramPaths);
      
      // Map back to environment variables
      for (const [envVar, paramPath] of Object.entries(mapping.parameters)) {
        config[envVar] = parameters[paramPath];
      }

      console.log(`Loaded ${Object.keys(config).length} configuration values from AWS`);
      return config;
    } catch (error) {
      console.error('AWS configuration load failed:', error.message);
      throw error;
    }
  }

  // Apply configuration to process.env
  applyToEnvironment(config) {
    Object.entries(config).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        process.env[key] = String(value);
      }
    });
  }

  // Environment-specific helpers
  isDevelopment() {
    return process.env.NODE_ENV === 'development';
  }

  isProduction() {
    return process.env.NODE_ENV === 'production';
  }

  // Get environment-specific S3 bucket name
  getS3BucketName() {
    const envBucket = process.env.S3_BUCKET_NAME;
    if (envBucket) return envBucket;
    
    return this.isProduction() ? 'video-forge-storage-prod' : 'video-forge-storage-dev';
  }

  // Get environment-specific configuration
  getEnvironmentConfig() {
    return {
      environment: process.env.NODE_ENV || 'development',
      isDevelopment: this.isDevelopment(),
      isProduction: this.isProduction(),
      server: {
        port: parseInt(process.env.SERVER_PORT || '8000'),
        host: process.env.SERVER_HOST || (this.isDevelopment() ? 'localhost' : 'video-forge.cab432.com')
      },
      database: {
        host: process.env.PG_HOST,
        port: parseInt(process.env.PG_PORT || '5432'),
        database: process.env.PG_DATABASE,
        username: process.env.PG_USERNAME,
        password: process.env.PG_PASSWORD
      },
      aws: {
        region: process.env.AWS_REGION || 'ap-southeast-2',
        s3BucketName: this.getS3BucketName(),
        cognitoUserPoolId: process.env.COGNITO_USER_POOL_ID,
        cognitoClientId: process.env.COGNITO_CLIENT_ID
      },
      features: {
        logLevel: this.isDevelopment() ? 'debug' : 'info',
        enableHotReload: this.isDevelopment()
      }
    };
  }

  // Get database configuration for Sequelize
  getDatabaseConfig() {
    return {
      host: process.env.PG_HOST,
      port: parseInt(process.env.PG_PORT || '5432'),
      database: process.env.PG_DATABASE,
      username: process.env.PG_USERNAME,
      password: process.env.PG_PASSWORD,
      dialect: 'postgres',
      logging: this.isDevelopment() ? console.log : false,
      pool: {
        max: this.isDevelopment() ? 5 : 10,
        min: 0,
        acquire: 30000,
        idle: 10000
      },
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      }
    };
  }

  // Get CORS origins based on environment
  getCorsOrigins() {
    if (this.isDevelopment()) {
      return [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:8000',
        'http://127.0.0.1:8000'
      ];
    }

    return [
      'https://video-forge.cab432.com',
      'http://video-forge.cab432.com:3000',
      'http://video-forge.cab432.com:8000'
    ];
  }
}

module.exports = new AWSConfigService();
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { SSMClient, GetParametersCommand } = require('@aws-sdk/client-ssm');
const { apiLogger } = require('../utils/logger');

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
        PG_PASSWORD: '/video-forge/database/postgres-password',
        JWT_SECRET: '/video-forge/auth/jwt-secret',
        PIXABAY_API_KEY: '/video-forge/external-apis/pixabay-key',
        COGNITO_CLIENT_SECRET: '/video-forge/auth/cognito-client-secret',
      },

      // Parameters (configuration data)
      parameters: {
        APP_BASE_URL: '/video-forge/config/app-base-url',
        PG_HOST: '/video-forge/database/postgres-host',
        PG_PORT: '/video-forge/database/postgres-port',
        PG_DATABASE: '/video-forge/database/postgres-database',
        PG_USERNAME: '/video-forge/database/postgres-username',
        MAX_CONCURRENT_JOBS: '/video-forge/processing/max-concurrent-jobs',
        SAMPLE_VIDEO_URL: '/video-forge/config/sample-video-url',
        FFMPEG_THREADS: '/video-forge/processing/ffmpeg-threads',
        LOG_LEVEL: '/video-forge/config/log-level',
        S3_BUCKET_NAME: '/video-forge/config/s3-bucket-name',
        COGNITO_USER_POOL_ID: '/video-forge/auth/cognito-user-pool-id',
        COGNITO_CLIENT_ID: '/video-forge/auth/cognito-client-id',
        REDIS_HOST: '/video-forge/cache/redis-host',
        REDIS_PORT: '/video-forge/cache/redis-port',
        CACHE_ENABLED: '/video-forge/cache/enabled',
        SQS_POLLING_INTERVAL: '/video-forge/processing/sqs-polling-interval',
      },
    };
  }

  async getSecret(secretPath) {
    try {
      const command = new GetSecretValueCommand({ SecretId: secretPath });
      const response = await this.secretsClient.send(command);
      const secretString = response.SecretString || Buffer.from(response.SecretBinary).toString();

      // Handle JSON secrets (like those created by AWS console)
      try {
        const parsed = JSON.parse(secretString);
        // If it's a JSON object with a single key matching the secret name, return the value
        const keys = Object.keys(parsed);
        if (keys.length === 1) {
          return parsed[keys[0]];
        }
        return parsed;
      } catch {
        // Not JSON, return as-is
        return secretString;
      }
    } catch (error) {
      apiLogger.systemError('Failed to get secret', error, { secretPath });
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
      apiLogger.systemError('Failed to get parameters', error);
      return {};
    }
  }


  async loadConfiguration() {
    apiLogger.system('Loading AWS configuration');

    const mapping = this.getConfigMapping();
    const config = {};

    try {
      // Load secrets
      for (const [envVar, secretPath] of Object.entries(mapping.secrets)) {
        const secretValue = await this.getSecret(secretPath);
        config[envVar] = secretValue || process.env[envVar]; // Fall back to env var
        apiLogger.system('Loaded secret', { envVar, status: config[envVar] ? 'SUCCESS' : 'FAILED' });
        if (envVar.includes('COGNITO') && secretValue) {
          apiLogger.system('Cognito secret loaded', { envVar, secretPath });
        }
      }

      // Load parameters in batches (AWS limit: 10 per batch)
      const paramPaths = Object.values(mapping.parameters);
      const parameters = {};

      // Split into batches of 10
      for (let i = 0; i < paramPaths.length; i += 10) {
        const batch = paramPaths.slice(i, i + 10);
        const batchResults = await this.getParameters(batch);
        Object.assign(parameters, batchResults);
      }

      // Map back to environment variables with fallback
      for (const [envVar, paramPath] of Object.entries(mapping.parameters)) {
        config[envVar] = parameters[paramPath] || process.env[envVar]; // Fall back to env var
        apiLogger.system('Loaded parameter', { envVar, status: config[envVar] ? 'SUCCESS' : 'FAILED' });
        if (envVar.includes('COGNITO') && parameters[paramPath]) {
          apiLogger.system('Cognito parameter loaded', { envVar, paramPath });
        }
      }

      apiLogger.system('AWS configuration loaded', { count: Object.keys(config).length });
      return config;
    } catch (error) {
      apiLogger.systemError('AWS configuration load failed', error);
      // Return env vars as fallback instead of throwing
      return {};
    }
  }

  // Apply configuration to process.env
  applyToEnvironment(config) {
    Object.entries(config).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        process.env[key] = String(value);
        const maskedValue = key.includes('PASSWORD') || key.includes('SECRET') ? '***' : value;
        apiLogger.system('Set environment variable', { key, value: maskedValue });
      } else {
        apiLogger.system('Skipped environment variable', { key, reason: 'null/undefined' });
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
  async getS3BucketName() {
    const config = await this.loadConfiguration();
    return config.S3_BUCKET_NAME || 'video-forge-storage';
  }

  // Get environment-specific configuration
  async getEnvironmentConfig() {
    // Try to load configuration from AWS, fall back to env vars on failure
    let config = {};
    try {
      config = await this.loadConfiguration();
    } catch (error) {
      apiLogger.system('Failed to load AWS config, using environment variables', { error: error.message });
    }

    return {
      environment: process.env.NODE_ENV || 'development',
      isDevelopment: this.isDevelopment(),
      isProduction: this.isProduction(),
      server: {
        port: parseInt(process.env.SERVER_PORT || '8000'),
        host: process.env.SERVER_HOST || (this.isDevelopment() ? 'localhost' : 'video-forge.cab432.com')
      },
      database: {
        host: config.PG_HOST || process.env.PG_HOST || process.env.DB_HOST,
        port: parseInt(config.PG_PORT || process.env.PG_PORT || process.env.DB_PORT || '5432'),
        database: config.PG_DATABASE || process.env.PG_DATABASE || process.env.DB_NAME,
        username: config.PG_USERNAME || process.env.PG_USERNAME || process.env.DB_USER,
        password: config.PG_PASSWORD || process.env.PG_PASSWORD || process.env.DB_PASSWORD
      },
      aws: {
        region: process.env.AWS_REGION || 'ap-southeast-2',
        s3BucketName: config.S3_BUCKET_NAME || process.env.S3_BUCKET_NAME || 'video-forge-storage',
        cognitoUserPoolId: config.COGNITO_USER_POOL_ID || process.env.COGNITO_USER_POOL_ID,
        cognitoClientId: config.COGNITO_CLIENT_ID || process.env.COGNITO_CLIENT_ID,
        cognitoClientSecret: config.COGNITO_CLIENT_SECRET || process.env.COGNITO_CLIENT_SECRET
      },
      app: {
        baseUrl: config.APP_BASE_URL || process.env.APP_BASE_URL || 'http://localhost:8000'
      },
      features: {
        logLevel: config.LOG_LEVEL || process.env.LOG_LEVEL || (this.isDevelopment() ? 'debug' : 'info'),
        enableHotReload: this.isDevelopment()
      }
    };
  }

  // Get database configuration for Sequelize
  async getDatabaseConfig() {
    // Try to load configuration from AWS, fall back to env vars on failure
    let awsConfig = {};
    try {
      awsConfig = await this.loadConfiguration();
    } catch (error) {
      apiLogger.system('Failed to load AWS config for database, using environment variables', { error: error.message });
    }

    const config = {
      host: awsConfig.PG_HOST || process.env.PG_HOST || process.env.DB_HOST,
      port: parseInt(awsConfig.PG_PORT || process.env.PG_PORT || process.env.DB_PORT || '5432'),
      database: awsConfig.PG_DATABASE || process.env.PG_DATABASE || process.env.DB_NAME,
      username: awsConfig.PG_USERNAME || process.env.PG_USERNAME || process.env.DB_USER,
      password: awsConfig.PG_PASSWORD || process.env.PG_PASSWORD || process.env.DB_PASSWORD,
      dialect: 'postgres',
      logging: this.isDevelopment() ? (msg) => apiLogger.db(msg) : false,
      pool: {
        max: this.isDevelopment() ? 5 : 5, // Reduced to prevent connection limit issues
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

    apiLogger.db('Database config loaded', {
      host: config.host,
      port: config.port,
      database: config.database,
      username: config.username,
      password: config.password ? '***' : 'MISSING'
    });

    return config;
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
      'http://video-forge.cab432.com:8000',
      'd-0ifaa0s8t7.execute-api.ap-southeast-2.amazonaws.com/prod',
    ];
  }
}

module.exports = new AWSConfigService();
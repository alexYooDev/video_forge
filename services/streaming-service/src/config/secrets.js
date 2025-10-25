const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const logger = require('../utils/logger');

const client = new SecretsManagerClient({ region: process.env.AWS_REGION || 'ap-southeast-2' });

// Cache for secrets to avoid repeated API calls
const secretCache = {};

async function getSecret(secretArn) {
  if (!secretArn) {
    throw new Error('Secret ARN is required');
  }

  // Return cached value if available
  if (secretCache[secretArn]) {
    return secretCache[secretArn];
  }

  try {
    const command = new GetSecretValueCommand({ SecretId: secretArn });
    const response = await client.send(command);

    const secret = JSON.parse(response.SecretString);

    // Cache the secret
    secretCache[secretArn] = secret;

    logger.info(`Successfully fetched secret: ${secretArn}`);
    return secret;
  } catch (error) {
    logger.error(`Failed to fetch secret ${secretArn}:`, error);
    throw error;
  }
}

async function getDatabaseCredentials() {
  const secretArn = process.env.DB_SECRET_ARN;

  if (!secretArn) {
    logger.warn('DB_SECRET_ARN not configured, falling back to DB_PASSWORD env var');
    return { password: process.env.DB_PASSWORD };
  }

  const secret = await getSecret(secretArn);
  return {
    password: secret.PG_PASSWORD || secret.password
  };
}

async function getJwtSecret() {
  const secretArn = process.env.JWT_SECRET_ARN;

  if (!secretArn) {
    logger.warn('JWT_SECRET_ARN not configured, falling back to JWT_SECRET env var');
    return process.env.JWT_SECRET;
  }

  const secret = await getSecret(secretArn);
  return secret.JWT_SECRET || secret.secret || secret.value;
}

module.exports = {
  getSecret,
  getDatabaseCredentials,
  getJwtSecret
};

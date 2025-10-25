const { CognitoJwtVerifier } = require('aws-jwt-verify');
const logger = require('../utils/logger');

// Create verifier - will use environment variables loaded from .env files
const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.COGNITO_USER_POOL_ID,
  tokenUse: 'id', // Accept ID tokens (client sends idToken, not accessToken)
  clientId: process.env.COGNITO_CLIENT_ID
});

async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const payload = await verifier.verify(token);

    req.user = payload;
    next();
  } catch (error) {
    logger.error('Authentication failed:', error);
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const payload = await verifier.verify(token);
      req.user = payload;
    }

    next();
  } catch (error) {
    logger.warn('Optional auth failed, continuing without user:', error.message);
    next();
  }
}

module.exports = { authenticate, optionalAuth };

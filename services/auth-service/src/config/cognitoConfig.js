const AWS = require('aws-sdk');

const cognitoConfig = {
  userPoolId: process.env.COGNITO_USER_POOL_ID || 'ap-southeast-2_jft50FBre',
  clientId: process.env.COGNITO_CLIENT_ID || '59ff9f0j33qp7al3vje4j4isc0',
  region: process.env.AWS_REGION || 'ap-southeast-2'
};

// Initialize Cognito Identity Provider
const cognito = new AWS.CognitoIdentityServiceProvider({
  region: cognitoConfig.region
});

module.exports = {
  cognitoConfig,
  cognito
};

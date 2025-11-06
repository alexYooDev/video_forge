const jwtConfig = {
  secret: process.env.JWT_SECRET || 'v8CH5wbdp9iPJHyBXQA2a8ALW58QJ9Ek',
  expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
};

module.exports = jwtConfig;

/**
 * Optional Authentication Middleware
 * Allows both authenticated and anonymous access
 * Used for public videos vs private videos
 */

const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);

    try {
      // In production, verify JWT token with Cognito
      // For now, just extract user info from token
      // const decoded = jwt.verify(token, process.env.JWT_SECRET);
      // req.user = decoded;

      // Mock user for development
      req.user = { sub: 'user123' };
    } catch (error) {
      // Invalid token, treat as anonymous
      req.user = null;
    }
  } else {
    // No token, anonymous access
    req.user = null;
  }

  next();
};

module.exports = {
  optionalAuth
};

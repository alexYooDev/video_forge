
const authService = require('../services/authService');
const cognitoService = require('../services/cognitoService');

// Cognito-only authentication middleware
const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer')) {
            return res.status(401).json({message: "Access token required"});
        }

        const token = authHeader.split(' ')[1];

        // Use Cognito token verification with permissions
        const decoded = await cognitoService.verifyTokenWithPermissions(token);

        // Ensure user exists in local database for Cognito users
        await authService.ensureUserExists(decoded);

        req.user = decoded;
        next();
    } catch(err) {
        return res.status(401).json({message: err.message});
    }
}

const requireAdmin = async (req, res, next) => {
    try {
        if (!req.user || req.user.role !== 'admin') {
            return res.status(403).json({message: "Admin access required"});
        }
        next();
    } catch(err) {
        return res.status(500).json({message: "Authorization error"});
    }
}

const requireAuth = (role = null) => {
    return [
        authenticate,
        ...(role === 'admin' ? [requireAdmin] : [])
    ];
}

module.exports = {
    authenticate,
    requireAdmin,
    requireAuth
}

const authService = require('../services/authService');
const cognitoService = require('../services/cognitoService');

// KISS: Simple helper to check if Cognito is configured
const useCognito = !!(process.env.COGNITO_USER_POOL_ID && process.env.COGNITO_CLIENT_ID);

const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer')) {
            return res.status(401).json({message: "Access token required"});
        }

        const token = authHeader.split(' ')[1];

        // DRY: Single pattern for token verification with group claims
        let decoded;
        if (useCognito) {
            try {
                decoded = await cognitoService.verifyTokenWithPermissions(token);
            } catch (cognitoError) {
                decoded = authService.verifyToken(token);
            }
        } else {
            decoded = authService.verifyToken(token);
        }

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
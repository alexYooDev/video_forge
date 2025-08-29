
const authService = require('../services/authService');

const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer')) {
            return res.status(401).json({message: "Access token required"});
        }

        const token = authHeader.split(' ')[1];

        const decoded = authService.verifyToken(token);

        req.user = decoded;
        next();
    } catch(err) {
        return res.status(401).json({message: err.message});
    }
}

module.exports = {
    authenticate
}
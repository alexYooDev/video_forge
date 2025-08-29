const jwt = require('jsonwebtoken');

export function requestAuth (req, res, next) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
        return res.status(401).json({success: false, error: 'Token not found!'});
    }

    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch (err) {
        res.status(401).json({error: 'Invalid Token'});
    }
}
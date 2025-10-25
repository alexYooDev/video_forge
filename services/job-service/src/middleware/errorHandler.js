const createError = require('http-errors');

const errorHandler = (err, req, res, next) => {
    console.error('Error:', err.stack);

    // http-errors already has status and statusCode properties
    let status = err.statusCode || err.status || 500;
    let message = err.message || 'Internal server error';

    // Handle http-errors instances
    if (createError.isHttpError(err)) {
        status = err.statusCode;
        message = err.message;
    } else if (err.name === 'ValidationError') {
        // Handle Joi validation errors or similar
        status = 400;
        message = err.message || 'Validation failed';
    } else if (err.code === 'ENOENT') {
        // File not found errors
        status = 404;
        message = 'Resource not found';
    } else if (err.code === 'EACCES') {
        // Permission errors
        status = 403;
        message = 'Permission denied';
    } else {
        // For other errors, try to infer status from message
        const msg = err.message.toLowerCase();
        if (msg.includes('invalid') || msg.includes('required') || msg.includes('validation')) {
            status = 400;
        } else if (msg.includes('not found')) {
            status = 404;
        } else if (msg.includes('unauthorized') || msg.includes('token') || msg.includes('authentication')) {
            status = 401;
        } else if (msg.includes('forbidden') || msg.includes('permission') || msg.includes('access')) {
            status = 403;
        } else if (msg.includes('already exists') || msg.includes('duplicate')) {
            status = 409;
        }
    }

    // Don't expose internal error details in production
    if (process.env.NODE_ENV === 'production' && status >= 500) {
        message = 'Internal server error';
    }

    res.status(status).json({
        success: false,
        message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
};

module.exports = errorHandler;
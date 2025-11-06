const createError = require('http-errors');

// Re-export http-errors for convenience
module.exports = {
    createError,
    BadRequest: (message = 'Bad Request') => createError(400, message),
    Unauthorized: (message = 'Unauthorized') => createError(401, message),
    Forbidden: (message = 'Forbidden') => createError(403, message),
    NotFound: (message = 'Not Found') => createError(404, message),
    Conflict: (message = 'Conflict') => createError(409, message),
    UnprocessableEntity: (message = 'Unprocessable Entity') => createError(422, message),
    InternalServerError: (message = 'Internal Server Error') => createError(500, message),
    
    // Aliases for backward compatibility
    ValidationError: (message = 'Validation failed') => createError(400, message),
    NotFoundError: (message = 'Resource not found') => createError(404, message),
    UnauthorizedError: (message = 'Unauthorized') => createError(401, message),
    ForbiddenError: (message = 'Forbidden') => createError(403, message),
    ConflictError: (message = 'Resource already exists') => createError(409, message)
};
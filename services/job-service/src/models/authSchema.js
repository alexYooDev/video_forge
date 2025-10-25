const Joi = require('joi');

const registerSchema = Joi.object({
    username: Joi.string().min(3).max(30).required().messages({
        'string.min': 'Username must be at least 3 characters long',
        'string.max': 'Username must be no more than 30 characters long',
        'any.required': 'Username is required'
    }),
    email: Joi.string().email().required().messages({
        'string.email': 'Please provide a valid address',
        'any.required': 'Email is required'
    }),
    password: Joi.string().min(6).required().messages({
        'string.min': 'Password must be at least 6 characters long',
        'any.required': 'Password is required'
    })
});

const loginSchema = Joi.object({
    username: Joi.string().min(3).max(30).required().messages({
        'string.min': 'Username must be at least 3 characters long',
        'string.max': 'Username must be no more than 30 characters long',
        'any.required': 'Username is required'
    }),
    password: Joi.string().min(6).required().messages({
        'string.min': 'Password must be at least 6 characters long',
        'any.required': 'Password is required'
    })
});

module.exports = {
    registerSchema,
    loginSchema
};


const Joi = require('joi');

const authSchema = Joi.object({
    email: Joi.string().email().required().messages({
        'string.email': 'Please provide a valid address',
        'any.required': 'Email is required'
    }),
    password: Joi.string().min(6).required().messages({
        'string.min': 'Passwrod must be at least 6 characters long',
        'any.required': 'Password is required'
    })
});

module.exports = authSchema;


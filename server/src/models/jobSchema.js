const Joi = require('joi');

const jobSchema = Joi.object({
        inputSource: Joi.string().uri().required().messages({
            'string.uri': 'Input source must be a valid URL',
            'any.required': 'Input source is required'
        }),
        outputFormats: Joi.array().items(
            Joi.string().valid('1080p','720p','480p','gif')
        ).min(1).default(['720p'])
    });

module.exports = jobSchema;
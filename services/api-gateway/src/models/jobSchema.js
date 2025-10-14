const Joi = require('joi');
const { SUPPORTED_FORMATS } = require('../utils/constants');

const jobSchema = Joi.object({
  inputSource: Joi.alternatives()
    .try(
      Joi.string().uri(), // url
      Joi.string().pattern(/^local-sample\.(mp4|mov|avi)$/i), // Local sample files
      Joi.string().pattern(/^videos\//) // S3 keys (videos/uploads/* or videos/output/*)
    )
    .required()
    .messages({
      'alternatives.match': 'Input source must be a valid URL or S3 key',
      'any.required': 'Input source is required',
    }),
  outputFormats: Joi.array()
    .items(Joi.string().valid(...SUPPORTED_FORMATS))
    .min(1)
    .default(['720p'])
    .messages({
      'array.min': 'At least one output format is required',
    }),
  title: Joi.string()
    .max(255)
    .optional()
    .allow(''),
  description: Joi.string()
    .max(500)
    .optional()
    .allow(''),
  visibility: Joi.string()
    .valid('public', 'private')
    .default('public')
    .optional(),
});

module.exports = jobSchema;
const Joi = require('joi');
const { SUPPORTED_FORMATS } = require('../utils/constants');

const jobSchema = Joi.object({
  inputSource: Joi.alternatives()
    .try(
      Joi.string().uri(), // url
      Joi.string().pattern(/^local-sample\.(mp4|mov|avi)$/i) // Local sample files
    )
    .required()
    .messages({
      'string.uri': 'Input source must be a valid URL',
      'any.required': 'Input source is required',
    }),
  outputFormats: Joi.array()
    .items(Joi.string().valid(...SUPPORTED_FORMATS))
    .min(1)
    .default(['720p'])
    .messages({
      'array.min': 'At least one output format is required',
    }),
});

module.exports = jobSchema;
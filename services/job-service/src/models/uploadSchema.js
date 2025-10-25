const Joi = require('joi');

const uploadUrlSchema = Joi.object({
  filename: Joi.string().required(),
  contentType: Joi.string().default('video/mp4'),
  metadata: Joi.object().default({})
});

module.exports = uploadUrlSchema;

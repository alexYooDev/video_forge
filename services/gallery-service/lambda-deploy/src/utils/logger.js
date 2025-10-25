const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          let metaStr = '';
          if (Object.keys(meta).length) {
            try {
              // Handle circular references safely
              metaStr = JSON.stringify(meta, (key, value) => {
                if (value instanceof Error) {
                  return { message: value.message, stack: value.stack };
                }
                // Skip circular references
                if (typeof value === 'object' && value !== null) {
                  if (value.constructor?.name === 'TLSSocket' ||
                      value.constructor?.name === 'ClientRequest') {
                    return '[Circular]';
                  }
                }
                return value;
              });
            } catch (err) {
              metaStr = '[Unable to stringify metadata]';
            }
          }
          return `${timestamp} [${level}]: ${message} ${metaStr}`;
        })
      )
    })
  ]
});

module.exports = logger;

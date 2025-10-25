/**
 * Structured logging utility for better log readability
 */

const LOG_LEVELS = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR'
};

const LOG_CATEGORIES = {
  JOB: '[JOB]',
  SQS: '[SQS]',
  DB: '[DB]',
  AUTH: '[AUTH]',
  CACHE: '[CACHE]',
  S3: '[S3]',
  API: '[API]',
  SYSTEM: '[SYSTEM]'
};

class Logger {
  constructor(service = 'API-Gateway') {
    this.service = service;
    this.logLevel = process.env.LOG_LEVEL || 'INFO';
  }

  _shouldLog(level) {
    const levels = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
    return levels.indexOf(level) >= levels.indexOf(this.logLevel);
  }

  _formatMessage(category, level, message, context = {}) {
    const timestamp = new Date().toISOString();
    const contextStr = Object.keys(context).length > 0
      ? ` | ${JSON.stringify(context)}`
      : '';

    return `[${timestamp}] ${category.padEnd(10)} [${level.padEnd(5)}] ${message}${contextStr}`;
  }

  _log(category, level, message, context) {
    if (!this._shouldLog(level)) return;

    const formatted = this._formatMessage(category, level, message, context);

    if (level === 'ERROR') {
      console.error(formatted);
    } else if (level === 'WARN') {
      console.warn(formatted);
    } else {
      console.log(formatted);
    }
  }

  // Job-related logs
  job(message, context) {
    this._log(LOG_CATEGORIES.JOB, LOG_LEVELS.INFO, message, context);
  }

  jobDebug(message, context) {
    this._log(LOG_CATEGORIES.JOB, LOG_LEVELS.DEBUG, message, context);
  }

  jobError(message, error, context) {
    this._log(LOG_CATEGORIES.JOB, LOG_LEVELS.ERROR, message, {
      ...context,
      error: error?.message || error
    });
  }

  // SQS-related logs
  sqs(message, context) {
    this._log(LOG_CATEGORIES.SQS, LOG_LEVELS.INFO, message, context);
  }

  sqsError(message, error, context) {
    this._log(LOG_CATEGORIES.SQS, LOG_LEVELS.ERROR, message, {
      ...context,
      error: error?.message || error
    });
  }

  // Database logs
  db(message, context) {
    this._log(LOG_CATEGORIES.DB, LOG_LEVELS.DEBUG, message, context);
  }

  // Auth logs
  auth(message, context) {
    this._log(LOG_CATEGORIES.AUTH, LOG_LEVELS.INFO, message, context);
  }

  authDebug(message, context) {
    this._log(LOG_CATEGORIES.AUTH, LOG_LEVELS.DEBUG, message, context);
  }

  // Cache logs
  cache(message, context) {
    this._log(LOG_CATEGORIES.CACHE, LOG_LEVELS.DEBUG, message, context);
  }

  cacheHit(key) {
    this._log(LOG_CATEGORIES.CACHE, LOG_LEVELS.DEBUG, 'Cache HIT', { key });
  }

  cacheMiss(key) {
    this._log(LOG_CATEGORIES.CACHE, LOG_LEVELS.DEBUG, 'Cache MISS', { key });
  }

  // S3 logs
  s3(message, context) {
    this._log(LOG_CATEGORIES.S3, LOG_LEVELS.INFO, message, context);
  }

  // API logs
  api(message, context) {
    this._log(LOG_CATEGORIES.API, LOG_LEVELS.INFO, message, context);
  }

  // System logs
  system(message, context) {
    this._log(LOG_CATEGORIES.SYSTEM, LOG_LEVELS.INFO, message, context);
  }

  systemError(message, error, context) {
    this._log(LOG_CATEGORIES.SYSTEM, LOG_LEVELS.ERROR, message, {
      ...context,
      error: error?.message || error
    });
  }

  // Generic logs
  info(message, context) {
    this._log(LOG_CATEGORIES.SYSTEM, LOG_LEVELS.INFO, message, context);
  }

  debug(message, context) {
    this._log(LOG_CATEGORIES.SYSTEM, LOG_LEVELS.DEBUG, message, context);
  }

  warn(message, context) {
    this._log(LOG_CATEGORIES.SYSTEM, LOG_LEVELS.WARN, message, context);
  }

  error(message, error, context) {
    this._log(LOG_CATEGORIES.SYSTEM, LOG_LEVELS.ERROR, message, {
      ...context,
      error: error?.message || error
    });
  }

  // Separator for visual clarity
  separator(label = '') {
    const line = '='.repeat(100);
    if (label) {
      console.log(`\n${line}\n  ${label.toUpperCase()}\n${line}`);
    } else {
      console.log(line);
    }
  }
}

// Export singleton instances for each service
const apiLogger = new Logger('Job-Service');
const processorLogger = new Logger('Video-Processor');

module.exports = {
  Logger,
  apiLogger,
  processorLogger,
  LOG_LEVELS,
  LOG_CATEGORIES
};

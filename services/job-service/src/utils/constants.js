const JOB_STATUS = {
  PENDING: 'PENDING',
  DOWNLOADING: 'DOWNLOADING',
  PROCESSING: 'PROCESSING',
  UPLOADING: 'UPLOADING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
};

const ASSET_TYPES = {
  RANSCODE_1080: 'TRANSCODE_1080',
  TRANSCODE_720: 'TRANSCODE_720',
  TRANSCODE_480: 'TRANSCODE_480',
  GIF: 'GIF',
  THUMBNAIL: 'THUMBNAIL',
  METADATA_JSON: 'METADATA_JSON',
};

const SUPPORTED_FORMATS = ['1080p', '720p', '480p', 'gif'];
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_DURATION = 600; // 10 minutes

/**
 * Headers to exclude when proxying Lambda responses
 * Prevents conflicts with job-service's own CORS and security headers
 */
const PROXY_EXCLUDED_HEADERS = [
  'content-encoding', 'transfer-encoding', 'connection',
  'access-control-allow-origin', 'access-control-allow-credentials',
  'access-control-allow-methods', 'access-control-allow-headers',
  'access-control-expose-headers', 'access-control-max-age',
  'content-security-policy', 'strict-transport-security',
  'x-frame-options', 'x-content-type-options', 'x-xss-protection',
  'cross-origin-opener-policy', 'cross-origin-resource-policy',
  'origin-agent-cluster', 'referrer-policy', 'x-dns-prefetch-control',
  'x-download-options', 'x-permitted-cross-domain-policies',
  'x-powered-by', 'vary', 'set-cookie',
  'x-amzn-requestid', 'x-amzn-trace-id', 'x-amzn-remapped-content-length'
];

module.exports  = {
    JOB_STATUS,
    ASSET_TYPES,
    SUPPORTED_FORMATS,
    MAX_FILE_SIZE,
    MAX_DURATION,
    PROXY_EXCLUDED_HEADERS
}
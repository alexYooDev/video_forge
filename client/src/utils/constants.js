export const JOB_STATUS = {
  PENDING: 'PENDING',
  DOWNLOADING: 'DOWNLOADING',
  PROCESSING: 'PROCESSING',
  UPLOADING: 'UPLOADING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
};

export const ASSET_TYPES = {
  TRANSCODE_4K: 'TRANSCODE_4K',
  TRANSCODE_1080: 'TRANSCODE_1080',
  TRANSCODE_720: 'TRANSCODE_720',
  TRANSCODE_480: 'TRANSCODE_480',
  METADATA_JSON: 'METADATA_JSON',
};

// gif for the future integration or improvement
export const SUPPORTED_FORMATS = ['4k', '1080p', '720p', '480p'];

export const STATUS_COLORS = {
  PENDING: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  DOWNLOADING: 'text-blue-600 bg-blue-50 border-blue-200',
  PROCESSING: 'text-purple-600 bg-purple-50 border-purple-200',
  UPLOADING: 'text-indigo-600 bg-indigo-50 border-indigo-200',
  COMPLETED: 'text-green-600 bg-green-50 border-green-200',
  FAILED: 'text-red-600 bg-red-50 border-red-200',
  CANCELLED: 'text-gray-600 bg-gray-50 border-gray-200',
};

export const STATUS_LABELS = {
  PENDING: 'Pending',
  DOWNLOADING: 'Downloading',
  PROCESSING: 'Processing',
  UPLOADING: 'Uploading',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
};
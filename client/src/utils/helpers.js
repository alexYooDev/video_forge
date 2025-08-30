export const formatFileSize = (bytes) => {
  if (!bytes) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

export const formatDuration = (seconds) => {
  if (!seconds) return '0:00';

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);

  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const getAssetTypeLabel = (assetType) => {
  const labels = {
    TRANSCODE_1080: '1080p Video',
    TRANSCODE_720: '720p Video',
    TRANSCODE_480: '480p Video',
    GIF: 'GIF Preview',
    THUMBNAIL: 'Thumbnail',
    METADATA_JSON: 'Metadata',
  };

  return labels[assetType] || assetType;
};

export const getFileExtension = (assetType) => {
  const extensions = {
    TRANSCODE_1080: 'mp4',
    TRANSCODE_720: 'mp4',
    TRANSCODE_480: 'mp4',
    METADATA_JSON: 'json',
  };

  return extensions[assetType] || 'bin';
};

// debounce function for graceful response visual cue
export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};
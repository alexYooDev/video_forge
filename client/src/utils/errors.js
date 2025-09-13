export class ApiError extends Error {
  constructor(message, status = 500, originalError = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.originalError = originalError;
  }

  static fromAxiosError(error) {
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.message || `HTTP ${status} Error`;
      return new ApiError(message, status, error);
    } else if (error.request) {
      return new ApiError('Network error - no response received', 0, error);
    } else {
      return new ApiError(error.message || 'Unknown error', 500, error);
    }
  }

  get isNetworkError() {
    return this.status === 0;
  }

  get isClientError() {
    return this.status >= 400 && this.status < 500;
  }

  get isServerError() {
    return this.status >= 500;
  }

  get isUnauthorized() {
    return this.status === 401;
  }

  get isForbidden() {
    return this.status === 403;
  }

  get isNotFound() {
    return this.status === 404;
  }

  get isConflict() {
    return this.status === 409;
  }
}
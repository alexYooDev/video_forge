import api from './api';
import { ApiError } from '../utils/errors';

export const jobsService = {
  async createJob(jobData) {
    try {
      const response = await api.post('/jobs', jobData);
      return response.data;
    } catch (error) {
      throw ApiError.fromAxiosError(error);
    }
  },

  async getJobs(params = {}) {
    try {
      const response = await api.get('/jobs', { params });
      return response.data;
    } catch (error) {
      throw ApiError.fromAxiosError(error);
    }
  },

  async getJob(jobId) {
    try {
      const response = await api.get(`/jobs/${jobId}`);
      return response.data;
    } catch (error) {
      throw ApiError.fromAxiosError(error);
    }
  },

  async deleteJob(jobId) {
    try {
      const response = await api.delete(`/jobs/${jobId}`);
      return response.data.result;
    } catch (error) {
      throw ApiError.fromAxiosError(error);
    }
  },

  async getJobAssets(jobId) {
    try {
      const response = await api.get(`/jobs/${jobId}/assets`);
      return response.data.assets;
    } catch (error) {
      throw ApiError.fromAxiosError(error);
    }
  },

  async downloadAsset(jobId, assetId, filename) {
    try {
      const response = await api.get(
        `/jobs/${jobId}/assets/${assetId}/download`,
        {
          responseType: 'blob',
        }
      );

      // Create blob URL and trigger download
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();

      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      return { success: true };
      
    } catch (error) {
      throw ApiError.fromAxiosError(error);
    }
  },

  async getJobStats() {
    try {
      const response = await api.get('/jobs/stats');
      return response.data;
    } catch (error) {
      throw ApiError.fromAxiosError(error);
    }
  },
};

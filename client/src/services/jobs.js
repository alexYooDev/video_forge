import api from './api';

export const jobsService = {
  async createJob(jobData) {
    try {
      const response = await api.post('/jobs', jobData);
      return response.data;
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to create job';
      throw new Error(message);
    }
  },

  async getJobs(params = {}) {
    try {
      const response = await api.get('/jobs', { params });
      return response.data;
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to fetch jobs';
      throw new Error(message);
    }
  },

  async getJob(jobId) {
    try {
      const response = await api.get(`/jobs/${jobId}`);
      return response.data;
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to fetch job';
      throw new Error(message);
    }
  },

  async deleteJob(jobId) {
    try {
      const response = await api.delete(`/jobs/${jobId}`);
      return response.data;
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to delete job';
      throw new Error(message);
    }
  },

  async getJobAssets(jobId) {
    try {
      const response = await api.get(`/jobs/${jobId}/assets`);
      return response.data;
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to fetch assets';
      throw new Error(message);
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
      const message =
        error.response?.data?.message || 'Failed to download asset';
      throw new Error(message);
    }
  },

  async getJobStats() {
    try {
      const response = await api.get('/jobs/stats');
      return response.data;
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to fetch stats';
      throw new Error(message);
    }
  },
};

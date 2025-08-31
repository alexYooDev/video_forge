import { useState, useEffect } from 'react';
import { jobsService } from '../services/jobs';

export const useJobs = (autoRefresh = true) => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({});

  const fetchJobs = async (params = {}) => {
    try {
      setError(null);
      const response = await jobsService.getJobs(params);
      setJobs(response.data || []);
    } catch (error) {
      setError(error.message);
      console.error('Failed to fetch jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await jobsService.getJobStats();
      setStats(response.data || {});
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const createJob = async (jobData) => {
    try {
      const response = await jobsService.createJob(jobData);
      // Add new job to the beginning of the list
      setJobs((prev) => [response.data, ...prev]);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };


  const deleteJob = async (jobId) => {
    try {
      await jobsService.deleteJob(jobId);
      setJobs((prev) => prev.filter((job) => job.id !== jobId));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const refreshJob = async (jobId) => {
    try {
      const response = await jobsService.getJob(jobId);
      setJobs((prev) =>
        prev.map((job) => (job.id === jobId ? response.data : job))
      );
    } catch (error) {
      console.error('Failed to refresh job:', error);
    }
  };

  useEffect(() => {
    fetchJobs();
    fetchStats();
  }, []);

  // Auto-refresh for jobs that are processing
  useEffect(() => {
    if (!autoRefresh) return;

    const activeJobs = jobs.filter((job) =>
      ['PENDING', 'DOWNLOADING', 'PROCESSING', 'UPLOADING'].includes(job.status)
    );

    if (activeJobs.length === 0) return;

    const interval = setInterval(() => {
      activeJobs.forEach((job) => refreshJob(job.id));
    }, 3000); // Refresh every 3 seconds

    return () => clearInterval(interval);
  }, [jobs, autoRefresh]);

  return {
    jobs,
    loading,
    error,
    stats,
    createJob,
    deleteJob,
    refreshJob,
    refetch: fetchJobs,
  };
};

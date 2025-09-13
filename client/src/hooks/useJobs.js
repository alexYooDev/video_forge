import { useState, useEffect, useCallback } from 'react';
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
      // Fix format mismatch - server returns {jobs: [...], pagination: {...}}
      setJobs(response.jobs || []);
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
      // Fix: Access the stats property from the response data
      setStats(response.stats || {});
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      setStats({}); // Set empty object on error
    }
  };

  const createJob = async (jobData) => {
    try {
      const response = await jobsService.createJob(jobData);
      // Add new job to the beginning of the list - fix format mismatch
      setJobs((prev) => [response.job, ...prev]);
      return { success: true, data: response.job };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };


  const deleteJob = async (jobId) => {
    try {
      const result = await jobsService.deleteJob(jobId);
      console.log(result);
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
        prev.map((job) => (job.id === jobId ? response.job : job))
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

  const refetchAll = useCallback(async () => {
    await fetchJobs();
    await fetchStats();
  }, []);

  return {
    jobs,
    loading,
    error,
    stats,
    createJob,
    deleteJob,
    refreshJob,
    refetch: fetchJobs,
    refetchAll,
  };
};

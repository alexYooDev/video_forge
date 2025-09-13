import React, { useState } from 'react';
import { useJobs } from '../../hooks/useJobs';
// import { JOB_STATUS } from '../../utils/constants';
import JobCard from './JobCard';
import Button from '../ui/Button';
import Layout from '../layout/Layout';
import SystemStats from '../ui/SystemStats';

const JobList = () => {
  const { jobs, loading, error, deleteJob, refreshJob, refetch } = useJobs();
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('DESC');

  const handleDeleteJob = async (jobId) => {
    try {
      const result = await deleteJob(jobId);
      console.log(result);
      if (!result.success) {
        alert(result.error);
      }
    } catch (error) {
      alert(`Delete failed: ${error.message}`);
    }
  };

  const handleRefreshJob = async (jobId) => {
    await refreshJob(jobId);
  };

  const filteredJobs = jobs.filter((job) => {
    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'ACTIVE') {
      return ['PENDING', 'DOWNLOADING', 'PROCESSING', 'UPLOADING'].includes(
        job.status
      );
    }
    return job.status === statusFilter;
  });

  const statusCounts = jobs.reduce((counts, job) => {
    counts[job.status] = (counts[job.status] || 0) + 1;
    return counts;
  }, {});

  const activeJobsCount = Object.keys(statusCounts).reduce((total, status) => {
    if (
      ['PENDING', 'DOWNLOADING', 'PROCESSING', 'UPLOADING'].includes(status)
    ) {
      return total + statusCounts[status];
    }
    return total;
  }, 0);

  if (loading) {
    return (
      <div className='text-center py-12'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4'></div>
        <p className='text-gray-600'>Loading jobs...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className='text-center py-12'>
        <div className='bg-red-50 border border-red-200 rounded-md p-4 max-w-md mx-auto'>
          <p className='text-red-800'>{error}</p>
          <Button
            variant='outline'
            size='sm'
            onClick={() => refetch()}
            className='mt-3'
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Layout>
      <div className='space-y-6'>
        {/* Header */}
        <div className='flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0'>
          <div>
            <h2 className='text-2xl font-bold text-gray-900'>Your Jobs</h2>
            <p className='text-gray-600'>
              {jobs.length} total jobs, {activeJobsCount} processing
            </p>
          </div>
          <div className='flex space-x-3'>
            <Button variant='outline' size='sm' onClick={() => refetch()}>
              Refresh All
            </Button>
          </div>
        </div>

        {/* System Stats for Load Testing */}
        {activeJobsCount > 0 && (
          <div className='lg:max-w-md'>
            <SystemStats />
          </div>
        )}

        {/* Filters */}
        <div className='bg-white rounded-lg shadow-sm border border-gray-200 p-4'>
          <div className='flex flex-wrap items-center gap-4'>
            <div className='flex items-center space-x-2'>
              <label className='text-sm font-medium text-gray-700'>
                Status:
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className='rounded-md border-gray-300 text-sm focus:border-primary-500 focus:ring-primary-500'
              >
                <option value='ALL'>All ({jobs.length})</option>
                <option value='ACTIVE'>Processing ({activeJobsCount})</option>
                <option value='COMPLETED'>
                  Completed ({statusCounts.COMPLETED || 0})
                </option>
                <option value='FAILED'>
                  Failed ({statusCounts.FAILED || 0})
                </option>
                <option value='PENDING'>
                  Pending ({statusCounts.PENDING || 0})
                </option>
              </select>
            </div>

            <div className='flex items-center space-x-2'>
              <label className='text-sm font-medium text-gray-700'>Sort:</label>
              <select
                value={`${sortBy}_${sortOrder}`}
                onChange={(e) => {
                  const [field, order] = e.target.value.split('_');
                  setSortBy(field);
                  setSortOrder(order);
                }}
                className='rounded-md border-gray-300 text-sm focus:border-primary-500 focus:ring-primary-500'
              >
                <option value='created_at_DESC'>Newest First</option>
                <option value='created_at_ASC'>Oldest First</option>
                <option value='status_ASC'>Status A-Z</option>
                <option value='progress_DESC'>Progress High-Low</option>
              </select>
            </div>
          </div>

          {/* Status Summary */}
          <div className='mt-4 flex flex-wrap gap-2'>
            {Object.entries(statusCounts).map(([status, count]) => (
              <span
                key={status}
                className='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800'
              >
                {status}: {count}
              </span>
            ))}
          </div>
        </div>

        {/* Jobs Grid */}
        {filteredJobs.length === 0 ? (
          <div className='text-center py-12 bg-white rounded-lg shadow-sm border border-gray-200'>
            <div className='w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4'>
              <svg
                className='w-8 h-8 text-gray-400'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth='2'
                  d='M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10'
                />
              </svg>
            </div>
            <h3 className='text-lg font-medium text-gray-900 mb-2'>
              {statusFilter === 'ALL'
                ? 'No jobs yet'
                : `No ${statusFilter.toLowerCase()} jobs`}
            </h3>
            <p className='text-gray-600 mb-6'>
              {statusFilter === 'ALL'
                ? 'Create your first video processing job to get started!'
                : `No jobs with status "${statusFilter}" found.`}
            </p>
            {statusFilter === 'ALL' && (
              <Button
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              >
                Create Your First Job
              </Button>
            )}
          </div>
        ) : (
          <div className='grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6'>
            {filteredJobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                onDelete={handleDeleteJob}
                onRefresh={handleRefreshJob}
              />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default JobList;

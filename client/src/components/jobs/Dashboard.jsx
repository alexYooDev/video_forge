import React, { useEffect, useState } from 'react';
import { useJobs } from '../../hooks/useJobs';
import JobForm from './JobForm';
import Card from '../ui/Card';
import { useLocation, useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const navigate = useNavigate();
  const {
    createJob,
    stats,
    loading: jobsLoading,
    refetchAll
  } = useJobs();
  const [creatingJob, setCreatingJob] = useState(false);

  const location = useLocation();

  const {videoUrl} = location.state || '';

  useEffect(() => {
    const updateStats = async () => {
        await refetchAll();
    }
    updateStats();
  }, [refetchAll])  // Include refetchAll in dependencies


  const handleCreateJob = async (jobData) => {
    try {
      setCreatingJob(true);
      const result = await createJob(jobData);

      if (result.success) {
        // Navigate to jobs page to see the job progress
        navigate('/jobs');
      } else {
        alert(`Failed to create job: ${result.error}`);
      }
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      setCreatingJob(false);
    }
  };

  // Calculate stats for display
  const totalJobs = stats ? Object.values(stats).reduce((sum, stat) => {
    return sum + (typeof stat === 'object' ? stat.count || 0 : stat || 0);
  }, 0) : 0;

  const completedJobs = (stats && stats.COMPLETED)
    ? typeof stats.COMPLETED === 'object'
      ? stats.COMPLETED.count || 0
      : stats.COMPLETED || 0
    : 0;

  const failedJobs = (stats && stats.FAILED)
    ? typeof stats.FAILED === 'object'
      ? stats.FAILED.count || 0
      : stats.FAILED || 0
    : 0;

  const activeJobs = [
    'PENDING',
    'DOWNLOADING',
    'PROCESSING',
    'UPLOADING',
  ].reduce((sum, status) => {
    const stat = stats && stats[status];
    if (!stat) return sum;
    return sum + (typeof stat === 'object' ? stat.count || 0 : stat || 0);
  }, 0);

  return (
    <div className='space-y-8'>
      {/* Welcome Section */}
      <div className='text-center'>
        <h1 className='text-3xl font-bold text-gray-900 mb-4'>
          Welcome to Video Forge! 🎬
        </h1>
        <p className='text-lg text-gray-600 max-w-2xl mx-auto'>
          Transform your videos with professional transcoding!
        </p>
        <p className='text-lg text-gray-600 max-w-2xl mx-auto'>Upload a video or use our sample to get started.</p>
      </div>

      {/* Stats Cards */}
      {totalJobs > 0 && (
        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6'>
          <Card padding='p-6'>
            <div className='text-center'>
              <div className='text-3xl font-bold text-gray-900'>
                {totalJobs}
              </div>
              <div className='text-sm text-gray-500 mt-1'>Total Jobs</div>
            </div>
          </Card>

          <Card padding='p-6'>
            <div className='text-center'>
              <div className='text-3xl font-bold text-blue-600'>
                {activeJobs}
              </div>
              <div className='text-sm text-gray-500 mt-1'>Processing</div>
            </div>
          </Card>

          <Card padding='p-6'>
            <div className='text-center'>
              <div className='text-3xl font-bold text-green-600'>
                {completedJobs}
              </div>
              <div className='text-sm text-gray-500 mt-1'>Completed</div>
            </div>
          </Card>

          <Card padding='p-6'>
            <div className='text-center'>
              <div className='text-3xl font-bold text-red-600'>
                {failedJobs}
              </div>
              <div className='text-sm text-gray-500 mt-1'>Failed</div>
            </div>
          </Card>
        </div>
      )}

      {/* Job Creation Form */}
      <JobForm
        onSubmit={handleCreateJob}
        videoUrl={videoUrl || ''}
        loading={creatingJob}
      />

      {/* Help Section */}
      {totalJobs === 0 && (
        <Card>
          <div className='text-center'>
            <h3 className='text-lg font-medium text-gray-900 mb-4'>
              Getting Started with Video Forge
            </h3>

            <div className='grid grid-cols-1 md:grid-cols-3 gap-6 mt-6'>
              <div className='text-center'>
                <div className='w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3'>
                  <span className='text-2xl'>1.</span>
                </div>
                <h4 className='font-medium text-gray-900 mb-2'>Create a Job</h4>
                <p className='text-sm text-gray-600'>
                  Click "Create New Job" and enter a video URL, or use "Quick
                  Sample Job" for testing
                </p>
              </div>

              <div className='text-center'>
                <div className='w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3'>
                  <span className='text-2xl'>2.</span>
                </div>
                <h4 className='font-medium text-gray-900 mb-2'>
                  Watch Processing
                </h4>
                <p className='text-sm text-gray-600'>
                  Monitor real-time progress as your video is transcoded into
                  multiple formats
                </p>
              </div>

              <div className='text-center'>
                <div className='w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3'>
                  <span className='text-2xl'>3.</span>
                </div>
                <h4 className='font-medium text-gray-900 mb-2'>
                  Download Results
                </h4>
                <p className='text-sm text-gray-600'>
                  Get your processed videos, GIFs, and thumbnails in multiple
                  formats
                </p>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default Dashboard;

import React, { useState } from 'react';
import {
  formatFileSize,
  getAssetTypeLabel,
  getFileExtension,
} from '../../utils/helpers';
import { STATUS_COLORS, STATUS_LABELS } from '../../utils/constants';
import Button from '../ui/Button';
import Card from '../ui/Card';
import ProgressBar from '../ui/ProgressBar';
import { jobsService } from '../../services/jobs';

const JobCard = ({ job, onDelete, onRefresh }) => {
  const [assets, setAssets] = useState([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [showAssets, setShowAssets] = useState(false);
  const [downloadingAsset, setDownloadingAsset] = useState(null);
  
  const [isDownloaded, setIsDownloaded] = useState([]);

  const loadAssets = async () => {
    if (job.status !== 'COMPLETED') return;

    try {
      setLoadingAssets(true);
      const response = await jobsService.getJobAssets(job.id);
      setAssets(response.data || []);
    } catch (error) {
      console.error('Failed to load assets:', error);
    } finally {
      setLoadingAssets(false);
    }
  };

  const handleShowAssets = async () => {
    if (!showAssets && assets.length === 0) {
      await loadAssets();
    }
    setShowAssets(!showAssets);
  };

  const handleDownloadAsset = async (asset) => {
    try {
      setDownloadingAsset(asset.id);
      const extension = getFileExtension(asset.asset_type);
      const filename = `job_${
        job.id
      }_${asset.asset_type.toLowerCase()}.${extension}`;

      await jobsService.downloadAsset(job.id, asset.id, filename);

      setIsDownloaded([...isDownloaded, asset.id ])

    } catch (error) {
      alert(`Download failed: ${error.message}`);
    } finally {
      setDownloadingAsset(null);
    }
  };

  const handleDelete = () => {
    if (
      window.confirm(
        'Are you sure you want to delete this job? This cannot be undone.'
      )
    ) {
      onDelete(job.id);
    }
  };

  const canDelete = ['PENDING', 'FAILED', 'CANCELLED', 'COMPLETED'].includes(
    job.status
  );
  const isProcessing = ['DOWNLOADING', 'PROCESSING', 'UPLOADING'].includes(
    job.status
  );

  return (
    <Card className='hover:shadow-md transition-shadow duration-200'>
      <div className='space-y-4'>
        {/* Header */}
        <div className='flex items-start justify-between'>
          <div className='flex-1 min-w-0'>
            <h4 className='text-lg font-medium text-gray-900 truncate'>
              Job #{job.id}
            </h4>
            <p className='text-sm text-gray-500 truncate mt-1'>
              {job.input_source}
            </p>
          </div>
          <div className='flex items-center space-x-2 ml-4'>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                STATUS_COLORS[job.status]
              }`}
            >
              {STATUS_LABELS[job.status]}
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        {isProcessing && (
          <ProgressBar value={job.progress || 0} className='my-3' />
        )}

        {/* Error Message */}
        {job.status === 'FAILED' && job.error_text && (
          <div className='bg-red-50 border border-red-200 rounded-md p-3'>
            <p className='text-sm text-red-800'>{job.error_text}</p>
          </div>
        )}

        {/* Metadata */}
        <div className='flex justify-between text-sm text-gray-500'>
          <span>Created: {new Date(job.created_at).toLocaleString()}</span>
          {job.updated_at !== job.created_at && (
            <span>Updated: {new Date(job.updated_at).toLocaleString()}</span>
          )}
        </div>

        {/* Actions */}
        <div className='flex justify-between items-center pt-4 border-t border-gray-200'>
          <div className='flex space-x-2'>
            {job.status === 'COMPLETED' && (
              <Button
                size='sm'
                variant='outline'
                onClick={handleShowAssets}
                loading={loadingAssets}
              >
                {showAssets
                  ? 'Hide Assets'
                  : `Show Assets (${job.asset_count || '?'})`}
              </Button>
            )}
            {isProcessing && (
              <Button
                size='sm'
                variant='outline'
                onClick={() => onRefresh(job.id)}
              >
                Refresh
              </Button>
            )}
          </div>

          <div className='flex space-x-2'>
            {canDelete && (
              <Button size='sm' variant='danger' onClick={handleDelete}>
                Delete
              </Button>
            )}
          </div>
        </div>

        {/* Assets List */}
        {showAssets && job.status === 'COMPLETED' && (
          <div className='pt-4 border-t border-gray-200'>
            <h5 className='text-sm font-medium text-gray-900 mb-3'>
              Generated Assets ({assets.length})
            </h5>

            {loadingAssets ? (
              <div className='text-center py-4'>
                <div className='animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto'></div>
              </div>
            ) : (
              <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                {assets.map((asset) => (
                  <div
                    key={asset.id}
                    className='flex items-center justify-between p-3 bg-gray-50 rounded-lg border'
                  >
                    <div className='flex-1 min-w-0'>
                      <p className='text-sm font-medium text-gray-900'>
                        {getAssetTypeLabel(asset.asset_type)}
                      </p>
                      <p className='text-xs text-gray-500'>
                        {formatFileSize(asset.size_bytes)}
                      </p>
                    </div>
                    <Button
                      size='sm'
                      variant='outline'
                      onClick={() => handleDownloadAsset(asset)}
                      loading={downloadingAsset === asset.id}
                      className='ml-3'
                    >
                     { isDownloaded.includes(asset.id) ? 'Downloaded' : 'Download' }
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};

export default JobCard;

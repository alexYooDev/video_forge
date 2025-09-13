import React from 'react';

const ProgressBar = ({
  value = 0,
  max = 100,
  className = '',
  showLabel = true,
  status = 'processing',
  phase = '',
  animated = false,
}) => {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
  
  const getStatusColor = () => {
    switch (status) {
      case 'DOWNLOADING':
        return 'bg-blue-500';
      case 'PROCESSING':
        return 'bg-purple-500';
      case 'UPLOADING':
        return 'bg-green-500';
      case 'COMPLETED':
        return 'bg-green-600';
      case 'FAILED':
        return 'bg-red-500';
      case 'PENDING':
        return 'bg-yellow-500';
      default:
        return 'bg-orange-500'; // Change default to orange to see if it's hitting default
    }
  };

  const getStatusLabel = () => {
    switch (status) {
      case 'DOWNLOADING':
        return 'Downloading';
      case 'PROCESSING':
        return phase || 'Processing';
      case 'UPLOADING':
        return 'Uploading';
      case 'COMPLETED':
        return 'Completed';
      case 'FAILED':
        return 'Failed';
      case 'PENDING':
        return 'Queued';
      default:
        return 'Progress';
    }
  };

  const progressBarClasses = `
    ${status === 'PROCESSING' ? 'bg-gradient-to-r from-purple-400 to-purple-600' : getStatusColor()} 
    h-4 
    rounded-full 
    transition-all 
    duration-500 
    ease-out
    ${animated ? 'animate-pulse' : ''}
  `.trim();

  return (
    <div className={`w-full ${className}`}>
      <div className='flex justify-between items-center mb-2'>
        {showLabel && (
          <div className='flex items-center space-x-2'>
            <span className='text-sm font-medium text-gray-700'>
              {getStatusLabel()}
            </span>
            {animated && status === 'PROCESSING' && (
              <div className="flex space-x-1">
                <div className="w-1 h-1 bg-purple-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                <div className="w-1 h-1 bg-purple-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="w-1 h-1 bg-purple-500 rounded-full animate-bounce"></div>
              </div>
            )}
          </div>
        )}
        <div className="flex items-center space-x-2">
          <span className='text-sm text-gray-500'>{Math.round(percentage)}%</span>
          {status === 'PROCESSING' && (
            <div className="w-4 h-4 border-2 border-purple-200 border-t-purple-500 rounded-full animate-spin"></div>
          )}
        </div>
      </div>
      <div className='w-full bg-gray-200 rounded-full h-4 border border-gray-300'>
        <div
          className={progressBarClasses}
          style={{ 
            width: `${percentage}%`,
            minWidth: percentage > 0 ? '8px' : '0px' // Ensure visibility even at low percentages
          }}
        >
          {status === 'PROCESSING' && (
            <div className="h-full w-full bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>
          )}
        </div>
      </div>
      {phase && status === 'PROCESSING' && (
        <div className="text-xs text-gray-500 mt-1 italic">
          {phase}
        </div>
      )}
    </div>
  );
};

export default ProgressBar;
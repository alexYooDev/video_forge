import React from 'react';

const ProgressBar = ({
  value = 0,
  max = 100,
  className = '',
  showLabel = true,
}) => {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  return (
    <div className={`w-full ${className}`}>
      <div className='flex justify-between items-center mb-1'>
        {showLabel && (
          <span className='text-sm font-medium text-gray-700'>Progress</span>
        )}
        <span className='text-sm text-gray-500'>{Math.round(percentage)}%</span>
      </div>
      <div className='w-full bg-gray-200 rounded-full h-2'>
        <div
          className='bg-primary-600 h-2 rounded-full transition-all duration-300 ease-out'
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

export default ProgressBar;
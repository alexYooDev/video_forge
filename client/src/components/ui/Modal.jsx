import React from 'react';
import Button from './Button';

const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  showCloseButton = true,
  size = 'md',
}) => {
  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className='fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50'
      onClick={handleBackdropClick}
    >
      <div className='relative top-20 mx-auto p-5 border w-11/12 shadow-lg rounded-md bg-white max-w-lg'>
        <div className={`mx-auto ${sizeClasses[size]}`}>
          {/* Header */}
          <div className='flex justify-between items-center mb-4'>
            {title && (
              <h3 className='text-lg font-medium text-gray-900'>{title}</h3>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                className='text-gray-400 hover:text-gray-600'
              >
                <svg
                  className='w-6 h-6'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth='2'
                    d='M6 18L18 6M6 6l12 12'
                  />
                </svg>
              </button>
            )}
          </div>

          {/* Content */}
          <div>{children}</div>
        </div>
      </div>
    </div>
  );
};

export default Modal;

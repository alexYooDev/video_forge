import React from 'react';
import { useAuthContext } from '../../context/AuthProvider';
import Button from '../ui/Button';
import { Link } from 'react-router-dom';

const Header = () => {
  const { user, logout } = useAuthContext();

  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to sign out?')) {
      await logout();
    }
  };

  return (
    <header className='bg-white shadow-sm border-b border-gray-200'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        <div className='flex justify-between items-center h-16'>
          {/* Logo */}
          <div className='flex items-center'>
            <div className='flex-shrink-0 flex items-center'>
              <div className='w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center mr-3'>
                <svg
                  className='w-5 h-5 text-white'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth='2'
                    d='M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z'
                  />
                </svg>
              </div>
              <h1 className='text-xl font-bold text-gray-900'>Video Forge</h1>
            </div>
          </div>

          {/* Navigation */}
          <nav className='hidden md:flex space-x-8'>
            <Link
              to='/'
              className='text-gray-900 hover:text-primary-600 px-3 py-2 rounded-md text-sm font-medium'
            >
              Dashboard
            </Link>
            <Link
              to='/search-video'
              className='text-gray-500 hover:text-primary-600 px-3 py-2 rounded-md text-sm font-medium'
            >
              Search videos
            </Link>
            {/* <Link
              to='/jobs'
              className='text-gray-500 hover:text-primary-600 px-3 py-2 rounded-md text-sm font-medium'
            >
              Jobs
            </Link> */}
          </nav>

          {/* User Menu */}
          <div className='flex items-center space-x-4'>
            <div className='flex items-center space-x-3'>
              <div className='flex flex-col text-right'>
                <span className='text-sm font-medium text-gray-900'>
                  {user?.email}
                </span>
                <span className='text-xs text-gray-500 capitalize'>
                  {user?.role}
                </span>
              </div>
              <div className='w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center'>
                <span className='text-sm font-medium text-white'>
                  {user?.email?.charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
            <Button variant='outline' size='sm' onClick={handleLogout}>
              Sign out
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;

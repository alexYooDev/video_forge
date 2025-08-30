import React from 'react';
import Header from './Header';

const Layout = ({ children }) => {
  return (
    <div className='min-h-screen bg-gray-50'>
      <main className='max-w-7xl mx-auto py-6 sm:px-6 lg:px-8'>
        <div className='px-4 py-6 sm:px-0'>{children}</div>
      </main>
    </div>
  );
};

export default Layout;

import React from 'react';
import { useAuthContext } from './context/AuthProvider';
import Login from './components/auth/Login';
import Layout from './components/layout/Layout';
import Dashboard from './components/jobs/Dashboard';
import AdminDashboard from './components/admin/AdminDashboard';
import './output.css';

// Main App Content (when authenticated)
const AppContent = () => {
  const { user } = useAuthContext();
  
  return (
    <Layout>
      {user?.role === 'admin' ? <AdminDashboard /> : <Dashboard />}
    </Layout>
  );
};

// Auth Guard Component
const AuthGuard = () => {
  const { user, loading, error } = useAuthContext();

  if (loading) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-gray-50'>
        <div className='text-center'>
          <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4'></div>
          <p className='text-gray-600'>Loading Video Forge...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-gray-50'>
        <div className='text-center max-w-md'>
          <div className='bg-red-50 border border-red-200 rounded-lg p-6'>
            <h2 className='text-lg font-medium text-red-800 mb-2'>
              Authentication Error
            </h2>
            <p className='text-red-700 mb-4'>{error}</p>
            <button
              onClick={() => window.location.reload()}
              className='bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700'
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return <AppContent />;
};

// Main App Component
function App() {
  return (
      <AuthGuard />
  );
}

export default App;

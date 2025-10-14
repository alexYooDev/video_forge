import React, { useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useAuthContext } from './context/AuthProvider';
import Login from './components/auth/Login';
import MFALogin from './components/auth/MFALogin';
import OAuthCallback from './components/auth/OAuthCallback';
import Layout from './components/layout/Layout';
import Dashboard from './components/jobs/Dashboard';
import AdminDashboard from './components/admin/AdminDashboard';
import JobList from './components/jobs/JobList';
import SearchVideo from './components/search/SearchVideo';
import VideoGallery from './components/jobs/VideoGallery';
import UploadPage from './components/jobs/UploadPage';
import VideoDetail from './components/jobs/VideoDetail';
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


// Main App Component
function App() {
  const { user, loading } = useAuthContext();
  const navigate = useNavigate();
  const location = useLocation();

  // Handle navigation after authentication
  useEffect(() => {
    if (user && location.pathname === '/mfa-login') {
      navigate('/', { replace: true });
    }
  }, [user, location.pathname, navigate]);

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

  return (
    <Routes>
      {/* Public routes (when not authenticated) */}
      {!user && (
        <>
          <Route path='/' element={<Login />} />
          <Route path='/mfa-login' element={<MFALogin />} />
          <Route path='/auth/callback' element={<OAuthCallback />} />
          <Route path='/gallery' element={<VideoGallery />} />
          <Route path='/video/:id' element={<VideoDetail />} />
        </>
      )}

      {/* Protected routes (when authenticated) */}
      {user && (
        <>
          <Route path='/' element={<AppContent />} />
          <Route
            path='/jobs'
            element={
              <Layout>
                <JobList />
              </Layout>
            }
          />
          <Route
            path='/search-video'
            element={
              <Layout>
                <SearchVideo />
              </Layout>
            }
          />
          <Route
            path='/upload'
            element={
              <Layout>
                <UploadPage />
              </Layout>
            }
          />
          <Route path='/gallery' element={
            <Layout>
              <VideoGallery />
            </Layout>
            } />
          <Route path='/video/:id' element={
            <Layout>
              <VideoDetail />
            </Layout>
            } />
        </>
      )}

      {/* Fallback route */}
      <Route path='*' element={user ? <AppContent /> : <Login />} />
    </Routes>
  );
}

export default App;

import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authService } from '../../services/auth';
import { useAuthContext } from '../../context/AuthProvider';
import Card from '../ui/Card';
import { Shield, CheckCircle, XCircle } from 'lucide-react';

const OAuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { loginWithToken } = useAuthContext();
  const [status, setStatus] = useState('processing'); // processing, success, error
  const [message, setMessage] = useState('Processing Google Sign-In...');
  const processedRef = useRef(false);

  useEffect(() => {
    if (processedRef.current) return; // Prevent duplicate processing
    processedRef.current = true; // Mark as being processed

    const handleCallback = async () => {
      try {
        const code = searchParams.get('code');
        const error = searchParams.get('error');

        if (error) {
          throw new Error(`Authentication error: ${error}`);
        }

        if (!code) {
          throw new Error('No authorization code received');
        }

        setMessage('Exchanging authorization code...');
        const result = await authService.handleOAuthCallback(code);

        setMessage('Login successful! Redirecting...');
        setStatus('success');

        // Update auth context
        loginWithToken(result.user);

        // Redirect after short delay
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 1500);

      } catch (error) {
        console.error('OAuth callback error:', error);
        setStatus('error');
        setMessage(error.message || 'Authentication failed');

        // Redirect to login after delay
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 3000);
      }
    };

    handleCallback();
  }, []); // Empty dependency array - only run once on mount

  const getStatusIcon = () => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />;
      case 'error':
        return <XCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />;
      default:
        return <Shield className="h-12 w-12 text-blue-600 mx-auto mb-4 animate-spin" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'success':
        return 'text-green-700';
      case 'error':
        return 'text-red-700';
      default:
        return 'text-blue-700';
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <Card className="p-8 bg-white shadow-xl border-0">
          <div className="text-center">
            {getStatusIcon()}
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {status === 'success' && 'Sign-In Successful'}
              {status === 'error' && 'Sign-In Failed'}
              {status === 'processing' && 'Signing You In'}
            </h2>
            <p className={`${getStatusColor()} mb-6`}>
              {message}
            </p>
            {status === 'processing' && (
              <div className="flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default OAuthCallback;
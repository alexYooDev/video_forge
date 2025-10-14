import React, { useState } from 'react';
import Button from '../ui/Button';
import Card from '../ui/Card';
import { Shield, ArrowLeft } from 'lucide-react';
import { useAuthContext } from '../../context/AuthProvider';
import { useNavigate, useLocation } from 'react-router-dom';

const MFALogin = (/* { session, challenge, onSuccess, onBack } */) => {

  const location = useLocation();
  const navigate = useNavigate();
  const { completeMFALogin } = useAuthContext();

  const {session, challenge, username} = location.state || {};


  const [otpCode, setOtpCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!otpCode || otpCode.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const challengeName = challenge?.name || 'EMAIL_OTP';
      const result = await completeMFALogin(session, otpCode, challengeName, username);

      if (result.success) {
        // Don't navigate manually - let the auth context handle the route change
        // The App component will automatically re-render and show authenticated content
      }

    } catch (err) {
      setError(err.message);
      setOtpCode('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <Card className="p-8 bg-white shadow-xl border-0">
          <div className="text-center mb-6">
            <Shield className="h-12 w-12 text-blue-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Two-Factor Authentication
            </h2>
            <p className="text-gray-600">
              {challenge?.message || 'Enter the 6-digit code sent to your email'}
            </p>
            {challenge?.destination && (
              <p className="text-sm text-gray-500 mt-1">
                Code sent to: {challenge.destination}
              </p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            <div>
              <label htmlFor="otpCode" className="block text-sm font-medium text-gray-700 mb-2">
                Email Verification Code
              </label>
              <input
                id="otpCode"
                type="text"
                maxLength={6}
                value={otpCode}
                onChange={(e) => {
                  setOtpCode(e.target.value.replace(/\D/g, ''));
                  setError('');
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="123456"
                autoComplete="one-time-code"
                autoFocus
              />
            </div>

            <div className="space-y-3">
              <Button
                type="submit"
                loading={isLoading}
                disabled={otpCode.length !== 6}
                variant='outline'
                className="w-full font-semibold py-3 text-black rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                Verify Code
              </Button>
              
              <Button
                type="button"
                variant="outline"
                onClick={handleGoBack}
                className="w-full"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Login
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default MFALogin;
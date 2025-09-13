import React, { useState } from 'react';
import Button from '../ui/Button';
import Card from '../ui/Card';
import { Shield, ArrowLeft } from 'lucide-react';
import { authService } from '../../services/auth';

const MFALogin = ({ session, onSuccess, onBack }) => {
  const [totpCode, setTotpCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!totpCode || totpCode.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const result = await authService.completeMFA(session, totpCode);
      onSuccess(result);
    } catch (err) {
      setError(err.message);
      setTotpCode('');
    } finally {
      setIsLoading(false);
    }
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
              Enter the 6-digit code from your authenticator app
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            <div>
              <label htmlFor="totpCode" className="block text-sm font-medium text-gray-700 mb-2">
                Authentication Code
              </label>
              <input
                id="totpCode"
                type="text"
                maxLength={6}
                value={totpCode}
                onChange={(e) => {
                  setTotpCode(e.target.value.replace(/\D/g, ''));
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
                disabled={totpCode.length !== 6}
                className="w-full font-semibold py-3"
              >
                Verify Code
              </Button>
              
              <Button
                type="button"
                variant="outline"
                onClick={onBack}
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
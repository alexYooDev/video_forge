import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import Button from '../ui/Button';
import Card from '../ui/Card';
import { Shield, Copy, Check } from 'lucide-react';
import { authService } from '../../services/auth';

const MFASetup = ({ onMFAEnabled, onCancel }) => {
  const [setupData, setSetupData] = useState(null);
  const [totpCode, setTotpCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const handleStartSetup = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      const data = await authService.setupMFA();
      setSetupData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyMFA = async () => {
    if (!totpCode || totpCode.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await authService.verifyMFA(totpCode);
      onMFAEnabled();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const copySecretKey = async () => {
    try {
      await navigator.clipboard.writeText(setupData.secretCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (!setupData) {
    return (
      <Card className="max-w-md mx-auto p-6">
        <div className="text-center">
          <Shield className="h-12 w-12 text-blue-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Enable Multi-Factor Authentication</h3>
          <p className="text-gray-600 mb-6">
            Add an extra layer of security to your account with TOTP authentication.
          </p>
          
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <div className="space-y-3">
            <Button
              onClick={handleStartSetup}
              loading={isLoading}
              className="w-full"
            >
              Set Up MFA
            </Button>
            <Button
              onClick={onCancel}
              variant="outline"
              className="w-full"
            >
              Cancel
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="max-w-lg mx-auto p-6">
      <div className="text-center mb-6">
        <Shield className="h-12 w-12 text-blue-600 mx-auto mb-4" />
        <h3 className="text-lg font-medium mb-2">Set Up Authenticator App</h3>
      </div>

      <div className="space-y-6">
        <div className="text-center">
          <p className="text-sm text-gray-600 mb-4">
            Scan this QR code with your authenticator app:
          </p>
          <div className="bg-white p-4 border rounded-lg inline-block">
            <QRCodeSVG value={setupData.qrCodeUrl} size={200} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Or enter this key manually:
          </label>
          <div className="flex items-center space-x-2">
            <code className="flex-1 px-3 py-2 bg-gray-100 border rounded text-sm font-mono">
              {setupData.secretCode}
            </code>
            <Button
              onClick={copySecretKey}
              variant="outline"
              size="sm"
              className="px-3"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div>
          <label htmlFor="totpCode" className="block text-sm font-medium text-gray-700 mb-2">
            Enter verification code from your app:
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
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="123456"
          />
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        <div className="space-y-3">
          <Button
            onClick={handleVerifyMFA}
            loading={isLoading}
            disabled={totpCode.length !== 6}
            className="w-full"
          >
            Verify and Enable MFA
          </Button>
          <Button
            onClick={onCancel}
            variant="outline"
            className="w-full"
          >
            Cancel
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default MFASetup;
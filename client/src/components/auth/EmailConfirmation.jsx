import React, { useState } from 'react';
import Button from '../ui/Button';
import Card from '../ui/Card';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import { authService } from '../../services/auth';

const EmailConfirmation = ({ email, username, onBack, onSuccess }) => {
  const [confirmationCode, setConfirmationCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [resendSuccess, setResendSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      await authService.confirmEmail(email, confirmationCode, username);
      setSuccess('Email confirmed successfully! You can now log in.');
      setTimeout(() => {
        onSuccess();
      }, 2000);
    } catch (error) {
      setError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendCode = async () => {
    setIsResending(true);
    setError('');
    setResendSuccess('');

    try {
      await authService.resendConfirmation(email, username);
      setResendSuccess('Confirmation code sent! Check your email.');
    } catch (error) {
      setError(error.message);
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className='min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 py-12 px-4 sm:px-6 lg:px-8'>
      <div className='max-w-md w-full space-y-8'>
        {/* Header */}
        <div className='text-center'>
          <div className='w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4'>
            <Mail className='h-8 w-8 text-blue-600' />
          </div>
          <h2 className='text-3xl font-bold text-gray-900 mb-2'>
            Confirm Your Email
          </h2>
          <p className='text-gray-600 mb-6'>
            We've sent a confirmation code to
            <br />
            <span className='font-medium text-gray-800'>{email}</span>
          </p>
        </div>

        {/* Confirmation Form */}
        <Card className='p-8 bg-white shadow-xl border-0'>
          <form className='space-y-6' onSubmit={handleSubmit}>
            {/* Error Messages */}
            {error && (
              <div className='rounded-lg bg-red-50 p-4 border border-red-200'>
                <div className='flex'>
                  <div className='flex-shrink-0'>
                    <svg
                      className='h-5 w-5 text-red-400'
                      viewBox='0 0 20 20'
                      fill='currentColor'
                    >
                      <path
                        fillRule='evenodd'
                        d='M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z'
                        clipRule='evenodd'
                      />
                    </svg>
                  </div>
                  <div className='ml-3'>
                    <h3 className='text-sm font-medium text-red-800'>
                      Confirmation Failed
                    </h3>
                    <div className='mt-2 text-sm text-red-700'>{error}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className='rounded-lg bg-green-50 p-4 border border-green-200'>
                <div className='flex'>
                  <div className='flex-shrink-0'>
                    <CheckCircle className='h-5 w-5 text-green-400' />
                  </div>
                  <div className='ml-3'>
                    <h3 className='text-sm font-medium text-green-800'>
                      Success!
                    </h3>
                    <div className='mt-2 text-sm text-green-700'>{success}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Resend Success Message */}
            {resendSuccess && (
              <div className='rounded-lg bg-blue-50 p-4 border border-blue-200'>
                <div className='flex'>
                  <div className='flex-shrink-0'>
                    <Mail className='h-5 w-5 text-blue-400' />
                  </div>
                  <div className='ml-3'>
                    <h3 className='text-sm font-medium text-blue-800'>
                      Code Sent!
                    </h3>
                    <div className='mt-2 text-sm text-blue-700'>
                      {resendSuccess}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Confirmation Code Field */}
            <div>
              <label
                htmlFor='confirmationCode'
                className='block text-sm font-medium text-gray-700 mb-2'
              >
                Confirmation Code
              </label>
              <input
                id='confirmationCode'
                name='confirmationCode'
                type='text'
                autoComplete='one-time-code'
                required
                maxLength={6}
                value={confirmationCode}
                onChange={(e) => {
                  setConfirmationCode(
                    e.target.value.replace(/\D/g, '').slice(0, 6)
                  );
                  setError('');
                  setSuccess('');
                }}
                className='block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center text-lg font-mono tracking-wider'
                placeholder='000000'
              />
              <p className='mt-2 text-sm text-gray-600'>
                Enter the 6-digit code from your email
              </p>
            </div>

            {/* Submit Button */}
            <div>
              <Button
                type='submit'
                loading={isSubmitting}
                disabled={confirmationCode.length !== 6 || isSubmitting}
                variant='outline'
                className='w-full font-semibold py-3 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed'
              >
                <div className='flex items-center justify-center space-x-2'>
                  {isSubmitting ? (
                    <>
                      <div className='animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent'></div>
                      <span>Confirming...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className='h-5 w-5' />
                      <span>Confirm Email</span>
                    </>
                  )}
                </div>
              </Button>
            </div>

            {/* Resend Code */}
            <div className='text-center'>
              <p className='text-sm text-gray-600 mb-3'>
                Didn't receive the code?
              </p>
              <button
                type='button'
                onClick={handleResendCode}
                disabled={isResending}
                className='text-blue-600 hover:text-blue-500 text-sm font-medium disabled:opacity-50'
              >
                {isResending ? 'Sending...' : 'Resend Code'}
              </button>
            </div>

            {/* Back Button */}
            <div className='pt-4 border-t'>
              <button
                type='button'
                onClick={onBack}
                className='w-full flex items-center justify-center space-x-2 text-gray-600 hover:text-gray-800 py-2'
              >
                <ArrowLeft className='h-4 w-4' />
                <span>Back to Login</span>
              </button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default EmailConfirmation;
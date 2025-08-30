import React, { useState } from 'react';
import { useAuthContext } from '../../context/AuthProvider';
import Button from '../ui/Button';
import Card from '../ui/Card';

const Login = () => {
  const [formData, setFormData] = useState({
    email: 'user1@test.com', // Pre-filled for easier testing
    password: 'password123',
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login, error } = useAuthContext();

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const result = await login(formData.email, formData.password);

      if (result.success) {
        // Redirect will happen automatically via auth context
        console.log('Login successful!');
      }
    } catch (error) {
      console.error('Login error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className='min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8'>
      <div className='max-w-md w-full space-y-8'>
        {/* Header */}
        <div className='text-center'>
          <div className='flex justify-center items-center mb-4'>
            <div className='w-12 h-12 bg-primary-600 rounded-lg flex items-center justify-center'>
              <svg
                className='w-8 h-8 text-white'
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
          </div>
          <h2 className='text-3xl font-extrabold text-gray-900'>Video Forge</h2>
          <p className='mt-2 text-sm text-gray-600'>
            Sign in to your account to begin your video processing
          </p>
        </div>

        {/* Login Form */}
        <Card className='max-w-md'>
          <form className='space-y-6' onSubmit={handleSubmit}>
            {error && (
              <div className='rounded-md bg-red-50 p-4 border border-red-200'>
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
                      Login Failed
                    </h3>
                    <div className='mt-2 text-sm text-red-700'>{error}</div>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label
                htmlFor='email'
                className='block text-sm font-medium text-gray-700'
              >
                Email address
              </label>
              <div className='mt-1'>
                <input
                  id='email'
                  name='email'
                  type='email'
                  autoComplete='email'
                  required
                  value={formData.email}
                  onChange={handleInputChange}
                  className='appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm'
                  placeholder='Enter your email'
                />
              </div>
            </div>

            <div>
              <label
                htmlFor='password'
                className='block text-sm font-medium text-gray-700'
              >
                Password
              </label>
              <div className='mt-1'>
                <input
                  id='password'
                  name='password'
                  type='password'
                  autoComplete='current-password'
                  required
                  value={formData.password}
                  onChange={handleInputChange}
                  className='appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm'
                  placeholder='Enter your password'
                />
              </div>
            </div>

            <div>
              <Button
                type='submit'
                loading={isSubmitting}
                disabled={!formData.email || !formData.password}
                className='w-full'
                size='lg'
              >
                {isSubmitting ? 'Signing in...' : 'Sign in'}
              </Button>
            </div>

            {/* Test Accounts Info */}
            <div className='mt-6 p-4 bg-blue-50 rounded-md border border-blue-200'>
              <h4 className='text-sm font-medium text-blue-800 mb-2'>
                Test Accounts:
              </h4>
              <div className='text-xs text-blue-700 space-y-1'>
                <div>
                  <strong>User:</strong> user@test.com / password123
                </div>
              </div>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default Login;

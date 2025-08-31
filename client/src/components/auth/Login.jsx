import React, { useState } from 'react';
import { useAuthContext } from '../../context/AuthProvider';
import Button from '../ui/Button';
import Card from '../ui/Card';
import { User, Mail, Lock, UserPlus, LogIn, Video } from 'lucide-react';

const Login = () => {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [formData, setFormData] = useState({
    email: isRegisterMode ? '' : 'user1@test.com', // Pre-filled for login testing
    password: isRegisterMode ? '' : 'password123',
    confirmPassword: '',
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registerError, setRegisterError] = useState('');
  const [registerSuccess, setRegisterSuccess] = useState('');

  const { login, error } = useAuthContext();

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear errors when user starts typing
    if (registerError) setRegisterError('');
    if (registerSuccess) setRegisterSuccess('');
  };

  const handleModeToggle = () => {
    setIsRegisterMode(!isRegisterMode);
    setFormData({
      email: isRegisterMode ? 'user1@test.com' : '',
      password: isRegisterMode ? 'password123' : '',
      confirmPassword: '',
    });
    setRegisterError('');
    setRegisterSuccess('');
  };

  const validateRegisterForm = () => {
    if (!formData.email || !formData.password || !formData.confirmPassword) {
      setRegisterError('All fields are required');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setRegisterError('Passwords do not match');
      return false;
    }
    if (formData.password.length < 6) {
      setRegisterError('Password must be at least 6 characters long');
      return false;
    }
    return true;
  };

  const handleRegister = async (formData) => {
    try {
      // Replace with your actual API endpoint
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setRegisterSuccess('Account created successfully! You can now login.');
        setTimeout(() => {
          setIsRegisterMode(false);
          setFormData({
            email: formData.email,
            password: '',
            confirmPassword: '',
          });
        }, 2000);
        return { success: true };
      } else {
        setRegisterError(data.message || 'Registration failed');
        return { success: false };
      }
    } catch (error) {
      setRegisterError('Network error. Please try again.');
      return { success: false };
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (isRegisterMode) {
        if (!validateRegisterForm()) {
          setIsSubmitting(false);
          return;
        }
        await handleRegister(formData);
      } else {
        const result = await login(formData.email, formData.password);
        if (result.success) {
          console.log('Login successful!');
        }
      }
    } catch (error) {
      console.error('Auth error:', error);
      if (isRegisterMode) {
        setRegisterError('Registration failed. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className='min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 py-12 px-4 sm:px-6 lg:px-8'>
      <div className='max-w-md w-full space-y-8'>
        {/* Header */}
        <div className='text-center'>
          
          <h2 className='text-4xl font-bold text-gray-900 mb-2'>Video Forge</h2>
          <p className='text-lg text-gray-600 mb-6'>
            {isRegisterMode 
              ? 'Create your account to start processing videos' 
              : 'Sign in to your account to begin your video processing'
            }
          </p>
          
          {/* Mode Toggle */}
          <div className="flex items-center justify-center bg-gray-100 p-1 rounded-lg mb-6">
            <button
              type="button"
              onClick={handleModeToggle}
              className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                !isRegisterMode 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <LogIn className="h-4 w-4" />
              <span>Sign In</span>
            </button>
            <button
              type="button"
              onClick={handleModeToggle}
              className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                isRegisterMode 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <UserPlus className="h-4 w-4" />
              <span>Sign Up</span>
            </button>
          </div>
        </div>

        {/* Auth Form */}
        <Card className='p-8 bg-white shadow-xl border-0'>
          <form className='space-y-6' onSubmit={handleSubmit}>
            {/* Error Messages */}
            {(error || registerError) && (
              <div className='rounded-lg bg-red-50 p-4 border border-red-200'>
                <div className='flex'>
                  <div className='flex-shrink-0'>
                    <svg className='h-5 w-5 text-red-400' viewBox='0 0 20 20' fill='currentColor'>
                      <path fillRule='evenodd' d='M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z' clipRule='evenodd' />
                    </svg>
                  </div>
                  <div className='ml-3'>
                    <h3 className='text-sm font-medium text-red-800'>
                      {isRegisterMode ? 'Registration Failed' : 'Login Failed'}
                    </h3>
                    <div className='mt-2 text-sm text-red-700'>
                      {registerError || error}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Success Message */}
            {registerSuccess && (
              <div className='rounded-lg bg-green-50 p-4 border border-green-200'>
                <div className='flex'>
                  <div className='flex-shrink-0'>
                    <svg className='h-5 w-5 text-green-400' viewBox='0 0 20 20' fill='currentColor'>
                      <path fillRule='evenodd' d='M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z' clipRule='evenodd' />
                    </svg>
                  </div>
                  <div className='ml-3'>
                    <h3 className='text-sm font-medium text-green-800'>Success!</h3>
                    <div className='mt-2 text-sm text-green-700'>{registerSuccess}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Email Field */}
            <div>
              <label htmlFor='email' className='block text-sm font-medium text-gray-700 mb-2'>
                Email address
              </label>
              <div className='relative'>
                <div className='absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none'>
                  <Mail className='h-5 w-5 text-gray-400' />
                </div>
                <input
                  id='email'
                  name='email'
                  type='email'
                  autoComplete='email'
                  required
                  value={formData.email}
                  onChange={handleInputChange}
                  className='block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                  placeholder='Enter your email'
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor='password' className='block text-sm font-medium text-gray-700 mb-2'>
                Password
              </label>
              <div className='relative'>
                <div className='absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none'>
                  <Lock className='h-5 w-5 text-gray-400' />
                </div>
                <input
                  id='password'
                  name='password'
                  type='password'
                  autoComplete={isRegisterMode ? 'new-password' : 'current-password'}
                  required
                  value={formData.password}
                  onChange={handleInputChange}
                  className='block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                  placeholder='Enter your password'
                />
              </div>
            </div>

            {/* Confirm Password Field - Only for Register */}
            {isRegisterMode && (
              <div>
                <label htmlFor='confirmPassword' className='block text-sm font-medium text-gray-700 mb-2'>
                  Confirm Password
                </label>
                <div className='relative'>
                  <div className='absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none'>
                    <Lock className='h-5 w-5 text-gray-400' />
                  </div>
                  <input
                    id='confirmPassword'
                    name='confirmPassword'
                    type='password'
                    autoComplete='new-password'
                    required
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    className='block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                    placeholder='Confirm your password'
                  />
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div>
              <Button
                type='submit'
                variant='outline'
                loading={isSubmitting}
                disabled={
                  isRegisterMode 
                    ? !formData.email || !formData.password || !formData.confirmPassword
                    : !formData.email || !formData.password
                }
                className='w-full font-semibold py-3 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed'
              >
                <div className="flex items-center justify-center space-x-2">
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                      <span>{isRegisterMode ? 'Creating Account...' : 'Signing In...'}</span>
                    </>
                  ) : (
                    <>
                      {isRegisterMode ? <UserPlus className="h-5 w-5" /> : <LogIn className="h-5 w-5" />}
                      <span>{isRegisterMode ? 'Create Account' : 'Sign In'}</span>
                    </>
                  )}
                </div>
              </Button>
            </div>

            {/* Test Accounts Info - Only show for login */}
            {!isRegisterMode && (
              <div className='mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200'>
                <h4 className='text-sm font-medium text-blue-800 mb-2 flex items-center'>
                  <User className="h-4 w-4 mr-2" />
                  Test Account:
                </h4>
                <div className='text-xs text-blue-700 space-y-1'>
                  <div>
                    <strong>Email:</strong> user1@test.com
                  </div>
                  <div>
                    <strong>Password:</strong> password123
                  </div>
                </div>
              </div>
            )}
          </form>
        </Card>
      </div>
    </div>
  );
};

export default Login;

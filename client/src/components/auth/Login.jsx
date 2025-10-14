import React, { useState } from 'react';
import { useAuthContext } from '../../context/AuthProvider';
import Button from '../ui/Button';
import Card from '../ui/Card';
import { User, Mail, Lock, UserPlus, LogIn } from 'lucide-react';
import { authService } from '../../services/auth';
import MFALogin from './MFALogin';
import EmailConfirmation from './EmailConfirmation';

import { useNavigate } from 'react-router-dom';

const Login = () => {
  
  const { login, error } = useAuthContext();
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: isRegisterMode ? '' : 'Free200209!',
    username: isRegisterMode ? '' : 'alxyoo95',
    confirmPassword: '',
  });

  const navigate = useNavigate();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registerError, setRegisterError] = useState('');
  const [registerSuccess, setRegisterSuccess] = useState('');
  const [loginError, setLoginError] = useState('');
  const [showEmailConfirmation, setShowEmailConfirmation] = useState(false);
  const [showMFA, setShowMFA] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const [pendingUsername, setPendingUsername] = useState('');
  const [isGoogleSignIn, setIsGoogleSignIn] = useState(false);


  // Password validation function
  const validatePassword = (password) => {
    const requirements = {
      length: password.length >= 8,
      number: /\d/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password)
    };

    const isValid = Object.values(requirements).every(req => req);
    return { requirements, isValid };
  };

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
      email: '',
      password: isRegisterMode ? 'Free200209!' : '',
      username: isRegisterMode ? 'alxyoo95' : '',
      confirmPassword: '',
    });
    setRegisterError('');
    setRegisterSuccess('');
  };

  const validateRegisterForm = () => {
    if (!formData.email || !formData.password || !formData.username || !formData.confirmPassword) {
      setRegisterError('All fields are required');
      return false;
    }
    if (formData.username.length < 3) {
      setRegisterError('Username must be at least 3 characters long');
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
      // Validate password requirements
      const passwordValidation = validatePassword(formData.password);
      if (!passwordValidation.isValid) {
        throw new Error('Password does not meet security requirements');
      }

      const result = await authService.register(formData.email, formData.password, formData.username);
      
      // Check if email verification is required
      const verificationMessage = result.result?.message || result.message;
      if (verificationMessage && verificationMessage.includes('verification code')) {
        setPendingEmail(formData.email);
        setPendingUsername(formData.username);
        setShowEmailConfirmation(true);
        return { success: true, requiresVerification: true };
      }
      
      // Legacy success flow
      setRegisterSuccess('Account created successfully! You can now login.');
      setTimeout(() => {
        setIsRegisterMode(false);
        setFormData({
          email: formData.email,
          password: '',
          username: '',
          confirmPassword: '',
        });
      }, 2000);
      return { success: true };
    } catch (error) {
      setRegisterError(error.message);
      return { success: false };
    }
  };

  const handleSubmit = async (e) => {
    try {
      
      e.preventDefault(); 
      setIsSubmitting(true);
      setLoginError(''); // Clear previous login errors
      setRegisterError(''); // Clear previous register errors

      if (isRegisterMode) {
        if (!validateRegisterForm()) {
          setIsSubmitting(false);
          return;
        }
        await handleRegister(formData);
      } else {

        const result = await login(formData.username, formData.password);

        if (result.success) {
          console.log('✅ Login successful');
        } else if (result.requiresMFA) {
          console.log('🔒 MFA required, setting state like email confirmation');
          setShowMFA(true);
          navigate('/mfa-login', {
            state: {
              session: result.session,
              challenge: {
                name: result.challengeName,
                message: result.message,
                destination: result.destination,
              },
              username: formData.username,
            },
          });

        } else if (result.requiresVerification) {
          setPendingEmail(result.email);
          setPendingUsername(formData.username);
          setShowEmailConfirmation(true);
        } else if (result.error) {
          setLoginError(result.error);
        } else {
          setLoginError('Login failed. Please try again.');
        }
      }
    } catch (error) {
      console.error('HandleSubmit error:', error);
      if (isRegisterMode) {
        setRegisterError(error.message || 'Registration failed. Please try again.');
      } else {
        setLoginError(error.message || 'Login failed. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // const handleMFASuccess = async () => {
  //   setShowMFA(false);
  //   setMfaSession('');
  //   setMfaChallenge(null);
  //   // MFA login successful - user will be set by auth context
  // };


  const handleGoogleSignIn = async () => {
    try {
      setIsGoogleSignIn(true);
      setLoginError('');

      const authUrl = await authService.getGoogleAuthUrl();
      window.location.href = authUrl;
    } catch (error) {
      console.error('Google Sign-In error:', error);
      setLoginError(error.message || 'Failed to initiate Google Sign-In');
      setIsGoogleSignIn(false);
    }
  };

  const handleEmailConfirmationSuccess = () => {
    setShowEmailConfirmation(false);
    setPendingEmail('');
    setPendingUsername('');
    setRegisterSuccess('Email confirmed successfully! You can now log in.');
    setIsRegisterMode(false);
    setTimeout(() => {
      setRegisterSuccess('');
    }, 5000);
  };

  const handleEmailConfirmationBack = () => {
    setShowEmailConfirmation(false);
    setPendingEmail('');
    setPendingUsername('');
  };

  if (showMFA) {
    return (
      <MFALogin />
    );
  }

  if (showEmailConfirmation) {
    return (
      <EmailConfirmation
        email={pendingEmail}
        username={pendingUsername}
        onSuccess={handleEmailConfirmationSuccess}
        onBack={handleEmailConfirmationBack}
      />
    );
  }

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
          <div className='space-y-6'>
            {/* Error Messages */}
            {(error || registerError || loginError) && (
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
                      {registerError || loginError || error}
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

            {/* Email Field - Only for Register */}
            {isRegisterMode && (
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
            )}

            {/* Username Field - For Login and Register */}
            <div>
              <label htmlFor='username' className='block text-sm font-medium text-gray-700 mb-2'>
                Username
              </label>
              <div className='relative'>
                <div className='absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none'>
                  <User className='h-5 w-5 text-gray-400' />
                </div>
                <input
                  id='username'
                  name='username'
                  type='text'
                  autoComplete='username'
                  required
                  value={formData.username}
                  onChange={handleInputChange}
                  className='block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                  placeholder='Enter your username'
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

              {/* Password Requirements - Only for Register */}
              {isRegisterMode && formData.password && (
                <div className="mt-2 text-sm">
                  <div className="text-gray-600 mb-1">Password must contain:</div>
                  {(() => {
                    const validation = validatePassword(formData.password);
                    return (
                      <ul className="space-y-1">
                        <li className={`flex items-center ${validation.requirements.length ? 'text-green-600' : 'text-red-600'}`}>
                          <span className="mr-2">{validation.requirements.length ? '✓' : '✗'}</span>
                          At least 8 characters
                        </li>
                        <li className={`flex items-center ${validation.requirements.uppercase ? 'text-green-600' : 'text-red-600'}`}>
                          <span className="mr-2">{validation.requirements.uppercase ? '✓' : '✗'}</span>
                          One uppercase letter
                        </li>
                        <li className={`flex items-center ${validation.requirements.lowercase ? 'text-green-600' : 'text-red-600'}`}>
                          <span className="mr-2">{validation.requirements.lowercase ? '✓' : '✗'}</span>
                          One lowercase letter
                        </li>
                        <li className={`flex items-center ${validation.requirements.number ? 'text-green-600' : 'text-red-600'}`}>
                          <span className="mr-2">{validation.requirements.number ? '✓' : '✗'}</span>
                          One number
                        </li>
                        <li className={`flex items-center ${validation.requirements.special ? 'text-green-600' : 'text-red-600'}`}>
                          <span className="mr-2">{validation.requirements.special ? '✓' : '✗'}</span>
                          One special character (!@#$%^&*...)
                        </li>
                      </ul>
                    );
                  })()}
                </div>
              )}
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
                onClick={handleSubmit}
                disabled={
                  isRegisterMode
                    ? !formData.email || !formData.password || !formData.username || !formData.confirmPassword
                    : !formData.username || !formData.password
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

            {/* Login mode only - Google Sign-In */}
            {!isRegisterMode && (
              <>
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">Or continue with</span>
                  </div>
                </div>

                <div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleGoogleSignIn}
                    disabled={isGoogleSignIn}
                    className="w-full font-semibold py-3 px-4 rounded-lg border-gray-300 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center justify-center space-x-3">
                      {isGoogleSignIn ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-300 border-t-transparent"></div>
                          <span>Redirecting to Google...</span>
                        </>
                      ) : (
                        <>
                          <svg className="h-5 w-5" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                          </svg>
                          <span>Sign in with Google</span>
                        </>
                      )}
                    </div>
                  </Button>
                </div>
              </>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Login;

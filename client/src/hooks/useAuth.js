import { useState, useEffect } from 'react';
import { authService } from '../services/auth';

export const useAuth = () => {
  const [user, setUser] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const initAuth = () => {
      try {
        if (authService.isAuthenticated()) {
          const currentUser = authService.getCurrentUser();
          setUser(currentUser);
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        setError('Failed to initialize authentication');
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (email, password) => {
    try {
      setLoading(true);
      setError(null);

      const result = await authService.login(email, password);

      // Check if MFA is required
      if (result.requiresMFA) {
        return {
          success: false,
          requiresMFA: true,
          session: result.session,
          challengeName: result.challengeName,
          message: result.message,
          destination: result.destination
        };
      }

      // Check if it's a successful login with user data
      if (result.user) {
        setUser(result.user);
        return { success: true };
      }

    } catch (error) {
      console.error('useAuth.login failed:', error);

      // Check if user needs email verification
      if (error.message.includes('verify your email') ||
          error.message.includes('UserNotConfirmedException')) {
        return {
          success: false,
          requiresVerification: true,
          email: email,
          error: 'Please verify your email before logging in.'
        };
      }

      setError(error.message);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const completeMFALogin = async (session, otpCode, challengeName = 'EMAIL_OTP', username = null) => {
    try {
      setLoading(true);
      setError(null);

      const { user: userData } = await authService.completeMFA(session, otpCode, challengeName, username);
      setUser(userData);

      return { success: true };
    } catch (error) {
      setError(error.message);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setError(null);
    }
  };

  const loginWithToken = (user) => {
    // For OAuth logins where we already have the user data
    setUser(user);
    return { success: true };
  };

  return {
    user,
    loading,
    error,
    login,
    loginWithToken,
    completeMFALogin,
    logout,
    isAuthenticated: !!user,
  };
};

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

      try {
        const { user: userData } = await authService.login(email, password);
        setUser(userData);
        return { success: true };
      } catch (loginError) {
        const mfaResult = await authService.loginWithMFA(email, password);
        
        if (mfaResult.challenge === 'SOFTWARE_TOKEN_MFA') {
          return { 
            success: false, 
            requiresMFA: true, 
            session: mfaResult.session 
          };
        }
        
        if (mfaResult.tokens) {
          const { user: userData } = mfaResult;
          setUser(userData);
          return { success: true };
        }
        
        throw loginError;
      }
    } catch (error) {
      setError(error.message);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const completeMFALogin = async (session, totpCode) => {
    try {
      setLoading(true);
      setError(null);

      const { user: userData } = await authService.completeMFA(session, totpCode);
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

  return {
    user,
    loading,
    error,
    login,
    completeMFALogin,
    logout,
    isAuthenticated: !!user,
  };
};

import api from './api';

export const authService = {
  async login(email, password) {
    try {
      const response = await api.post('/auth/login', { email, password });
      
      if (response.status === 200 && response.data.result) {
        const result = response.data.result;
        
        // Handle Cognito response (has tokens object) or legacy response (has token)
        let token, user;
        
        if (result.tokens && result.tokens.idToken) {
          // Cognito response
          token = result.tokens.idToken;
          user = result.user;
        } else if (result.token) {
          // Legacy response
          token = result.token;
          user = result.user;
        } else {
          throw new Error('Invalid response format');
        }
        
        // Store token and user info
        localStorage.setItem('video_forge_token', token);
        localStorage.setItem('video_forge_user', JSON.stringify(user));
        
        // Store Cognito tokens if available
        if (result.tokens) {
          localStorage.setItem('video_forge_access_token', result.tokens.accessToken);
          localStorage.setItem('video_forge_refresh_token', result.tokens.refreshToken);
        }
        
        return { token, user };
      }
      
      throw new Error('Invalid response format');
    } catch (error) {
      const message = error.response?.data?.message || 'Login failed';
      throw new Error(message);
    }
  },

  async logout() {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Always clear local storage
      localStorage.removeItem('video_forge_token');
      localStorage.removeItem('video_forge_user');
      localStorage.removeItem('video_forge_access_token');
      localStorage.removeItem('video_forge_refresh_token');
    }
  },

  async getProfile() {
    try {
      const response = await api.get('/auth/profile');
      return response.data;
    } catch (error) {
      throw new Error('Failed to get user profile');
    }
  },

  getCurrentUser() {
    const userStr = localStorage.getItem('video_forge_user');
    return userStr ? JSON.parse(userStr) : null;
  },

  getToken() {
    return localStorage.getItem('video_forge_token');
  },

  isAuthenticated() {
    const token = this.getToken();
    const user = this.getCurrentUser();
    return !!(token && user);
  },

  async register(email, password, username) {
    try {
      const response = await api.post('/auth/register-with-group', { 
        email, 
        password, 
        username 
      });
      return response.data;
    } catch (error) {
      const message = error.response?.data?.message || 'Registration failed';
      throw new Error(message);
    }
  },

  async loginWithMFA(email, password) {
    try {
      const response = await api.post('/auth/mfa/login', { email, password });
      return response.data;
    } catch (error) {
      const message = error.response?.data?.message || 'MFA login failed';
      throw new Error(message);
    }
  },

  async completeMFA(session, totpCode) {
    try {
      const response = await api.post('/auth/mfa/complete', { 
        session, 
        totpCode 
      });
      
      if (response.status === 200 && response.data.result) {
        const result = response.data.result;
        const token = result.tokens.idToken;
        const user = result.user;
        
        localStorage.setItem('video_forge_token', token);
        localStorage.setItem('video_forge_user', JSON.stringify(user));
        localStorage.setItem('video_forge_access_token', result.tokens.accessToken);
        localStorage.setItem('video_forge_refresh_token', result.tokens.refreshToken);
        
        return { token, user };
      }
      
      throw new Error('Invalid response format');
    } catch (error) {
      const message = error.response?.data?.message || 'MFA completion failed';
      throw new Error(message);
    }
  },

  async setupMFA() {
    try {
      const response = await api.post('/auth/mfa/setup');
      return response.data.result;
    } catch (error) {
      const message = error.response?.data?.message || 'MFA setup failed';
      throw new Error(message);
    }
  },

  async verifyMFA(totpCode) {
    try {
      const response = await api.post('/auth/mfa/verify', { totpCode });
      return response.data;
    } catch (error) {
      const message = error.response?.data?.message || 'MFA verification failed';
      throw new Error(message);
    }
  },

  async disableMFA() {
    try {
      const response = await api.delete('/auth/mfa/disable');
      return response.data;
    } catch (error) {
      const message = error.response?.data?.message || 'MFA disable failed';
      throw new Error(message);
    }
  },

  async promoteToAdmin(email) {
    try {
      const response = await api.post('/auth/groups/admin', { email });
      return response.data;
    } catch (error) {
      const message = error.response?.data?.message || 'Admin promotion failed';
      throw new Error(message);
    }
  },

  async getUserPermissions(email) {
    try {
      const response = await api.get(`/auth/users/${email}/permissions`);
      return response.data.result;
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to get permissions';
      throw new Error(message);
    }
  }
};
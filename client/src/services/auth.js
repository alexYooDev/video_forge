import api from './api';

export const authService = {
  async login(username, password) {
    try {
      const response = await api.post('/auth/login', { username, password });

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
      // Check if it's an MFA challenge (401 with MFA_REQUIRED)
      if (error.response?.status === 401 && error.response?.data?.error === 'MFA_REQUIRED') {
        // Return MFA challenge data instead of throwing
        return {
          requiresMFA: true,
          challengeName: error.response.data.challengeName,
          session: error.response.data.session,
          message: error.response.data.message,
          destination: error.response.data.destination
        };
      }

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


  async completeMFA(session, otpCode, challengeName = 'EMAIL_OTP', username = null) {
    try {
      if (challengeName !== 'EMAIL_OTP') {
        throw new Error('Only EMAIL_OTP challenge is supported');
      }

      const response = await api.post('/auth/mfa/complete', {
        session,
        otpCode,
        challengeName,
        username
      });

      if (response.status === 200 && response.data.result) {
        const result = response.data.result;
        const token = result.tokens?.idToken || result.tokens?.IdToken;
        const user = result.user;

        localStorage.setItem('video_forge_token', token);
        localStorage.setItem('video_forge_user', JSON.stringify(user));
        localStorage.setItem('video_forge_access_token', result.tokens.accessToken || result.tokens.AccessToken);
        localStorage.setItem('video_forge_refresh_token', result.tokens.refreshToken || result.tokens.RefreshToken);

        return { token, user };
      }

      throw new Error('Invalid response format');
    } catch (error) {
      const message = error.response?.data?.message || 'Email OTP MFA completion failed';
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
  },

  async confirmEmail(email, confirmationCode, username) {
    try {
      const response = await api.post('/auth/confirm-email', {
        email,
        confirmationCode,
        username
      });
      return response.data;
    } catch (error) {
      const message = error.response?.data?.message || 'Email confirmation failed';
      throw new Error(message);
    }
  },

  async resendConfirmation(email, username) {
    try {
      const response = await api.post('/auth/resend-confirmation', {
        email,
        username
      });
      return response.data;
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to resend confirmation';
      throw new Error(message);
    }
  },

  // ============ FEDERATED AUTHENTICATION ============

  async getGoogleAuthUrl() {
    try {
      const redirectUri = `${window.location.origin}/auth/callback`;
      const response = await api.get(`/auth/oauth/url?provider=Google&redirectUri=${encodeURIComponent(redirectUri)}`);
      return response.data.authUrl;
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to get Google auth URL';
      throw new Error(message);
    }
  },

  async handleOAuthCallback(code) {
    try {
      const redirectUri = `${window.location.origin}/auth/callback`;
      const response = await api.post('/auth/oauth/callback', {
        code,
        redirectUri
      });

      if (response.status === 200 && response.data.user) {
        const { user, token } = response.data;

        // Store token and user info
        localStorage.setItem('video_forge_token', token);
        localStorage.setItem('video_forge_user', JSON.stringify(user));

        return { user, token };
      }

      throw new Error('Invalid OAuth callback response');
    } catch (error) {
      const message = error.response?.data?.message || 'OAuth authentication failed';
      throw new Error(message);
    }
  }
};
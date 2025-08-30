import api from './api';

export const authService = {
  async login(email, password) {
    try {
      const response = await api.post('/auth/login', { email, password });
      
      if (response.status === 200 && response.data.data.token) {
        const { token, user } = response.data.data;
        
        // Store token and user info
        localStorage.setItem('video_forge_token', token);
        localStorage.setItem('video_forge_user', JSON.stringify(user));
        
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
    }
  },

  async getProfile() {
    try {
      const response = await api.get('/auth/profile');
      return response.data.data;
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
  }
};
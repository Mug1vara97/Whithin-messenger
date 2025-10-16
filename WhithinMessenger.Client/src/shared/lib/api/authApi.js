import apiClient from './apiClient';

export const authApi = {
  async login(credentials) {
    try {
      console.log('Sending login request:', credentials);
      const response = await apiClient.post('/auth/login', credentials);
      console.log('Login response:', response);
      return response.data;
    } catch (error) {
      console.error('Login error details:', error);
      throw new Error(error.response?.data?.error || 'Login failed');
    }
  },

  async register(userData) {
    try {
      const response = await apiClient.post('/auth/register', userData);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Registration failed');
    }
  },

  async logout() {
    try {
      await apiClient.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('user');
    }
  },

  async getCurrentUser() {
    try {
      const response = await apiClient.get('/auth/status');
      if (response.data.IsAuthenticated) {
        return response.data.User;
      }
      return null;
    } catch (error) {
      throw new Error('Failed to get user data');
    }
  }
};

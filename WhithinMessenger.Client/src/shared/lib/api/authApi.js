import apiClient from './apiClient';
import tokenManager from '../services/tokenManager';

export const authApi = {
  async login(credentials) {
    try {
      console.log('Sending login request:', credentials);
      const response = await apiClient.post('/auth/login', credentials);
      console.log('Login response:', response);
      
      // Сохраняем JWT токен
      if (response.data.token) {
        console.log('Saving JWT token:', response.data.token);
        tokenManager.setToken(response.data.token);
      } else {
        console.warn('No token in response:', response.data);
      }
      
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
      // Очищаем токены и пользователя
      tokenManager.clearTokens();
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
      console.error('Error getting current user:', error);
      throw new Error('Failed to get user data');
    }
  }
};

import apiClient from './apiClient';
import tokenManager from '../services/tokenManager';

const applyAuthTokens = (payload) => {
  if (payload?.token) {
    tokenManager.setToken(payload.token);
  }

  if (payload?.refreshToken) {
    tokenManager.setRefreshToken(payload.refreshToken);
  }
};

export const authApi = {
  async login(credentials) {
    try {
      console.log('Sending login request:', credentials);
      const response = await apiClient.post('/auth/login', credentials);
      console.log('Login response:', response);
      applyAuthTokens(response.data);
      
      return response.data;
    } catch (error) {
      console.error('Login error details:', error);
      const payload = error.response?.data ?? {};
      const authError = new Error(payload.error || payload.Error || 'Login failed');
      authError.requiresEmailConfirmation = !!(
        payload.requiresEmailConfirmation ?? payload.RequiresEmailConfirmation
      );
      authError.email = payload.email ?? payload.Email ?? null;
      throw authError;
    }
  },

  async register(userData) {
    try {
      const response = await apiClient.post('/auth/register', userData);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || error.response?.data?.Error || 'Registration failed');
    }
  },

  async confirmEmail({ userId, token }) {
    try {
      const response = await apiClient.post('/auth/confirm-email', { userId, token });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || error.response?.data?.Error || 'Email confirmation failed');
    }
  },

  async confirmPasswordChange({ userId, token }) {
    try {
      const response = await apiClient.post('/auth/confirm-password-change', {
        userId,
        token,
      });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || error.response?.data?.Error || 'Не удалось подтвердить смену пароля');
    }
  },

  async confirmEmailChange({ userId, newEmail, token }) {
    try {
      const response = await apiClient.post('/auth/confirm-email-change', {
        userId,
        newEmail,
        token,
      });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || error.response?.data?.Error || 'Не удалось подтвердить смену email');
    }
  },

  async resendConfirmation(email) {
    try {
      const response = await apiClient.post('/auth/resend-confirmation', { email });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || error.response?.data?.Error || 'Failed to resend confirmation email');
    }
  },

  async logout() {
    try {
      const refreshToken = tokenManager.getRefreshToken();
      await apiClient.post('/auth/logout', { refreshToken });
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
  ,
  async createQrLoginSession() {
    try {
      const response = await apiClient.post('/auth/qr/session');
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to create QR session');
    }
  },
  async getQrLoginSessionStatus(sessionId) {
    try {
      const response = await apiClient.get(`/auth/qr/session/${encodeURIComponent(sessionId)}`);
      applyAuthTokens(response.data);
      return response.data;
    } catch (error) {
      const status = error.response?.data?.status;
      if (status === 'expired' || error.response?.status === 404) {
        return { status: 'expired' };
      }
      throw new Error(error.response?.data?.error || 'Failed to check QR session');
    }
  },
  async refreshToken() {
    const refreshToken = tokenManager.getRefreshToken();
    if (!refreshToken) {
      throw new Error('No refresh token');
    }

    const response = await apiClient.post('/auth/refresh', { refreshToken });
    applyAuthTokens(response.data);
    return response.data;
  }
};

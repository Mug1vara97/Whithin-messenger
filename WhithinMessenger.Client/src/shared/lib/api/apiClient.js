import axios from 'axios';
import { BASE_URL } from '../constants/apiEndpoints';
import tokenManager from '../services/tokenManager';

let refreshPromise = null;

const apiClient = axios.create({
  baseURL: BASE_URL ? BASE_URL + '/api' : '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

apiClient.interceptors.request.use(
  (config) => {
    // Добавляем JWT токен в заголовок Authorization
    const token = tokenManager.getToken();
    if (token && tokenManager.isTokenValid()) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log('API Client: Adding JWT token to request:', config.url);
    } else {
      console.log('API Client: No valid token available for request:', config.url);
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    const requestUrl = (originalRequest?.url || '').toLowerCase();
    const isRefreshRequest = requestUrl.includes('/auth/refresh');
    
    // Если получили 401 и это не повторный запрос
    if (error.response?.status === 401 && !originalRequest?._retry && !isRefreshRequest) {
      originalRequest._retry = true;
      const refreshToken = tokenManager.getRefreshToken();
      if (!refreshToken) {
        tokenManager.clearTokens();
        localStorage.removeItem('user');
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }

      try {
        if (!refreshPromise) {
          refreshPromise = axios.post(
            `${BASE_URL ? BASE_URL + '/api' : '/api'}/auth/refresh`,
            { refreshToken },
            { withCredentials: true }
          ).finally(() => {
            refreshPromise = null;
          });
        }

        const refreshResponse = await refreshPromise;
        const newAccessToken = refreshResponse?.data?.token;
        const newRefreshToken = refreshResponse?.data?.refreshToken;
        if (!newAccessToken) {
          throw new Error('Refresh response does not contain access token');
        }

        tokenManager.setToken(newAccessToken);
        if (newRefreshToken) {
          tokenManager.setRefreshToken(newRefreshToken);
        }

        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        tokenManager.clearTokens();
        localStorage.removeItem('user');
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      }
    }
    
    if (error.code === 'ERR_NETWORK' || error.message.includes('CORS')) {
      console.error('CORS Error: Make sure the server is running and CORS is configured properly');
    }
    
    return Promise.reject(error);
  }
);

export default apiClient;

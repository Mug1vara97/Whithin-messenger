import axios from 'axios';
import { BASE_URL } from '../constants/apiEndpoints';
import tokenManager from '../services/tokenManager';

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
    
    // Если получили 401 и это не повторный запрос
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      // Очищаем токены и перенаправляем на логин
      tokenManager.clearTokens();
      localStorage.removeItem('user');
      
      // Перенаправляем на страницу логина только если мы не на ней уже
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    
    if (error.code === 'ERR_NETWORK' || error.message.includes('CORS')) {
      console.error('CORS Error: Make sure the server is running and CORS is configured properly');
    }
    
    return Promise.reject(error);
  }
);

export default apiClient;

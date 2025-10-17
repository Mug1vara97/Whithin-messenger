import axios from 'axios';
import { BASE_URL } from '../constants/apiEndpoints';

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
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    
    if (error.code === 'ERR_NETWORK' || error.message.includes('CORS')) {
      console.error('CORS Error: Make sure the server is running and CORS is configured properly');
    }
    
    return Promise.reject(error);
  }
);

export default apiClient;

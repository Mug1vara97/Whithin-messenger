import { useState, useCallback, useEffect } from 'react';
import { authApi } from '../api/authApi';
import { useUser } from './useUser';
import tokenManager from '../services/tokenManager';

export const useAuth = () => {
  const { user, updateUser, clearUser, isLoading: userLoading, setIsLoading } = useUser();
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        console.log('useAuth: Initializing authentication...');
        const token = tokenManager.getToken();
        const isValid = tokenManager.isTokenValid();
        console.log('useAuth: Token exists:', !!token);
        console.log('useAuth: Token valid:', isValid);
        
        // Проверяем, есть ли валидный токен
        if (isValid) {
          console.log('useAuth: Token is valid, getting user info...');
          // Если токен валиден, получаем информацию о пользователе
          const userFromToken = tokenManager.getUserFromToken();
          if (userFromToken) {
            console.log('useAuth: User from token:', userFromToken);
            updateUser(userFromToken);
          } else {
            console.log('useAuth: Cannot get user from token, making API request...');
            // Если не можем получить пользователя из токена, делаем запрос к серверу
            const user = await authApi.getCurrentUser();
            if (user) {
              localStorage.setItem('user', JSON.stringify(user));
              updateUser(user);
            } else {
              tokenManager.clearTokens();
              localStorage.removeItem('user');
            }
          }
        } else {
          console.log('useAuth: Token is invalid or expired, clearing...');
          // Токен невалиден или истек
          tokenManager.clearTokens();
          localStorage.removeItem('user');
        }
      } catch (error) {
        console.log('User not authenticated, continuing...');
        tokenManager.clearTokens();
        localStorage.removeItem('user');
      } finally {
        setIsAuthLoading(false);
      }
    };

    initializeAuth();
  }, []); // Убираем updateUser из зависимостей

  const login = useCallback(async (credentials) => {
    try {
      setIsAuthLoading(true);
      setError('');
      
      const response = await authApi.login(credentials);
      console.log('Login response in useAuth:', response);
      
      if (response && response.user) {
        localStorage.setItem('user', JSON.stringify(response.user));
        updateUser(response.user);
        return { success: true };
      } else {
        console.error('Invalid response structure:', response);
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      console.error('Login error:', error);
      const errorMessage = error.message || 'Login failed';
      setError(errorMessage);
      return { 
        success: false, 
        error: errorMessage
      };
    } finally {
      setIsAuthLoading(false);
    }
  }, [updateUser]);

  const register = useCallback(async (userData) => {
    try {
      setIsAuthLoading(true);
      setError('');
      
      const response = await authApi.register(userData);
      console.log('Register response in useAuth:', response);
      
      if (response && response.userId) {
        const loginResponse = await authApi.login({
          username: userData.username,
          password: userData.password
        });
        
        if (loginResponse && loginResponse.user) {
          localStorage.setItem('user', JSON.stringify(loginResponse.user));
          updateUser(loginResponse.user);
          return { success: true };
        }
      } else {
        console.error('Invalid response structure:', response);
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      console.error('Registration error:', error);
      const errorMessage = error.message || 'Registration failed';
      setError(errorMessage);
      return { 
        success: false, 
        error: errorMessage
      };
    } finally {
      setIsAuthLoading(false);
    }
  }, [updateUser]);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Очищаем токены и пользователя
      tokenManager.clearTokens();
      clearUser();
    }
  }, [clearUser]);

  const clearError = useCallback(() => {
    setError('');
  }, []);

  return {
    user,
    isLoading: userLoading || isAuthLoading,
    isAuthenticated: !!user,
    error,
    login,
    register,
    logout,
    clearError
  };
};

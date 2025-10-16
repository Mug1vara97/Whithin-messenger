import { useState, useCallback, useEffect } from 'react';
import { authApi } from '../api/authApi';
import { useUser } from './useUser';

export const useAuth = () => {
  const { user, updateUser, clearUser, isLoading: userLoading, setIsLoading } = useUser();
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Проверяем, есть ли активная сессия на сервере
        const user = await authApi.getCurrentUser();
        if (user) {
          localStorage.setItem('user', JSON.stringify(user));
          updateUser(user);
        } else {
          localStorage.removeItem('user');
        }
      } catch (error) {
        // Это нормально, если пользователь не авторизован
        console.log('User not authenticated, continuing...');
        localStorage.removeItem('user');
      } finally {
        setIsAuthLoading(false);
      }
    };

    initializeAuth();
  }, [updateUser]);

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
        // После регистрации нужно войти в систему
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

import { useState, useCallback, useEffect } from 'react';
import { authApi } from '../api/authApi';
import { useUser } from './useUser';
import tokenManager from '../services/tokenManager';
import { isPublicAuthRoute } from '../utils/authRoutes';

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
          const hasMinimalUser =
            !!userFromToken && !!(userFromToken.id || userFromToken.username);
          let restoredUser = false;
          if (hasMinimalUser) {
            console.log('useAuth: User from token:', userFromToken);
            updateUser(userFromToken);
            restoredUser = true;
          } else {
            try {
              const raw = localStorage.getItem('user');
              if (raw) {
                const cached = JSON.parse(raw);
                if (cached && (cached.id || cached.username)) {
                  console.log(
                    'useAuth: User from cached localStorage:',
                    cached.id || cached.username
                  );
                  updateUser(cached);
                  restoredUser = true;
                }
              }
            } catch (_) {
              /* noop */
            }
          }
          if (!restoredUser && !isPublicAuthRoute()) {
            console.log('useAuth: Cannot get user from token or cache, making API request...');
            try {
              const user = await authApi.getCurrentUser();
              if (user) {
                localStorage.setItem('user', JSON.stringify(user));
                updateUser(user);
              }
            } catch (apiError) {
              // Не очищаем сессию из-за временных проблем сети/бэкенда.
              console.warn(
                'useAuth: failed to fetch current user, keeping token session',
                apiError
              );
            }
          }
        } else {
          console.log('useAuth: Token is invalid or expired, clearing...');
          // Токен невалиден или истек
          tokenManager.clearTokens();
          localStorage.removeItem('user');
          clearUser();
        }
      } catch (error) {
        console.warn('useAuth: auth initialization failed, keeping current session state', error);
      } finally {
        setIsAuthLoading(false);
      }
    };

    initializeAuth();
  }, [clearUser, updateUser]);

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
        error: errorMessage,
        requiresEmailConfirmation: !!error.requiresEmailConfirmation,
        email: error.email || null,
      };
    } finally {
      setIsAuthLoading(false);
    }
  }, [updateUser]);

  const consumeQrLoginSession = useCallback(async (sessionId) => {
    try {
      const response = await authApi.getQrLoginSessionStatus(sessionId);

      if (!response || response.status !== 'approved') {
        return {
          success: false,
          status: response?.status || 'pending'
        };
      }

      if (!response.user) {
        throw new Error('Invalid QR login response from server');
      }

      localStorage.setItem('user', JSON.stringify(response.user));
      updateUser(response.user);

      return {
        success: true,
        status: 'approved'
      };
    } catch (error) {
      const errorMessage = error.message || 'QR login failed';
      setError(errorMessage);
      return {
        success: false,
        status: 'error',
        error: errorMessage
      };
    }
  }, [updateUser]);

  const register = useCallback(async (userData) => {
    try {
      setIsAuthLoading(true);
      setError('');
      
      const response = await authApi.register(userData);
      console.log('Register response in useAuth:', response);
      
      if (response && response.userId) {
        return {
          success: true,
          requiresEmailConfirmation: !!(
            response.requiresEmailConfirmation ?? response.RequiresEmailConfirmation
          ),
          email: response.email ?? response.Email ?? userData.email,
        };
      }

      console.error('Invalid response structure:', response);
      throw new Error('Invalid response from server');
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
    updateUser,
    isLoading: userLoading || isAuthLoading,
    isAuthenticated: !!user,
    error,
    login,
    consumeQrLoginSession,
    register,
    logout,
    clearError
  };
};

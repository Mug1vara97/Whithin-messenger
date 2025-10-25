import { useEffect, useCallback } from 'react';
import tokenManager from '../services/tokenManager';
import { authApi } from '../api/authApi';

/**
 * Хук для автоматического обновления JWT токенов
 */
export const useTokenRefresh = () => {
  const checkAndRefreshToken = useCallback(async () => {
    // Проверяем, истекает ли токен в ближайшее время
    if (tokenManager.isTokenExpiringSoon() && !tokenManager.isTokenExpired()) {
      try {
        console.log('Token is expiring soon, attempting to refresh...');
        
        // Здесь можно добавить логику обновления токена
        // Пока что просто логируем
        console.log('Token refresh not implemented yet');
        
      } catch (error) {
        console.error('Failed to refresh token:', error);
        // Если не удалось обновить токен, очищаем все
        tokenManager.clearTokens();
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
  }, []);

  useEffect(() => {
    // Проверяем токен при монтировании компонента
    checkAndRefreshToken();

    // Устанавливаем интервал для периодической проверки токена
    const interval = setInterval(checkAndRefreshToken, 5 * 60 * 1000); // Каждые 5 минут

    return () => {
      clearInterval(interval);
    };
  }, []); // Убираем checkAndRefreshToken из зависимостей

  return {
    checkAndRefreshToken
  };
};

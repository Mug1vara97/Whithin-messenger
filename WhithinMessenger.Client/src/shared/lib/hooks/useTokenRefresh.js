import { useEffect, useCallback } from 'react';
import tokenManager from '../services/tokenManager';

/**
 * Хук для автоматического обновления JWT токенов
 */
export const useTokenRefresh = () => {
  const checkAndRefreshToken = useCallback(async () => {
    // Проверяем, истекает ли токен в ближайшее время
    if (tokenManager.isTokenExpiringSoon() && !tokenManager.isTokenExpired()) {
      try {
        // Пока backend не выдает refresh endpoint, просто переустанавливаем
        // срок из JWT exp, если он появился/обновился.
        const decoded = tokenManager.decodeToken();
        if (decoded?.exp) {
          const jwtExpiry = Number(decoded.exp) * 1000;
          if (!Number.isNaN(jwtExpiry)) {
            localStorage.setItem('accessTokenExpiry', jwtExpiry.toString());
          }
        }
      } catch (error) {
        console.error('Failed to refresh token:', error);
        // Временная ошибка не должна ронять пользовательскую сессию.
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

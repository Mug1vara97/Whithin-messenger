import { useState, useEffect, useCallback } from 'react';
import { serverApi } from '../api';

export const useServer = (serverId) => {
  const [server, setServer] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [accessDenied, setAccessDenied] = useState(false);

  const fetchServer = useCallback(async () => {
    if (!serverId) {
      console.log('useServer: Нет serverId:', serverId);
      return;
    }

    try {
      console.log('useServer: Запрашиваем данные сервера:', serverId);
      setIsLoading(true);
      setError(null);
      setAccessDenied(false);
      const serverData = await serverApi.getServerById(serverId);
      
      console.log('useServer: Raw server data from API:', serverData);
      
      const formattedServer = {
        serverId: serverData.serverId,
        name: serverData.name,
        ownerId: serverData.ownerId,
        avatar: serverData.avatar,
        banner: serverData.banner,
        bannerColor: serverData.bannerColor,
        categories: serverData.categories,
        userRoles: serverData.userRoles
      };
      
      console.log('useServer: Formatted server data:', formattedServer);
      setServer(formattedServer);
    } catch (err) {
      console.error('Error fetching server:', err);
      setError(err.message);
      setServer(null);
      
      if (err.message.includes('403') || err.message.includes('Forbidden') || err.message.includes('Unauthorized')) {
        setAccessDenied(true);
        console.warn('SECURITY WARNING: Access denied to server:', serverId);
      }
    } finally {
      setIsLoading(false);
    }
  }, [serverId]);

  useEffect(() => {
    if (serverId) {
      fetchServer();
    }
  }, [fetchServer, serverId]);

  return {
    server,
    isLoading,
    error,
    accessDenied,
    fetchServer
  };
};

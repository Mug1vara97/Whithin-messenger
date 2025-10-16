import { BASE_URL } from '../../../shared/lib/constants/apiEndpoints';

export const serverApi = {
  // Получение данных сервера через HTTP API
  getServerById: async (serverId) => {
    const response = await fetch(`${BASE_URL}/api/server/${serverId}`, {
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch server');
    }
    
    return response.json();
  },

  // Получение списка серверов пользователя через HTTP API
  getUserServers: async (userId) => {
    const response = await fetch(`${BASE_URL}/api/server/servers`, {
      credentials: 'include' // Для передачи сессионных куки
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch user servers');
    }
    
    const data = await response.json();
    // Сортируем по позиции, как в оригинальном клиенте
    return data.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  },

  // Создание сервера через HTTP API
  createServer: async (serverData, userId) => {
    const response = await fetch(`${BASE_URL}/api/messages/servers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        serverName: serverData.serverName,
        ownerId: userId,
        isPublic: serverData.isPublic || false,
        description: serverData.description || ''
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create server');
    }

    return response.json();
  },

  // Обновление сервера через HTTP API
  updateServer: async (serverId, serverData) => {
    const response = await fetch(`${BASE_URL}/api/messages/servers/${serverId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(serverData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to update server');
    }

    return response.json();
  },

  // Удаление сервера через HTTP API
  deleteServer: async (serverId) => {
    const response = await fetch(`${BASE_URL}/api/messages/servers/${serverId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to delete server');
    }

    return response.json();
  },

  // Присоединение к серверу через HTTP API
  joinServer: async (serverId, userId) => {
    const response = await fetch(`${BASE_URL}/api/messages/servers/${serverId}/add-member`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userIdToAdd: parseInt(userId),
        requestingUserId: parseInt(userId)
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || errorData.message || 'Failed to join server');
    }

    return response.json();
  },

  // Покидание сервера через HTTP API
  leaveServer: async (serverId, userId) => {
    const response = await fetch(`${BASE_URL}/api/messages/servers/${serverId}/remove-member`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        userIdToRemove: parseInt(userId)
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to leave server');
    }

    return response.json();
  }
};
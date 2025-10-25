import { BASE_URL } from '../../../shared/lib/constants/apiEndpoints';
import tokenManager from '../../../shared/lib/services/tokenManager';

// Вспомогательная функция для создания заголовков с JWT токеном
const createHeaders = () => {
  const headers = {
    'Content-Type': 'application/json',
  };
  
  const token = tokenManager.getToken();
  if (token && tokenManager.isTokenValid()) {
    headers.Authorization = `Bearer ${token}`;
  }
  
  return headers;
};

export const serverApi = {
  getServerById: async (serverId) => {
    const url = `${BASE_URL}/api/server/${serverId}`;
    const headers = createHeaders();
    
    console.log('serverApi.getServerById: Making request to:', url);
    console.log('serverApi.getServerById: Headers:', headers);
    
    const response = await fetch(url, {
      headers,
      credentials: 'include'
    });
    
    console.log('serverApi.getServerById: Response status:', response.status);
    console.log('serverApi.getServerById: Response ok:', response.ok);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('serverApi.getServerById: Error response:', errorText);
      throw new Error(`Failed to fetch server: ${response.status} ${response.statusText}`);
    }
    
    return response.json();
  },

  getUserServers: async (userId) => {
    const response = await fetch(`${BASE_URL}/api/server/servers`, {
      headers: createHeaders(),
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch user servers');
    }
    
    const data = await response.json();
    return data.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  },

  createServer: async (serverData, userId) => {
    const response = await fetch(`${BASE_URL}/api/messages/servers`, {
      method: 'POST',
      headers: createHeaders(),
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

  updateServer: async (serverId, serverData) => {
    const response = await fetch(`${BASE_URL}/api/messages/servers/${serverId}`, {
      method: 'PUT',
      headers: createHeaders(),
      body: JSON.stringify(serverData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to update server');
    }

    return response.json();
  },

  deleteServer: async (serverId) => {
    const response = await fetch(`${BASE_URL}/api/messages/servers/${serverId}`, {
      method: 'DELETE',
      headers: createHeaders(),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to delete server');
    }

    return response.json();
  },

  joinServer: async (serverId, userId) => {
    const response = await fetch(`${BASE_URL}/api/messages/servers/${serverId}/add-member`, {
      method: 'POST',
      headers: createHeaders(),
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

  leaveServer: async (serverId, userId) => {
    const response = await fetch(`${BASE_URL}/api/messages/servers/${serverId}/remove-member`, {
      method: 'POST',
      headers: createHeaders(),
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
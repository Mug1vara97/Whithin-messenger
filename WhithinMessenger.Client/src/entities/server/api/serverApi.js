import { BASE_URL } from '../../../shared/lib/constants/apiEndpoints';

export const serverApi = {
  getServerById: async (serverId) => {
    const response = await fetch(`${BASE_URL}/api/server/${serverId}`, {
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch server');
    }
    
    return response.json();
  },

  getUserServers: async (userId) => {
    const response = await fetch(`${BASE_URL}/api/server/servers`, {
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
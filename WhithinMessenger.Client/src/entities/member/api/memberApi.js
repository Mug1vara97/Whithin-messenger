import { BASE_URL } from '../../../shared/lib/constants/apiEndpoints';

export const memberApi = {
  getServerMembers: (connection, serverId) => {
    console.log('memberApi.getServerMembers called with:', { connection: !!connection, serverId });
    return connection.invoke("GetServerMembers", serverId);
  },

  kickMember: (connection, serverId, memberId) => {
    return connection.invoke("KickMember", serverId, memberId);
  },

  openPrivateChat: async (currentUserId, targetUserId) => {
    const response = await fetch(`${BASE_URL}/api/server/openChat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        currentUserId: currentUserId,
        targetUserId: targetUserId
      })
    });

    if (!response.ok) {
      throw new Error('Ошибка открытия чата');
    }

    return response.json();
  }
};

import { BASE_URL } from '../../../shared/lib/constants/apiEndpoints';

export const memberApi = {
  // Получение участников сервера через SignalR
  getServerMembers: (connection, serverId) => {
    console.log('memberApi.getServerMembers called with:', { connection: !!connection, serverId });
    // Преобразуем строку в GUID для SignalR
    return connection.invoke("GetServerMembers", serverId);
  },

  // Исключение участника
  kickMember: (connection, serverId, memberId, currentUserId) => {
    return connection.invoke("KickMember", serverId, memberId, currentUserId);
  },

  // Открытие личного чата
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

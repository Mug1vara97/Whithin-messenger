import apiClient from '../../../shared/lib/api/apiClient';

export const memberApi = {
  getServerMembers: (connection, serverId) => {
    console.log('memberApi.getServerMembers called with:', { connection: !!connection, serverId });
    return connection.invoke("GetServerMembers", serverId);
  },

  kickMember: (connection, serverId, memberId) => {
    return connection.invoke("KickMember", serverId, memberId);
  },

  /** Личный чат: ChatController POST /api/chat/create-private (текущий пользователь из JWT). */
  openPrivateChat: async (_currentUserId, targetUserId) => {
    try {
      const { data } = await apiClient.post('/chat/create-private', {
        targetUserId
      });
      const chatId = data?.chatId ?? data?.ChatId;
      if (!chatId) {
        const msg = data?.error || data?.Error || 'Не удалось открыть чат';
        throw new Error(typeof msg === 'string' ? msg : 'Не удалось открыть чат');
      }
      return {
        chatId,
        exists: data?.exists ?? data?.Exists
      };
    } catch (err) {
      const fromApi = err.response?.data?.error || err.response?.data?.Error;
      const message =
        typeof fromApi === 'string' ? fromApi : err.message || 'Не удалось открыть чат';
      throw new Error(message);
    }
  }
};

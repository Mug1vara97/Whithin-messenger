import apiClient from '../../../shared/lib/api/apiClient';

export const chatApi = {
  /** GET /api/chat/user-chats — userId берётся из JWT. */
  async getUserChats() {
    const response = await apiClient.get('/chat/user-chats');
    return response.data;
  },

  /** POST /api/chat/create-private — текущий пользователь из JWT. */
  async createPrivateChat(_userId, targetUserId) {
    const response = await apiClient.post('/chat/create-private', {
      targetUserId,
    });
    return response.data;
  },

  async createGroupChat(chatName, userIds, connection) {
    if (!connection) {
      throw new Error('SignalR connection is not available');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout: Group chat creation took too long'));
      }, 10000);

      const handleGroupChatCreated = (data) => {
        clearTimeout(timeout);
        connection.off('groupchatcreated', handleGroupChatCreated);
        connection.off('error', handleError);
        resolve(data);
      };

      const handleError = (error) => {
        clearTimeout(timeout);
        connection.off('groupchatcreated', handleGroupChatCreated);
        connection.off('error', handleError);
        reject(new Error(error));
      };

      connection.on('groupchatcreated', handleGroupChatCreated);
      connection.on('error', handleError);

      connection.invoke('CreateGroupChat', chatName, userIds);
    });
  },

  /** GET /api/user/search — userId берётся из JWT. */
  async searchUsers(query, _userId) {
    const response = await apiClient.get(`/user/search?name=${encodeURIComponent(query)}`);
    return response.data;
  },

  /** Удаление чата — через SignalR (GroupChatHub), REST-эндпоинта нет. */
  async deleteChat(_chatId, _userId) {
    throw new Error('Удаление чата выполняется через SignalR, не через REST API');
  },
};

import apiClient from '../../../shared/lib/api/apiClient';

export const chatApi = {
  async getUserChats(userId) {
    const response = await apiClient.get(`/messages/chats?userId=${userId}`);
    return response.data;
  },

  async createPrivateChat(userId, targetUserId) {
    const response = await apiClient.post('/messages/chats/private', {
      userId,
      targetUserId
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

  async searchUsers(query, userId) {
    const response = await apiClient.get(`/messages/users/search?query=${query}&userId=${userId}`);
    return response.data;
  },

  async deleteChat(chatId, userId) {
    const response = await apiClient.delete(`/messages/chats/${chatId}?userId=${userId}`);
    return response.data;
  }
};

























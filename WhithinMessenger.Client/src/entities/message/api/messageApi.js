import apiClient from '../../../shared/lib/api/apiClient';

export const messageApi = {
  async getMessages(chatId) {
    const response = await apiClient.get(`/messages/${chatId}`);
    return response.data;
  },

  async sendMessage(chatId, messageData) {
    const response = await apiClient.post(`/messages/${chatId}`, messageData);
    return response.data;
  },

  async editMessage(messageId, content) {
    const response = await apiClient.put(`/messages/${messageId}`, { content });
    return response.data;
  },

  async deleteMessage(messageId) {
    const response = await apiClient.delete(`/messages/${messageId}`);
    return response.data;
  },

  async searchMessages(chatId, query) {
    const response = await apiClient.get(`/messages/${chatId}/search?query=${query}`);
    return response.data;
  },

  async forwardMessage(messageId, targetChatId, additionalText = '') {
    const response = await apiClient.post(`/messages/${messageId}/forward`, {
      targetChatId,
      additionalText
    });
    return response.data;
  }
};

























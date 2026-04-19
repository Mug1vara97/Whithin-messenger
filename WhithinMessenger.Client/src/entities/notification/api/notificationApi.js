import apiClient from '../../../shared/lib/api/apiClient';

export const notificationApi = {
  async getNotifications({ page = 1, pageSize = 30, unreadOnly = false } = {}) {
    const response = await apiClient.get('/notification', {
      params: { page, pageSize, unreadOnly },
    });
    return response.data || [];
  },

  async getUnreadCount() {
    const response = await apiClient.get('/notification/unread-count');
    return response.data?.unreadCount ?? 0;
  },

  async markAsRead(notificationId) {
    await apiClient.put(`/notification/${notificationId}/read`);
  },

  async markChatAsRead(chatId) {
    await apiClient.put(`/notification/chat/${chatId}/read`);
  },

  async deleteNotification(notificationId) {
    await apiClient.delete(`/notification/${notificationId}`);
  },
};

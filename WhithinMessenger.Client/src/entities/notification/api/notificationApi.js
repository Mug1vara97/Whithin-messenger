import apiClient from '../../../shared/lib/api/apiClient';

export const notificationApi = {
  /**
   * Get notifications for current user
   * @param {number} page - Page number (default: 1)
   * @param {number} pageSize - Page size (default: 20)
   * @param {boolean} unreadOnly - Get only unread notifications (default: true)
   * @returns {Promise<Array>} Array of notifications
   */
  async getNotifications(page = 1, pageSize = 20, unreadOnly = true) {
    const response = await apiClient.get('/notification', {
      params: { page, pageSize, unreadOnly }
    });
    return response.data;
  },

  /**
   * Get unread notifications count for current user
   * @returns {Promise<number>} Unread count
   */
  async getUnreadCount() {
    const response = await apiClient.get('/notification/unread-count');
    return response.data.unreadCount;
  },

  /**
   * Mark notification as read
   * @param {string} notificationId - Notification ID (Guid)
   * @returns {Promise<Object>} Response data
   */
  async markAsRead(notificationId) {
    const response = await apiClient.put(`/notification/${notificationId}/read`);
    return response.data;
  },

  /**
   * Mark all notifications in a chat as read
   * @param {string} chatId - Chat ID (Guid)
   * @returns {Promise<Object>} Response data
   */
  async markChatAsRead(chatId) {
    const response = await apiClient.put(`/notification/chat/${chatId}/read`);
    return response.data;
  },

  /**
   * Delete notification
   * @param {string} notificationId - Notification ID (Guid)
   * @returns {Promise<Object>} Response data
   */
  async deleteNotification(notificationId) {
    const response = await apiClient.delete(`/notification/${notificationId}`);
    return response.data;
  }
};



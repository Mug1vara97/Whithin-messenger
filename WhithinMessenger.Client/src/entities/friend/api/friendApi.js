import apiClient from '../../../shared/lib/api/apiClient';

export const friendApi = {
  // Получить список друзей
  async getFriends() {
    const response = await apiClient.get('/friends');
    return response.data;
  },

  // Получить запросы в друзья
  async getFriendRequests() {
    const response = await apiClient.get('/friends/requests');
    return response.data;
  },

  // Отправить запрос в друзья
  async sendFriendRequest(targetUserId) {
    const response = await apiClient.post('/friends/send-request', {
      targetUserId
    });
    return response.data;
  },

  // Принять запрос в друзья
  async acceptFriendRequest(friendshipId) {
    const response = await apiClient.post('/friends/accept-request', {
      friendshipId
    });
    return response.data;
  },

  // Отклонить запрос в друзья
  async declineFriendRequest(friendshipId) {
    const response = await apiClient.post('/friends/decline-request', {
      friendshipId
    });
    return response.data;
  },

  // Удалить из друзей
  async removeFriend(friendId) {
    const response = await apiClient.delete(`/friends/${friendId}`);
    return response.data;
  }
};









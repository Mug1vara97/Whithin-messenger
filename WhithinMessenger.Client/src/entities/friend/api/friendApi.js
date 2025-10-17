import apiClient from '../../../shared/lib/api/apiClient';

export const friendApi = {
  async getFriends() {
    const response = await apiClient.get('/friends');
    return response.data;
  },

  async getFriendRequests() {
    const response = await apiClient.get('/friends/requests');
    return response.data;
  },

  async sendFriendRequest(targetUserId) {
    const response = await apiClient.post('/friends/send-request', {
      targetUserId
    });
    return response.data;
  },

  async acceptFriendRequest(friendshipId) {
    const response = await apiClient.post('/friends/accept-request', {
      friendshipId
    });
    return response.data;
  },

  async declineFriendRequest(friendshipId) {
    const response = await apiClient.post('/friends/decline-request', {
      friendshipId
    });
    return response.data;
  },

  async removeFriend(friendId) {
    const response = await apiClient.delete(`/friends/${friendId}`);
    return response.data;
  }
};









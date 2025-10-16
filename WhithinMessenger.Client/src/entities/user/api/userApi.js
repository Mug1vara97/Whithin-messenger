import apiClient from '../../../shared/lib/api/apiClient';

export const userApi = {
  async getProfile(userId) {
    const response = await apiClient.get(`/user/profile/${userId}`);
    return response.data;
  },

  async updateProfile(userId, userData) {
    const response = await apiClient.put(`/user/profile/${userId}`, userData);
    return response.data;
  },

  async updateStatus(userId, status) {
    const response = await apiClient.put(`/user/status/${userId}`, { status });
    return response.data;
  },

  async uploadAvatar(userId, file) {
    const formData = new FormData();
    formData.append('avatar', file);
    
    const response = await apiClient.post(`/user/avatar/${userId}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  async deleteAvatar(userId) {
    const response = await apiClient.delete(`/user/avatar/${userId}`);
    return response.data;
  },

  async searchUsers(query) {
    const response = await apiClient.get(`/user/search?name=${encodeURIComponent(query)}`);
    return response.data;
  }
};

























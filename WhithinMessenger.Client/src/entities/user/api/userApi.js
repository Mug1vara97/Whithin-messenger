import apiClient from '../../../shared/lib/api/apiClient';

const extractError = (error, fallback) =>
  error.response?.data?.error || error.response?.data?.Error || fallback;

export const userApi = {
  async getProfile(userId) {
    const response = await apiClient.get(`/profile/${userId}/profile`);
    return response.data;
  },

  async updateProfileAvatar(userId, avatar) {
    const response = await apiClient.post('/profile/update-avatar', {
      UserId: userId,
      Avatar: avatar,
    });
    return response.data;
  },

  async updateProfileBanner(userId, banner) {
    const response = await apiClient.post('/profile/update-banner', {
      UserId: userId,
      Banner: banner,
    });
    return response.data;
  },

  async updateDescription(userId, description) {
    try {
      const response = await apiClient.post('/profile/update-description', {
        UserId: userId,
        Description: description,
      });
      return response.data;
    } catch (error) {
      throw new Error(extractError(error, 'Не удалось обновить описание'));
    }
  },

  async updateDisplayName(userId, displayName) {
    try {
      const response = await apiClient.post('/profile/update-display-name', {
        UserId: userId,
        DisplayName: displayName,
      });
      return response.data;
    } catch (error) {
      throw new Error(extractError(error, 'Не удалось обновить ник'));
    }
  },

  async updateAvatarColor(userId, avatarColor) {
    try {
      const response = await apiClient.post('/profile/update-avatar-color', {
        UserId: userId,
        AvatarColor: avatarColor,
      });
      return response.data;
    } catch (error) {
      throw new Error(extractError(error, 'Не удалось обновить цвет'));
    }
  },

  async removeProfileAvatar(userId) {
    try {
      const response = await apiClient.post('/profile/remove-avatar', { UserId: userId });
      return response.data;
    } catch (error) {
      throw new Error(extractError(error, 'Не удалось удалить аватар'));
    }
  },

  async removeProfileBanner(userId) {
    try {
      const response = await apiClient.post('/profile/remove-banner', { UserId: userId });
      return response.data;
    } catch (error) {
      throw new Error(extractError(error, 'Не удалось удалить баннер'));
    }
  },

  async updateProfileNameplate(userId, nameplate) {
    try {
      const response = await apiClient.post('/profile/update-nameplate', {
        UserId: userId,
        Nameplate: nameplate,
      });
      return response.data;
    } catch (error) {
      throw new Error(extractError(error, 'Не удалось обновить табличку'));
    }
  },

  async removeProfileNameplate(userId) {
    try {
      const response = await apiClient.post('/profile/remove-nameplate', { UserId: userId });
      return response.data;
    } catch (error) {
      throw new Error(extractError(error, 'Не удалось удалить табличку'));
    }
  },

  async uploadProfileAvatar(file) {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await apiClient.post('/profile/upload/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    } catch (error) {
      throw new Error(extractError(error, 'Не удалось загрузить аватар'));
    }
  },

  async uploadProfileBanner(file) {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await apiClient.post('/profile/upload/banner', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    } catch (error) {
      throw new Error(extractError(error, 'Не удалось загрузить баннер'));
    }
  },

  async uploadProfileNameplate(file) {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await apiClient.post('/profile/upload/nameplate', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    } catch (error) {
      throw new Error(extractError(error, 'Не удалось загрузить табличку'));
    }
  },

  async updateProfileAvatarDecoration(userId, avatarDecoration) {
    try {
      const response = await apiClient.post('/profile/update-avatar-decoration', {
        UserId: userId,
        AvatarDecoration: avatarDecoration,
      });
      return response.data;
    } catch (error) {
      throw new Error(extractError(error, 'Не удалось обновить рамку аватара'));
    }
  },

  async removeProfileAvatarDecoration(userId) {
    try {
      const response = await apiClient.post('/profile/remove-avatar-decoration', { UserId: userId });
      return response.data;
    } catch (error) {
      throw new Error(extractError(error, 'Не удалось удалить рамку аватара'));
    }
  },

  async uploadProfileAvatarDecoration(file) {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await apiClient.post('/profile/upload/avatar-decoration', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    } catch (error) {
      throw new Error(extractError(error, 'Не удалось загрузить рамку аватара'));
    }
  },

  async updateStatus(userId, status) {
    const response = await apiClient.put(`/user/status/${userId}`, { status });
    return response.data;
  },

  async searchUsers(query) {
    const response = await apiClient.get(`/user/search?name=${encodeURIComponent(query)}`);
    return response.data;
  },

  async changePassword({ currentPassword, newPassword }) {
    try {
      const response = await apiClient.post('/user/change-password', {
        currentPassword,
        newPassword,
      });
      return response.data;
    } catch (error) {
      throw new Error(extractError(error, 'Не удалось сменить пароль'));
    }
  },

  async changeEmail({ newEmail, currentPassword }) {
    try {
      const response = await apiClient.post('/user/change-email', {
        newEmail,
        currentPassword,
      });
      return response.data;
    } catch (error) {
      throw new Error(extractError(error, 'Не удалось сменить email'));
    }
  },

  async deleteAccount({ password }) {
    try {
      const response = await apiClient.post('/user/delete-account', { password });
      return response.data;
    } catch (error) {
      throw new Error(extractError(error, 'Не удалось удалить аккаунт'));
    }
  },
};

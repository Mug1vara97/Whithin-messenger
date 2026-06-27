import apiClient from '../api/apiClient';

const isNotFound = (error) => error?.response?.status === 404;

export const e2eApi = {
  async uploadDeviceKey(deviceId, publicKeyBase64) {
    await apiClient.put('/e2e/keys', {
      deviceId,
      publicKeyBase64,
    });
  },

  async getDeviceKey(userId) {
    try {
      const { data } = await apiClient.get(`/e2e/keys/${userId}`);
      return {
        deviceId: data.deviceId ?? data.DeviceId ?? 'default',
        publicKeyBase64: data.publicKeyBase64 ?? data.PublicKeyBase64 ?? '',
        updatedAt: data.updatedAt ?? data.UpdatedAt ?? null,
      };
    } catch (error) {
      if (isNotFound(error)) {
        return null;
      }
      throw error;
    }
  },

  async getChatWrappedKey(chatId, deviceId = 'default') {
    try {
      const { data } = await apiClient.get(`/e2e/chat-keys/${chatId}`, {
        params: { deviceId },
      });
      return {
        wrappedKeyBase64: data.wrappedKeyBase64 ?? data.WrappedKeyBase64 ?? '',
        updatedAt: data.updatedAt ?? data.UpdatedAt ?? null,
      };
    } catch (error) {
      if (isNotFound(error)) {
        return null;
      }
      throw error;
    }
  },

  async getChatKeyRecipients(chatId) {
    try {
      const { data } = await apiClient.get(`/e2e/chat-keys/${chatId}/recipients`);
      const userIds = data.userIds ?? data.UserIds ?? [];
      return { userIds: Array.isArray(userIds) ? userIds : [] };
    } catch (error) {
      if (isNotFound(error)) {
        return { userIds: [] };
      }
      throw error;
    }
  },

  async uploadChatWrappedKeys(chatId, wraps) {
    await apiClient.put(`/e2e/chat-keys/${chatId}`, {
      wraps: (wraps || []).map((wrap) => ({
        userId: wrap.userId,
        wrappedKeyBase64: wrap.wrappedKeyBase64,
        deviceId: wrap.deviceId ?? 'default',
      })),
    });
  },
};

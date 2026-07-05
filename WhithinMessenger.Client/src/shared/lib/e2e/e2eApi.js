import apiClient from '../api/apiClient';

const isNotFound = (error) => error?.response?.status === 404;

const chatWrappedKeyCache = new Map();
const chatWrappedKeyInFlight = new Map();
const chatRecipientsCache = new Map();
const chatRecipientsInFlight = new Map();

const chatWrappedKeyCacheKey = (chatId, deviceId) => `${chatId}:${deviceId ?? 'default'}`;

export const invalidateChatWrappedKeyCache = (chatId) => {
  const prefix = `${chatId}:`;
  for (const key of chatWrappedKeyCache.keys()) {
    if (key.startsWith(prefix)) {
      chatWrappedKeyCache.delete(key);
    }
  }
  chatRecipientsCache.delete(String(chatId));
};

export const e2eApi = {
  async uploadDeviceKey(deviceId, publicKeyBase64) {
    await apiClient.put('/e2e/keys', {
      deviceId,
      publicKeyBase64,
    });
  },

  async getDeviceKey(userId, deviceId = null) {
    try {
      const { data } = await apiClient.get(`/e2e/keys/${userId}`, {
        params: deviceId ? { deviceId } : undefined,
      });
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
    const cacheKey = chatWrappedKeyCacheKey(chatId, deviceId);
    if (chatWrappedKeyCache.has(cacheKey)) {
      return chatWrappedKeyCache.get(cacheKey);
    }

    const inFlight = chatWrappedKeyInFlight.get(cacheKey);
    if (inFlight) {
      return inFlight;
    }

    const request = (async () => {
      try {
        const { data, status } = await apiClient.get(`/e2e/chat-keys/${chatId}`, {
          params: { deviceId },
          // Expected 404 when this device has no wrap yet — avoid axios error noise.
          validateStatus: (responseStatus) => responseStatus === 200 || responseStatus === 404,
        });
        if (status === 404 || data == null) {
          chatWrappedKeyCache.set(cacheKey, null);
          return null;
        }
        const result = {
          wrappedKeyBase64: data.wrappedKeyBase64 ?? data.WrappedKeyBase64 ?? '',
          updatedAt: data.updatedAt ?? data.UpdatedAt ?? null,
        };
        chatWrappedKeyCache.set(cacheKey, result);
        return result;
      } catch (error) {
        if (isNotFound(error)) {
          chatWrappedKeyCache.set(cacheKey, null);
          return null;
        }
        throw error;
      } finally {
        chatWrappedKeyInFlight.delete(cacheKey);
      }
    })();

    chatWrappedKeyInFlight.set(cacheKey, request);
    return request;
  },

  async getChatKeyRecipients(chatId) {
    const cacheKey = String(chatId);
    if (chatRecipientsCache.has(cacheKey)) {
      return chatRecipientsCache.get(cacheKey);
    }

    const inFlight = chatRecipientsInFlight.get(cacheKey);
    if (inFlight) {
      return inFlight;
    }

    const request = (async () => {
      try {
        const { data } = await apiClient.get(`/e2e/chat-keys/${chatId}/recipients`);
        const userIds = data.userIds ?? data.UserIds ?? [];
        const result = { userIds: Array.isArray(userIds) ? userIds : [] };
        chatRecipientsCache.set(cacheKey, result);
        return result;
      } catch (error) {
        if (isNotFound(error)) {
          const result = { userIds: [] };
          chatRecipientsCache.set(cacheKey, result);
          return result;
        }
        throw error;
      } finally {
        chatRecipientsInFlight.delete(cacheKey);
      }
    })();

    chatRecipientsInFlight.set(cacheKey, request);
    return request;
  },

  async uploadChatWrappedKeys(chatId, wraps) {
    await apiClient.put(`/e2e/chat-keys/${chatId}`, {
      wraps: (wraps || []).map((wrap) => ({
        userId: wrap.userId,
        wrappedKeyBase64: wrap.wrappedKeyBase64,
        deviceId: wrap.deviceId ?? 'default',
      })),
    });
    invalidateChatWrappedKeyCache(chatId);
  },
};

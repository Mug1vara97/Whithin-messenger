import apiClient from '../api/apiClient';

const isNotFound = (error) => error?.response?.status === 404;
const isBadRequest = (error) => error?.response?.status === 400;

const chatWrappedKeyCache = new Map();
const chatWrappedKeyInFlight = new Map();
const chatRecipientsCache = new Map();
const chatRecipientsInFlight = new Map();
const deviceKeyCache = new Map();
const deviceKeyInFlight = new Map();
const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const chatWrappedKeyCacheKey = (chatId, deviceId) => `${chatId}:${deviceId ?? 'default'}`;
const deviceKeyCacheKey = (userId, deviceId) => `${userId}:${deviceId ?? 'primary'}`;

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
    const cacheKey = deviceKeyCacheKey(userId, deviceId);
    if (deviceKeyCache.has(cacheKey)) {
      return deviceKeyCache.get(cacheKey);
    }

    const inFlight = deviceKeyInFlight.get(cacheKey);
    if (inFlight) {
      return inFlight;
    }

    const request = (async () => {
      try {
        const { data, status } = await apiClient.get(`/e2e/keys/${userId}`, {
          params: deviceId ? { deviceId } : undefined,
          validateStatus: (responseStatus) => responseStatus === 200 || responseStatus === 404,
        });
        if (status === 404 || data == null) {
          deviceKeyCache.set(cacheKey, null);
          return null;
        }
        const result = {
          deviceId: data.deviceId ?? data.DeviceId ?? 'default',
          publicKeyBase64: data.publicKeyBase64 ?? data.PublicKeyBase64 ?? '',
          updatedAt: data.updatedAt ?? data.UpdatedAt ?? null,
        };
        deviceKeyCache.set(cacheKey, result);
        return result;
      } catch (error) {
        if (isNotFound(error)) {
          deviceKeyCache.set(cacheKey, null);
          return null;
        }
        throw error;
      } finally {
        deviceKeyInFlight.delete(cacheKey);
      }
    })();

    deviceKeyInFlight.set(cacheKey, request);
    return request;
  },

  async getChatWrappedKey(chatId, deviceId = 'default', options = {}) {
    const { forceRefresh = false } = options;
    const cacheKey = chatWrappedKeyCacheKey(chatId, deviceId);
    if (forceRefresh) {
      chatWrappedKeyCache.delete(cacheKey);
      chatWrappedKeyInFlight.delete(cacheKey);
    }
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
        const { data, status } = await apiClient.get(`/e2e/chat-keys/${chatId}/recipients`, {
          // 400 can happen for stale/non-member chats; treat as empty recipients.
          validateStatus: (responseStatus) => responseStatus === 200 || responseStatus === 400 || responseStatus === 404,
        });
        if (status === 400 || status === 404 || data == null) {
          const result = { userIds: [] };
          chatRecipientsCache.set(cacheKey, result);
          return result;
        }
        const userIds = data.userIds ?? data.UserIds ?? [];
        const result = { userIds: Array.isArray(userIds) ? userIds : [] };
        chatRecipientsCache.set(cacheKey, result);
        return result;
      } catch (error) {
        if (isNotFound(error) || isBadRequest(error)) {
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
    const normalizedWraps = (wraps || [])
      .filter((wrap) => (
        wrap
        && typeof wrap.wrappedKeyBase64 === 'string'
        && wrap.wrappedKeyBase64.trim().length > 0
        && typeof wrap.userId === 'string'
        && guidRegex.test(wrap.userId)
      ))
      .map((wrap) => ({
        userId: wrap.userId,
        wrappedKeyBase64: wrap.wrappedKeyBase64,
        deviceId: wrap.deviceId ?? 'default',
      }));

    if (!normalizedWraps.length) {
      return;
    }

    await apiClient.put(`/e2e/chat-keys/${chatId}`, { wraps: normalizedWraps });
    invalidateChatWrappedKeyCache(chatId);
  },

  async requestChatKeyRewrap(chatId, deviceId = 'web') {
    await apiClient.post(`/e2e/chat-keys/${chatId}/rewrap-request`, {
      deviceId,
    });
  },
};

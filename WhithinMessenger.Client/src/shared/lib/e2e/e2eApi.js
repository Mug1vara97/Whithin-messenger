import apiClient from '../api/apiClient';
import { E2E_ENABLED } from './e2eConfig';

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

export const invalidateDeviceKeyCache = (userId, deviceId = null) => {
  if (!userId) return;
  const userPrefix = `${String(userId)}:`;
  for (const key of deviceKeyCache.keys()) {
    if (deviceId != null) {
      if (key === deviceKeyCacheKey(userId, deviceId)) {
        deviceKeyCache.delete(key);
      }
      continue;
    }
    if (key.startsWith(userPrefix)) {
      deviceKeyCache.delete(key);
    }
  }
};

// Пока E2E_ENABLED === false (бэкенд отвечает 503 на /api/e2e/*), ни один метод не ходит в сеть.
export const e2eApi = {
  async uploadDeviceKey(deviceId, publicKeyBase64) {
    if (!E2E_ENABLED) return;
    await apiClient.put('/e2e/keys', {
      deviceId,
      publicKeyBase64,
    });
  },

  async getDeviceKey(userId, deviceId = null, options = {}) {
    if (!E2E_ENABLED) return null;
    const { forceRefresh = false } = options;
    const cacheKey = deviceKeyCacheKey(userId, deviceId);
    if (forceRefresh) {
      deviceKeyCache.delete(cacheKey);
      deviceKeyInFlight.delete(cacheKey);
    }
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
    if (!E2E_ENABLED) return null;
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

  async getChatKeyRecipients(chatId, options = {}) {
    if (!E2E_ENABLED) return { userIds: [] };
    const { forceRefresh = false } = options;
    const cacheKey = String(chatId);
    if (forceRefresh) {
      chatRecipientsCache.delete(cacheKey);
      chatRecipientsInFlight.delete(cacheKey);
    }
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
        if (status === 404 || data == null) {
          const result = { userIds: [] };
          chatRecipientsCache.set(cacheKey, result);
          return result;
        }
        if (status === 400) {
          return { userIds: [] };
        }
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
        if (isBadRequest(error)) {
          return { userIds: [] };
        }
        throw error;
      } finally {
        chatRecipientsInFlight.delete(cacheKey);
      }
    })();

    chatRecipientsInFlight.set(cacheKey, request);
    return request;
  },

  async uploadChatWrappedKeys(chatId, wraps, options = {}) {
    if (!E2E_ENABLED) return;
    const { keyFingerprint = null, forceReset = false } = options;
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

    await apiClient.put(`/e2e/chat-keys/${chatId}`, {
      wraps: normalizedWraps,
      keyFingerprint: typeof keyFingerprint === 'string' && keyFingerprint.trim().length
        ? keyFingerprint.trim().toLowerCase()
        : undefined,
      forceReset: Boolean(forceReset),
    });
    invalidateChatWrappedKeyCache(chatId);
  },

  async requestChatKeyRewrap(chatId, deviceId = 'web') {
    if (!E2E_ENABLED) return;
    await apiClient.post(`/e2e/chat-keys/${chatId}/rewrap-request`, {
      deviceId,
    });
  },

  async uploadKeyBackup(payloadJson) {
    if (!E2E_ENABLED) return;
    await apiClient.put('/e2e/backup', {
      payloadJson,
    });
  },

  async getKeyBackup() {
    if (!E2E_ENABLED) return null;
    const { data, status } = await apiClient.get('/e2e/backup', {
      validateStatus: (responseStatus) => responseStatus === 200 || responseStatus === 404,
    });
    if (status === 404 || data == null) {
      return null;
    }
    return {
      payloadJson: data.payloadJson ?? data.PayloadJson ?? '',
      updatedAt: data.updatedAt ?? data.UpdatedAt ?? null,
    };
  },
};

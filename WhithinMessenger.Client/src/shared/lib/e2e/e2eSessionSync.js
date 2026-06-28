import {
  ensureChatKey,
  ensureE2eIdentity,
  proactiveSyncChatDeviceWraps,
} from './e2eCrypto';
import { needsChatListE2eDecrypt } from './e2eChatListPreview';

const CHAT_KEY_STORAGE_PREFIX = 'whithin:e2e:chat-key:';

export const E2E_CHAT_KEY_SYNCED_EVENT = 'whithin:e2e-chat-key-synced';

const notifyChatKeySynced = (chatId) => {
  if (typeof window === 'undefined' || !chatId) {
    return;
  }

  window.dispatchEvent(new CustomEvent(E2E_CHAT_KEY_SYNCED_EVENT, {
    detail: { chatId: String(chatId) },
  }));
};

export const listLocalChatIds = () => {
  const ids = [];
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith(CHAT_KEY_STORAGE_PREFIX)) {
        continue;
      }
      ids.push(key.slice(CHAT_KEY_STORAGE_PREFIX.length));
    }
  } catch {
    return ids;
  }
  return ids;
};

const resolveChatMembers = (chat, userId, extraUserId = null) => {
  const ids = new Set();
  if (userId) ids.add(String(userId));
  if (extraUserId) ids.add(String(extraUserId));

  if (!chat) {
    return Array.from(ids);
  }

  const peerId = chat.userId ?? chat.UserId;
  if (peerId) ids.add(String(peerId));

  const lastSenderId = chat.lastMessageSenderId ?? chat.LastMessageSenderId;
  if (lastSenderId) ids.add(String(lastSenderId));

  return Array.from(ids);
};

const hasLocalChatKey = (chatId) => {
  try {
    return Boolean(localStorage.getItem(`${CHAT_KEY_STORAGE_PREFIX}${chatId}`));
  } catch {
    return false;
  }
};

/** Re-upload wraps when a participant rotated their device key. */
export const handleChatKeyRewrapNeeded = async (userId, payload, chatItem = null) => {
  const chatId = String(payload?.chatId ?? '');
  if (!userId || !chatId) {
    return false;
  }

  const members = resolveChatMembers(chatItem, userId, payload?.userId);
  const changedUserId = payload?.userId != null ? String(payload.userId) : null;

  try {
    if (hasLocalChatKey(chatId)) {
      await proactiveSyncChatDeviceWraps(userId, chatId, members);
      notifyChatKeySynced(chatId);
      return true;
    }

    if (changedUserId && changedUserId === String(userId)) {
      await ensureChatKey(userId, chatId, members, { forEncrypt: false });
      notifyChatKeySynced(chatId);
      return true;
    }
  } catch (error) {
    console.warn('E2E chat key re-wrap sync failed:', { chatId, error });
  }

  return false;
};

/**
 * On session start: refresh wraps for chats that already have a local key,
 * and bootstrap keys for encrypted chats that still lack one locally.
 */
export const syncSessionE2eKeys = async (userId, chatItems = []) => {
  if (!userId) {
    return;
  }

  await ensureE2eIdentity(userId, { strictUpload: true });

  const chats = Array.isArray(chatItems) ? chatItems : [];
  const chatById = new Map();
  chats.forEach((chat) => {
    const chatId = chat?.chatId ?? chat?.ChatId ?? chat?.chat_id;
    if (chatId) {
      chatById.set(String(chatId), chat);
    }
  });

  const localChatIds = listLocalChatIds();
  await Promise.all(
    localChatIds.map(async (chatId) => {
      const chat = chatById.get(String(chatId));
      const members = resolveChatMembers(chat, userId);
      try {
        await proactiveSyncChatDeviceWraps(userId, chatId, members);
      } catch (error) {
        console.warn('E2E proactive wrap sync failed:', { chatId, error });
      }
    }),
  );

  await Promise.all(
    chats.map(async (chat) => {
      const chatId = String(chat?.chatId ?? chat?.ChatId ?? chat?.chat_id ?? '');
      if (!chatId || localChatIds.includes(chatId)) {
        return;
      }

      const encryptionVersion = Number(
        chat?.lastMessageEncryptionVersion ?? chat?.LastMessageEncryptionVersion ?? 0,
      ) || 0;
      const needsBootstrap = encryptionVersion > 0 || needsChatListE2eDecrypt(chat);
      if (!needsBootstrap) {
        return;
      }

      const members = resolveChatMembers(chat, userId);
      try {
        await ensureChatKey(userId, chatId, members, { forEncrypt: false });
      } catch {
        // Expected when no readable wrap exists yet for this device.
      }
    }),
  );
};

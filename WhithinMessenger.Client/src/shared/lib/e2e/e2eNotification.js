import {
  decryptChatMessage,
  E2E_DECRYPT_FAILED_TEXT,
  E2E_ENCRYPTION_VERSION,
} from './e2eCrypto';

const pick = (notification, ...keys) => {
  for (const key of keys) {
    const value = notification?.[key];
    if (value != null && value !== '') return value;
  }
  return null;
};

export const isE2eEnvelope = (text) => {
  if (!text || typeof text !== 'string') return false;
  const trimmed = text.trim();
  if (!trimmed.startsWith('{')) return false;
  try {
    const parsed = JSON.parse(trimmed);
    return Boolean((parsed.n || parsed.N) && (parsed.c || parsed.C));
  } catch {
    return false;
  }
};

const resolveEncryptionVersion = (notification) => {
  const raw = pick(notification, 'encryptionVersion', 'EncryptionVersion');
  const parsed = Number(raw);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }

  const ciphertext = resolveEncryptedPayload(notification);
  if (ciphertext && isE2eEnvelope(ciphertext)) {
    return E2E_ENCRYPTION_VERSION;
  }

  return 0;
};

export const resolveEncryptedPayload = (notification) => {
  const explicit = pick(notification, 'encryptedPayload', 'EncryptedPayload');
  if (explicit) return explicit;

  const messageContent = pick(notification, 'messageContent', 'MessageContent');
  if (messageContent && isE2eEnvelope(messageContent)) {
    return messageContent;
  }

  return null;
};

const resolveSenderId = (notification) => (
  pick(notification, 'senderId', 'SenderId')
);

const buildMemberUserIds = (userId, senderId) => {
  const ids = new Set();
  if (userId) ids.add(String(userId));
  if (senderId) ids.add(String(senderId));
  return Array.from(ids);
};

const patchContentPreview = (notification, decrypted) => {
  const content = pick(notification, 'content', 'Content');
  if (!content || !decrypted) return content;

  if (content.includes('Зашифрованное сообщение')) {
    return content.replace('Зашифрованное сообщение', decrypted);
  }

  return content;
};

export const needsE2eDecrypt = (notification) => {
  if (!notification || notification._e2eDecrypted || notification.e2eDecrypted) {
    return false;
  }

  const encryptionVersion = resolveEncryptionVersion(notification);
  const ciphertext = resolveEncryptedPayload(notification);
  const chatId = pick(notification, 'chatId', 'ChatId');

  return encryptionVersion > 0 && Boolean(ciphertext) && Boolean(chatId);
};

export const decryptNotificationPreview = async (notification, userId) => {
  if (!notification || !userId) return notification;

  const encryptionVersion = resolveEncryptionVersion(notification);
  const ciphertext = resolveEncryptedPayload(notification);
  const chatId = pick(notification, 'chatId', 'ChatId');
  const senderId = resolveSenderId(notification);

  if (encryptionVersion <= 0 || !ciphertext || !chatId) {
    return notification;
  }

  if (notification._e2eDecrypted || notification.e2eDecrypted) {
    return notification;
  }

  try {
    const decrypted = await decryptChatMessage(
      String(userId),
      String(chatId),
      buildMemberUserIds(userId, senderId),
      ciphertext,
      encryptionVersion,
      senderId,
    );

    if (!decrypted || decrypted === E2E_DECRYPT_FAILED_TEXT) {
      return notification;
    }

    const patchedContent = patchContentPreview(notification, decrypted);

    return {
      ...notification,
      messageContent: decrypted,
      MessageContent: decrypted,
      encryptedPayload: ciphertext,
      EncryptedPayload: ciphertext,
      encryptionVersion,
      EncryptionVersion: encryptionVersion,
      ...(patchedContent ? { content: patchedContent, Content: patchedContent } : {}),
      _e2eDecrypted: true,
    };
  } catch (error) {
    console.warn('E2E notification decrypt failed:', error);
    return notification;
  }
};

export const decryptNotificationsList = async (notifications, userId) => {
  if (!Array.isArray(notifications) || !userId) {
    return notifications;
  }

  return Promise.all(
    notifications.map((item) => decryptNotificationPreview(item, userId)),
  );
};

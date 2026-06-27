import { decryptChatMessage, E2E_DECRYPT_FAILED_TEXT } from './e2eCrypto';

const pick = (notification, ...keys) => {
  for (const key of keys) {
    const value = notification?.[key];
    if (value != null && value !== '') return value;
  }
  return null;
};

const resolveEncryptionVersion = (notification) => {
  const raw = pick(notification, 'encryptionVersion', 'EncryptionVersion');
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
};

const resolveEncryptedPayload = (notification) => (
  pick(notification, 'messageContent', 'MessageContent', 'encryptedPayload', 'EncryptedPayload')
);

const resolveSenderId = (notification) => (
  pick(notification, 'senderId', 'SenderId')
);

const buildMemberUserIds = (userId, senderId) => {
  const ids = new Set();
  if (userId) ids.add(String(userId));
  if (senderId) ids.add(String(senderId));
  return Array.from(ids);
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

    return {
      ...notification,
      messageContent: decrypted,
      MessageContent: decrypted,
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

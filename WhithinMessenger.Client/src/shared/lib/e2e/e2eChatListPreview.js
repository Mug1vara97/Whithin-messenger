import {
  decryptChatMessage,
  E2E_DECRYPT_FAILED_TEXT,
  E2E_ENCRYPTION_VERSION,
} from './e2eCrypto';
import { isE2eEnvelope } from './e2eNotification';

const pick = (chat, ...keys) => {
  for (const key of keys) {
    const value = chat?.[key];
    if (value != null && value !== '') return value;
  }
  return null;
};

const resolveEncryptionVersion = (chat) => {
  const raw = pick(chat, 'lastMessageEncryptionVersion', 'LastMessageEncryptionVersion');
  const parsed = Number(raw);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }

  const payload = resolveEncryptedPayload(chat);
  if (payload && isE2eEnvelope(payload)) {
    return E2E_ENCRYPTION_VERSION;
  }

  return 0;
};

const resolveEncryptedPayload = (chat) => {
  const explicit = pick(chat, 'lastMessageEncryptedPayload', 'LastMessageEncryptedPayload');
  if (explicit) return explicit;

  const lastMessage = pick(chat, 'lastMessage', 'LastMessage');
  if (lastMessage && isE2eEnvelope(lastMessage)) {
    return lastMessage;
  }

  return null;
};

const resolveSenderId = (chat) => {
  const explicit = pick(chat, 'lastMessageSenderId', 'LastMessageSenderId');
  if (explicit) return explicit;

  const isGroupChat = Boolean(chat?.isGroupChat ?? chat?.IsGroupChat);
  if (!isGroupChat) {
    return pick(chat, 'userId', 'UserId');
  }

  return null;
};

const buildMemberUserIds = (userId, senderId) => {
  const ids = new Set();
  if (userId) ids.add(String(userId));
  if (senderId) ids.add(String(senderId));
  return Array.from(ids);
};

export const needsChatListE2eDecrypt = (chat) => {
  if (!chat || chat._e2eLastMessageDecrypted || chat.e2eLastMessageDecrypted) {
    return false;
  }

  const encryptionVersion = resolveEncryptionVersion(chat);
  const ciphertext = resolveEncryptedPayload(chat);
  const chatId = pick(chat, 'chatId', 'ChatId', 'chat_id');

  return encryptionVersion > 0 && Boolean(ciphertext) && Boolean(chatId);
};

export const decryptChatListItem = async (chat, userId) => {
  if (!chat || !userId || !needsChatListE2eDecrypt(chat)) {
    return chat;
  }

  const encryptionVersion = resolveEncryptionVersion(chat);
  const ciphertext = resolveEncryptedPayload(chat);
  const chatId = pick(chat, 'chatId', 'ChatId', 'chat_id');
  const senderId = resolveSenderId(chat);

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
      return chat;
    }

    return {
      ...chat,
      lastMessage: decrypted,
      LastMessage: decrypted,
      lastMessageEncryptedPayload: ciphertext,
      LastMessageEncryptedPayload: ciphertext,
      lastMessageEncryptionVersion: encryptionVersion,
      LastMessageEncryptionVersion: encryptionVersion,
      lastMessageSenderId: senderId,
      LastMessageSenderId: senderId,
      _e2eLastMessageDecrypted: true,
      e2eLastMessageDecrypted: true,
    };
  } catch (error) {
    console.warn('E2E chat list decrypt failed:', error);
    return chat;
  }
};

export const decryptChatListItems = async (chats, userId) => {
  if (!Array.isArray(chats) || !userId) {
    return chats;
  }

  return Promise.all(chats.map((chat) => decryptChatListItem(chat, userId)));
};

export const normalizeChatUpdatedPayload = (payloadOrChatId, lastMessage, lastMessageTime) => {
  if (payloadOrChatId && typeof payloadOrChatId === 'object') {
    return {
      chatId: pick(payloadOrChatId, 'chatId', 'ChatId'),
      lastMessage: pick(payloadOrChatId, 'lastMessage', 'LastMessage') ?? '',
      lastMessageTime: pick(payloadOrChatId, 'lastMessageTime', 'LastMessageTime'),
      lastMessageEncryptionVersion:
        Number(pick(payloadOrChatId, 'encryptionVersion', 'EncryptionVersion') ?? 0) || 0,
      lastMessageEncryptedPayload:
        pick(payloadOrChatId, 'encryptedPayload', 'EncryptedPayload'),
      lastMessageSenderId: pick(payloadOrChatId, 'senderId', 'SenderId'),
    };
  }

  return {
    chatId: payloadOrChatId,
    lastMessage: lastMessage ?? '',
    lastMessageTime,
    lastMessageEncryptionVersion: 0,
    lastMessageEncryptedPayload: null,
    lastMessageSenderId: null,
  };
};

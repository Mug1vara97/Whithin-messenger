import { isE2eEnvelope } from '../../../shared/lib/e2e/e2eNotification';

const pick = (notification, ...keys) => {
  for (const key of keys) {
    const value = notification?.[key];
    if (value != null && value !== '') return value;
  }
  return null;
};

export const normalizeNotification = (notification) => {
  const rawMessageContent = pick(notification, 'messageContent', 'MessageContent');
  const encryptedPayload =
    pick(notification, 'encryptedPayload', 'EncryptedPayload')
    || (rawMessageContent && isE2eEnvelope(rawMessageContent) ? rawMessageContent : null);

  let encryptionVersion = Number(pick(notification, 'encryptionVersion', 'EncryptionVersion') ?? 0) || 0;
  if (!encryptionVersion && encryptedPayload) {
    encryptionVersion = 1;
  }

  const isDecrypted = Boolean(notification?._e2eDecrypted || notification?.e2eDecrypted);
  const messageContent = isDecrypted
    ? rawMessageContent
    : (encryptedPayload ? null : rawMessageContent);

  return {
    id: pick(notification, 'id', 'Id', 'notificationId'),
    chatId: pick(notification, 'chatId', 'ChatId'),
    serverId: pick(notification, 'serverId', 'ServerId'),
    serverName: pick(notification, 'serverName', 'ServerName'),
    chatName: pick(notification, 'chatName', 'ChatName'),
    senderName: pick(notification, 'senderName', 'SenderName'),
    senderAvatarUrl: pick(notification, 'senderAvatarUrl', 'SenderAvatarUrl', 'senderAvatar', 'SenderAvatar'),
    senderAvatarColor: pick(notification, 'senderAvatarColor', 'SenderAvatarColor', 'avatarColor', 'AvatarColor'),
    messageId: pick(notification, 'messageId', 'MessageId'),
    type: pick(notification, 'type', 'Type'),
    content: pick(notification, 'content', 'Content') || '',
    messageContent,
    encryptionVersion,
    senderId: pick(notification, 'senderId', 'SenderId'),
    encryptedPayload,
    isRead: notification?.isRead ?? notification?.IsRead ?? false,
    createdAt: pick(notification, 'createdAt', 'CreatedAt'),
    e2eDecrypted: isDecrypted,
  };
};

const isServerNotification = (item) =>
  Boolean(item.serverId) || item.type === 'server_message' || item.type === 'ServerMessage';

const isGroupNotification = (item) =>
  item.type === 'group_message' || item.type === 'GroupMessage';

const formatChannelLabel = (chatName) => {
  if (!chatName) return null;
  return chatName.startsWith('#') ? chatName : `#${chatName}`;
};

export const getNotificationTypeLabel = (type, serverId) => {
  if (type === 'direct_message' || type === 'DirectMessage') return 'Личное сообщение';
  if (type === 'mention' || type === 'Mention') return 'Упоминание';
  if (serverId || type === 'server_message') return 'Сервер';
  if (type === 'group_message' || type === 'GroupMessage') return 'Группа';
  return 'Уведомление';
};

export const isMentionNotification = (notification) => {
  const type = (normalizeNotification(notification).type || '').toLowerCase();
  return type === 'mention';
};

export const getNotificationLocation = (notification) => {
  const item = normalizeNotification(notification);
  const { serverId, serverName, chatName, type } = item;

  if (serverId || type === 'server_message' || type === 'ServerMessage') {
    const channelLabel = formatChannelLabel(chatName);
    const parts = [serverName, channelLabel].filter(Boolean);
    return parts.length > 0 ? parts.join(' · ') : 'Канал сервера';
  }

  if (isGroupNotification(item) && chatName) {
    return chatName;
  }

  return null;
};

/** Заголовок строки в списке уведомлений */
export const getNotificationRowTitle = (notification) => {
  const item = normalizeNotification(notification);

  if (isServerNotification(item)) {
    return formatChannelLabel(item.chatName) || item.serverName || 'Канал сервера';
  }

  if (isGroupNotification(item)) {
    return item.chatName || item.senderName || 'Групповой чат';
  }

  return item.senderName || item.chatName || getNotificationTypeLabel(item.type, item.serverId);
};

/** Подзаголовок: сервер / отправитель */
export const getNotificationRowSubtitle = (notification) => {
  const item = normalizeNotification(notification);

  if (isServerNotification(item)) {
    return [item.serverName, item.senderName].filter(Boolean).join(' · ') || null;
  }

  if (isGroupNotification(item)) {
    return item.senderName || null;
  }

  return null;
};

export const getNotificationMessageText = (notification) => {
  const item = normalizeNotification(notification);
  const { content, senderName, chatName } = item;

  if (item.e2eDecrypted && item.messageContent) {
    return item.messageContent;
  }

  if (item.messageContent && !isE2eEnvelope(item.messageContent)) {
    return item.messageContent;
  }

  if (!content) return '';

  if (senderName) {
    const directPrefix = `${senderName}: `;
    if (content.startsWith(directPrefix)) {
      return content.slice(directPrefix.length);
    }

    if (chatName) {
      const inChatPrefix = `${senderName} в ${chatName}: `;
      if (content.startsWith(inChatPrefix)) {
        return content.slice(inChatPrefix.length);
      }
    }
  }

  const inChatMatch = content.match(/^(.+?) в (.+?):\s*(.+)$/s);
  if (inChatMatch) {
    return inChatMatch[3];
  }

  const colonMatch = content.match(/^[^:]+:\s*(.+)$/s);
  if (colonMatch) {
    return colonMatch[1];
  }

  return content;
};

export const getNotificationSenderLine = (notification) => {
  const item = normalizeNotification(notification);
  if (!item.senderName) return null;

  const messageText = getNotificationMessageText(notification);
  return messageText !== item.content ? item.senderName : null;
};

export const getNotificationToastTitle = (notification) => {
  const item = normalizeNotification(notification);
  if (item.senderName) return item.senderName;
  if (item.serverId && item.chatName) return `# ${item.chatName}`;
  if (item.chatName) return item.chatName;
  return 'Новое сообщение';
};

export const formatNotificationTime = (createdAt) => {
  if (!createdAt) return '';

  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }

  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

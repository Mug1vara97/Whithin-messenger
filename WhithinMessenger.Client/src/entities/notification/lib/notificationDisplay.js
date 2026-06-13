const pick = (notification, ...keys) => {
  for (const key of keys) {
    const value = notification?.[key];
    if (value != null && value !== '') return value;
  }
  return null;
};

export const normalizeNotification = (notification) => ({
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
  content: pick(notification, 'content', 'Content', 'messageContent', 'MessageContent') || '',
  isRead: notification?.isRead ?? notification?.IsRead ?? false,
  createdAt: pick(notification, 'createdAt', 'CreatedAt'),
});

export const getNotificationTypeLabel = (type, serverId) => {
  if (type === 'direct_message') return 'Личное сообщение';
  if (serverId || type === 'server_message') return 'Сервер';
  if (type === 'group_message') return 'Группа';
  return 'Уведомление';
};

export const getNotificationLocation = (notification) => {
  const item = normalizeNotification(notification);
  const { serverId, serverName, chatName, type } = item;

  if (serverId || type === 'server_message') {
    const channelLabel = chatName
      ? (chatName.startsWith('#') ? chatName : `#${chatName}`)
      : null;
    const parts = [serverName, channelLabel].filter(Boolean);
    return parts.length > 0 ? parts.join(' · ') : 'Канал сервера';
  }

  if (type === 'group_message' && chatName) {
    return chatName;
  }

  return null;
};

export const getNotificationMessageText = (notification) => {
  const item = normalizeNotification(notification);
  const { content, senderName, chatName } = item;
  if (!content) return '';

  const storedPreview = pick(notification, 'messageContent', 'MessageContent');
  if (storedPreview) return storedPreview;

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

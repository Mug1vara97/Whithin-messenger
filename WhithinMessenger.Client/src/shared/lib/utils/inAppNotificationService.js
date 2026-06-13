import {
  getNotificationLocation,
  getNotificationMessageText,
  getNotificationToastTitle,
  normalizeNotification,
} from '../../../entities/notification/lib/notificationDisplay';
import { getInAppNotificationsEnabled } from './inAppNotificationSettings';
import { BASE_URL } from '../constants/apiEndpoints';

function resolveAvatarUrl(url) {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const base = BASE_URL.replace(/\/$/, '');
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${base}${path}`;
}

function isViewingNotificationChat(pathname, notification) {
  const chatId = notification?.chatId;
  if (!chatId) return false;

  const serverId = notification?.serverId;
  if (serverId) {
    return pathname.includes(`/server/${serverId}/channel/${chatId}`);
  }

  return (
    pathname === `/channels/@me/${chatId}`
    || pathname === `/chat/${chatId}`
  );
}

export function shouldShowInAppNotification(notification, { pathname, isAppFocused }) {
  if (!getInAppNotificationsEnabled()) return false;

  const item = normalizeNotification(notification);
  if (!item.id || item.isRead) return false;

  const messageText = getNotificationMessageText(notification);
  if (!messageText) return false;

  if (isAppFocused && isViewingNotificationChat(pathname, item)) {
    return false;
  }

  return true;
}

export function buildInAppNotificationView(notification) {
  const item = normalizeNotification(notification);
  const subtitle = getNotificationLocation(notification);

  return {
    id: item.id,
    chatId: item.chatId,
    serverId: item.serverId,
    title: item.senderName || getNotificationToastTitle(notification),
    subtitle,
    message: getNotificationMessageText(notification),
    senderName: item.senderName,
    senderAvatarUrl: resolveAvatarUrl(item.senderAvatarUrl),
    senderAvatarColor: item.senderAvatarColor,
    raw: item,
  };
}

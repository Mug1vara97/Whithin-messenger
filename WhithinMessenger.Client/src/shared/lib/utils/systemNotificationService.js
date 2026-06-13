import {
  getNotificationMessageText,
  getNotificationToastTitle,
  normalizeNotification,
} from '../../../entities/notification/lib/notificationDisplay';
import { getSystemNotificationsEnabled } from './systemNotificationSettings';

const APP_ICON_URL = '/app-icon.png';

export function isSystemNotificationSupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getSystemNotificationPermission() {
  if (!isSystemNotificationSupported()) return 'denied';
  return Notification.permission;
}

export async function requestSystemNotificationPermission() {
  if (!isSystemNotificationSupported()) return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
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

export function shouldShowSystemNotification(notification, { pathname, isAppFocused }) {
  if (!getSystemNotificationsEnabled()) return false;
  if (!isSystemNotificationSupported()) return false;
  if (Notification.permission !== 'granted') return false;

  const item = normalizeNotification(notification);
  if (!item.id || item.isRead) return false;

  const messageText = getNotificationMessageText(notification);
  if (!messageText) return false;

  if (isAppFocused && isViewingNotificationChat(pathname, item)) {
    return false;
  }

  return true;
}

export function showSystemNotification(notification, context = {}) {
  const pathname = context.pathname ?? window.location.pathname;
  const isAppFocused = context.isAppFocused ?? document.hasFocus();

  if (!shouldShowSystemNotification(notification, { pathname, isAppFocused })) {
    return null;
  }

  const item = normalizeNotification(notification);
  const title = getNotificationToastTitle(notification);
  const body = getNotificationMessageText(notification);

  const nativeNotification = new Notification(title, {
    body,
    icon: APP_ICON_URL,
    tag: `whithin-${item.chatId || item.id}`,
    silent: true,
  });

  nativeNotification.onclick = (event) => {
    event?.preventDefault?.();
    nativeNotification.close();
    window.focus();
    window.electronAPI?.focusWindow?.();
    window.dispatchEvent(
      new CustomEvent('openNotificationTarget', { detail: item }),
    );
  };

  return nativeNotification;
}

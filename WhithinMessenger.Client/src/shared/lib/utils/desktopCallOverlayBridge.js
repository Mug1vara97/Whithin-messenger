import { BASE_URL } from '../constants/apiEndpoints';
import { getDesktopNotificationTheme } from './desktopNotificationBridge';

export function isElectronDesktop() {
  return typeof window !== 'undefined' && Boolean(window.electronAPI?.showCallOverlay);
}

function resolveAvatarUrl(url) {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const base = BASE_URL.replace(/\/$/, '');
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${base}${path}`;
}

export function buildCallOverlayView(call) {
  if (!call?.chatId) return null;

  const callerId = call.callerId ? String(call.callerId) : '';
  const callerName = call.callerName || call.chatName || 'Неизвестный';

  return {
    id: `${call.chatId}:${callerId || callerName}`,
    chatId: String(call.chatId),
    callerId: callerId || null,
    callerName,
    chatName: call.chatName || callerName,
    avatarUrl: resolveAvatarUrl(call.avatarUrl),
    avatarColor: call.avatarColor || '#5865F2',
  };
}

export function shouldShowDesktopOverlayWhenInBackground(visibility) {
  const minimized = Boolean(visibility?.minimized);
  const visible = visibility?.visible !== false;
  const focused = visibility?.focused !== false;

  if (!visible) return true;
  if (minimized) return true;
  if (!focused) return true;
  return false;
}

export function shouldShowDesktopCallOverlay(call, visibility) {
  if (!call) return false;
  if (isElectronDesktop()) return true;
  return shouldShowDesktopOverlayWhenInBackground(visibility);
}

export function syncDesktopCallOverlayTheme() {
  if (!isElectronDesktop() || !window.electronAPI.syncCallOverlayTheme) return;
  window.electronAPI.syncCallOverlayTheme(getDesktopNotificationTheme());
}

export function showDesktopCallOverlay(call) {
  if (!isElectronDesktop()) return;
  const view = buildCallOverlayView(call);
  if (!view) return;
  syncDesktopCallOverlayTheme();
  window.electronAPI.showCallOverlay(view);
}

export function dismissDesktopCallOverlay() {
  if (!isElectronDesktop()) return;
  window.electronAPI.dismissCallOverlay?.();
}

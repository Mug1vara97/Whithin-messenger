import {
  getNotificationPosition,
} from './inAppNotificationSettings';

export function isElectronDesktop() {
  return typeof window !== 'undefined' && Boolean(window.electronAPI?.showDesktopNotification);
}

function pickCssVar(styles, name, fallback = '') {
  const value = styles.getPropertyValue(name).trim();
  return value || fallback;
}

export function getDesktopNotificationTheme() {
  if (typeof document === 'undefined') {
    return { presetId: 'default', vars: {} };
  }

  const root = document.documentElement;
  const styles = getComputedStyle(root);

  return {
    presetId: root.getAttribute('data-theme-preset') || 'default',
    themeMode: root.getAttribute('data-theme-mode') || 'dark',
    vars: {
      bg: pickCssVar(styles, '--in-app-notif-bg', '#2f3136'),
      text: pickCssVar(styles, '--text', '#dcddde'),
      textMuted: pickCssVar(styles, '--text-muted') || pickCssVar(styles, '--text-secondary', '#8e9297'),
      primary: pickCssVar(styles, '--primary', '#5865f2'),
      voiceSpeaking: pickCssVar(styles, '--voice-speaking-color', '#43b581'),
      border: pickCssVar(styles, '--border', '#4f545c'),
      cpCyan: pickCssVar(styles, '--cp-cyan'),
      cpYellow: pickCssVar(styles, '--cp-yellow'),
      cpYellowMuted: pickCssVar(styles, '--cp-yellow-muted'),
      cpRed: pickCssVar(styles, '--cp-red'),
      cpGlowCyan: pickCssVar(styles, '--cp-glow-cyan'),
      cpGlowYellow: pickCssVar(styles, '--cp-glow-yellow'),
      ncTextGlow: pickCssVar(styles, '--nc-text-glow'),
    },
  };
}

export function syncDesktopNotificationTheme() {
  if (!isElectronDesktop() || !window.electronAPI.syncDesktopNotificationTheme) return;
  window.electronAPI.syncDesktopNotificationTheme(getDesktopNotificationTheme());
}

export function syncDesktopNotificationSettings() {
  if (!isElectronDesktop() || !window.electronAPI.syncDesktopNotificationSettings) return;
  window.electronAPI.syncDesktopNotificationSettings({
    position: getNotificationPosition(),
  });
}

export function dismissDesktopNotificationById(notificationId) {
  if (!notificationId || !isElectronDesktop()) return;
  window.electronAPI.dismissDesktopNotification?.(notificationId);
}

export function dismissDesktopNotificationsByChatId(chatId) {
  if (!chatId || !isElectronDesktop()) return;
  window.electronAPI.dismissDesktopNotificationsByChatId?.(chatId);
}

export function getActiveChatIdFromPathname(pathname) {
  if (!pathname) return null;

  const dmMatch = pathname.match(/^\/channels\/@me\/([^/]+)/);
  if (dmMatch) return dmMatch[1];

  const channelMatch = pathname.match(/^\/server\/[^/]+\/channel\/([^/]+)/);
  if (channelMatch) return channelMatch[1];

  const legacyMatch = pathname.match(/^\/chat\/([^/]+)/);
  if (legacyMatch) return legacyMatch[1];

  return null;
}

const path = require('node:path');
const { BrowserWindow, screen, ipcMain } = require('electron');

const TOAST_WIDTH = 360;
const TOAST_CARD_HEIGHT = 92;
const HEADER_HEIGHT = 42;
const MARGIN = 12;
const MAX_VISIBLE = 5;
const AUTO_DISMISS_MS = 3 * 60 * 1000;

let hostWindow = null;
let notificationQueue = [];
let notificationSettings = { position: 'top-right' };
let notificationTheme = null;
let lastAppliedBounds = null;
const recentDesktopNotifications = new Map();
const expireTimers = new Map();
const DESKTOP_NOTIFICATION_DEDUPE_MS = 3000;

const VALID_POSITIONS = new Set(['top-right', 'top-left', 'bottom-right', 'bottom-left']);

function isBottomPosition(position) {
  return position === 'bottom-left' || position === 'bottom-right';
}

function getHostHeight(count) {
  return HEADER_HEIGHT + count * TOAST_CARD_HEIGHT;
}

function getHostBounds(count, measuredHeight) {
  const { workArea } = screen.getPrimaryDisplay();
  const position = VALID_POSITIONS.has(notificationSettings.position)
    ? notificationSettings.position
    : 'top-right';
  const layoutCount = Math.max(1, count);
  const estimatedHeight = getHostHeight(layoutCount);
  const height =
    measuredHeight != null
      ? Math.max(HEADER_HEIGHT + TOAST_CARD_HEIGHT, Math.round(measuredHeight))
      : estimatedHeight;
  const width = TOAST_WIDTH;

  let x;
  let y;

  switch (position) {
    case 'top-left':
      x = workArea.x + MARGIN;
      y = workArea.y + MARGIN;
      break;
    case 'bottom-left':
      x = workArea.x + MARGIN;
      y = workArea.y + workArea.height - height - MARGIN;
      break;
    case 'bottom-right':
      x = workArea.x + workArea.width - width - MARGIN;
      y = workArea.y + workArea.height - height - MARGIN;
      break;
    case 'top-right':
    default:
      x = workArea.x + workArea.width - width - MARGIN;
      y = workArea.y + MARGIN;
      break;
  }

  return {
    x: Math.round(x),
    y: Math.round(y),
    width,
    height,
  };
}

function clearExpiryTimer(id) {
  const timer = expireTimers.get(id);
  if (!timer) return;
  clearTimeout(timer);
  expireTimers.delete(id);
}

function scheduleExpiry(id) {
  if (!id) return;
  clearExpiryTimer(id);
  const timer = setTimeout(() => {
    dismissDesktopNotification(id);
  }, AUTO_DISMISS_MS);
  expireTimers.set(id, timer);
}

function pushDataToHost() {
  if (!hostWindow || hostWindow.isDestroyed()) {
    return;
  }

  hostWindow.webContents.send('electron:notification-host-data', {
    items: notificationQueue,
    theme: notificationTheme,
    position: notificationSettings.position,
  });
}

function closeHostWindow() {
  if (hostWindow && !hostWindow.isDestroyed()) {
    hostWindow.close();
  }
  hostWindow = null;
  lastAppliedBounds = null;
}

function applyHostBounds(count, measuredHeight) {
  if (!hostWindow || hostWindow.isDestroyed()) {
    return;
  }

  const bounds = getHostBounds(count, measuredHeight);
  const current = hostWindow.getBounds();

  if (
    lastAppliedBounds &&
    lastAppliedBounds.x === bounds.x &&
    lastAppliedBounds.y === bounds.y &&
    lastAppliedBounds.width === bounds.width &&
    lastAppliedBounds.height === bounds.height
  ) {
    return;
  }

  const isBottom = isBottomPosition(notificationSettings.position);
  const positionUnchanged =
    current.x === bounds.x &&
    current.y === bounds.y &&
    current.width === bounds.width &&
    current.height === bounds.height;

  if (positionUnchanged) {
    lastAppliedBounds = { ...bounds };
    return;
  }

  if (
    !isBottom &&
    current.x === bounds.x &&
    current.y === bounds.y &&
    (current.width !== bounds.width || current.height !== bounds.height)
  ) {
    hostWindow.setSize(bounds.width, bounds.height);
  } else {
    hostWindow.setBounds(bounds);
  }

  lastAppliedBounds = { ...bounds };

  try {
    require('./activeCallOverlay.cjs').repositionActiveCallOverlayIfActive?.();
  } catch {
    // active call overlay module may not be loaded yet during startup
  }
}

function syncHostWindow() {
  if (!notificationQueue.length) {
    closeHostWindow();
    return;
  }

  const bounds = getHostBounds(notificationQueue.length);

  if (!hostWindow || hostWindow.isDestroyed()) {
    hostWindow = new BrowserWindow({
      ...bounds,
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      closable: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      focusable: false,
      show: false,
      hasShadow: true,
      thickFrame: false,
      webPreferences: {
        preload: path.join(__dirname, 'notification-preload.cjs'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
      },
    });

    hostWindow.setMenuBarVisibility(false);
    hostWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

    hostWindow.on('closed', () => {
      hostWindow = null;
      lastAppliedBounds = null;
    });

    hostWindow.webContents.on('did-finish-load', () => {
      pushDataToHost();
    });

    hostWindow.loadFile(path.join(__dirname, 'notification-host.html'));
    return;
  }

  pushDataToHost();
}

function showDesktopNotification(payload) {
  if (!payload?.id) return;

  const now = Date.now();
  const lastShownAt = recentDesktopNotifications.get(payload.id);
  if (lastShownAt && now - lastShownAt < DESKTOP_NOTIFICATION_DEDUPE_MS) {
    return;
  }
  recentDesktopNotifications.set(payload.id, now);

  notificationQueue = notificationQueue.filter((item) => item.id !== payload.id);
  notificationQueue.unshift(payload);

  const dropped = notificationQueue.slice(MAX_VISIBLE);
  notificationQueue = notificationQueue.slice(0, MAX_VISIBLE);
  dropped.forEach((item) => clearExpiryTimer(item.id));

  scheduleExpiry(payload.id);
  syncHostWindow();
}

function dismissDesktopNotification(id) {
  if (!id) return;
  clearExpiryTimer(id);
  notificationQueue = notificationQueue.filter((item) => item.id !== id);
  syncHostWindow();
}

function dismissDesktopNotificationsByChatId(chatId) {
  if (!chatId) return;

  const chatIdStr = String(chatId);
  notificationQueue
    .filter((item) => String(item.chatId) === chatIdStr)
    .forEach((item) => clearExpiryTimer(item.id));

  notificationQueue = notificationQueue.filter(
    (item) => String(item.chatId) !== chatIdStr,
  );
  syncHostWindow();
}

function dismissAllDesktopNotifications() {
  notificationQueue.forEach((item) => clearExpiryTimer(item.id));
  notificationQueue = [];
  syncHostWindow();
}

function updateDesktopNotificationSettings(settings) {
  if (!settings || typeof settings !== 'object') return;

  if (settings.position && VALID_POSITIONS.has(settings.position)) {
    notificationSettings.position = settings.position;
    if (notificationQueue.length) {
      lastAppliedBounds = null;
      pushDataToHost();
      applyHostBounds(notificationQueue.length);
    }
  }
}

function updateDesktopNotificationTheme(theme) {
  notificationTheme = theme;
  pushDataToHost();
}

function registerDesktopNotificationIpc(getMainWindow, showMainWindow) {
  ipcMain.removeAllListeners('electron:show-desktop-notification');
  ipcMain.removeAllListeners('electron:dismiss-desktop-notification');
  ipcMain.removeAllListeners('electron:dismiss-all-desktop-notifications');
  ipcMain.removeAllListeners('electron:dismiss-desktop-notifications-by-chat');
  ipcMain.removeAllListeners('electron:sync-desktop-notification-settings');
  ipcMain.removeAllListeners('electron:sync-desktop-notification-theme');
  ipcMain.removeAllListeners('electron:notification-host-click');
  ipcMain.removeAllListeners('electron:notification-host-height');

  ipcMain.on('electron:show-desktop-notification', (_event, payload) => {
    showDesktopNotification(payload);
  });

  ipcMain.on('electron:dismiss-desktop-notification', (_event, id) => {
    dismissDesktopNotification(id);
  });

  ipcMain.on('electron:dismiss-all-desktop-notifications', () => {
    dismissAllDesktopNotifications();
  });

  ipcMain.on('electron:dismiss-desktop-notifications-by-chat', (_event, chatId) => {
    dismissDesktopNotificationsByChatId(chatId);
  });

  ipcMain.on('electron:sync-desktop-notification-settings', (_event, settings) => {
    updateDesktopNotificationSettings(settings);
  });

  ipcMain.on('electron:sync-desktop-notification-theme', (_event, theme) => {
    updateDesktopNotificationTheme(theme);
  });

  ipcMain.on('electron:notification-host-click', (_event, payload) => {
    if (!payload?.id) return;

    dismissDesktopNotification(payload.id);

    const main = typeof getMainWindow === 'function' ? getMainWindow() : null;
    if (!main || main.isDestroyed()) return;

    if (typeof showMainWindow === 'function') {
      showMainWindow();
    } else {
      main.show();
      main.focus();
    }

    main.webContents.send('electron:open-notification', payload);
  });

  ipcMain.on('electron:notification-host-height', (_event, height) => {
    if (!hostWindow || hostWindow.isDestroyed() || !notificationQueue.length) return;
    if (!Number.isFinite(height) || height <= 0) return;
    applyHostBounds(notificationQueue.length, height);
    if (!hostWindow.isVisible()) {
      hostWindow.showInactive();
    }
  });
}

function shutdownDesktopNotifications() {
  dismissAllDesktopNotifications();
  closeHostWindow();
}

function getActiveNotificationBounds() {
  if (!hostWindow || hostWindow.isDestroyed() || !notificationQueue.length) {
    return null;
  }
  return hostWindow.getBounds();
}

module.exports = {
  registerDesktopNotificationIpc,
  shutdownDesktopNotifications,
  getActiveNotificationBounds,
};

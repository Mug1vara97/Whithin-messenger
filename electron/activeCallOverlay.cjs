const path = require('node:path');
const { BrowserWindow, screen, ipcMain, powerSaveBlocker } = require('electron');
const { getActiveNotificationBounds } = require('./desktopNotifications.cjs');

const PANEL_WIDTH = 260;
const ROW_HEIGHT = 42;
const ROW_GAP = 12;
const HOST_PADDING = 16;
const MAX_VISIBLE = 8;
const MARGIN = 12;

let hostWindow = null;
let activePayload = null;
let overlayTheme = null;
let overlaySettings = {
  coords: { xPercent: 100, yPercent: 100 },
  notificationPosition: 'bottom-right',
};
let measuredSize = null;
let powerSaveBlockerId = null;
let getMainWindow = null;

function applyMainWindowThrottleForOverlay(overlayActive) {
  const main = typeof getMainWindow === 'function' ? getMainWindow() : null;
  if (!main || main.isDestroyed()) {
    return;
  }
  try {
    // Освобождаем CPU для оверлея и голоса, пока главное окно в фоне.
    main.webContents.setBackgroundThrottling(Boolean(overlayActive));
  } catch (_) {
    /* ignore */
  }
}

const VALID_NOTIFICATION_POSITIONS = new Set(['top-right', 'top-left', 'bottom-right', 'bottom-left']);

function clampPercent(value, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(100, Math.max(0, numeric));
}

function normalizeCoords(coords) {
  if (!coords || typeof coords !== 'object') {
    return { xPercent: 100, yPercent: 100 };
  }

  return {
    xPercent: clampPercent(coords.xPercent, 100),
    yPercent: clampPercent(coords.yPercent, 100),
  };
}

function isBottomPosition(position) {
  return position === 'bottom-left' || position === 'bottom-right';
}

function rectsIntersect(a, b) {
  return !(
    a.x + a.width <= b.x
    || b.x + b.width <= a.x
    || a.y + a.height <= b.y
    || b.y + b.height <= a.y
  );
}

function getParticipantCount(payload) {
  const count = Array.isArray(payload?.participants) ? payload.participants.length : 0;
  return Math.max(1, Math.min(count, MAX_VISIBLE));
}

function getEstimatedHeight(payload) {
  const count = getParticipantCount(payload);
  if (count <= 1) {
    return ROW_HEIGHT + HOST_PADDING;
  }
  return count * ROW_HEIGHT + (count - 1) * ROW_GAP + HOST_PADDING;
}

function getHostBounds(payload, sizeOverride) {
  const { workArea } = screen.getPrimaryDisplay();
  const coords = normalizeCoords(overlaySettings.coords);
  const width = sizeOverride?.width || measuredSize?.width || PANEL_WIDTH;
  const height = sizeOverride?.height || measuredSize?.height || getEstimatedHeight(payload);

  const maxX = Math.max(0, workArea.width - width - MARGIN * 2);
  const maxY = Math.max(0, workArea.height - height - MARGIN * 2);

  let x = workArea.x + MARGIN + maxX * (coords.xPercent / 100);
  let y = workArea.y + MARGIN + maxY * (coords.yPercent / 100);

  const notificationBounds = getActiveNotificationBounds();
  const notificationPosition = overlaySettings.notificationPosition || 'bottom-right';
  const overlayRect = { x, y, width, height };

  if (notificationBounds && rectsIntersect(overlayRect, notificationBounds)) {
    if (isBottomPosition(notificationPosition)) {
      y = notificationBounds.y - height - MARGIN;
      y = Math.max(workArea.y + MARGIN, y);
    } else {
      y = notificationBounds.y + notificationBounds.height + MARGIN;
      const maxYPos = workArea.y + workArea.height - height - MARGIN;
      y = Math.min(maxYPos, y);
    }
  }

  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
  };
}

function applyAlwaysOnTop(win) {
  if (!win || win.isDestroyed()) return;
  win.setAlwaysOnTop(true, 'floating');
}

function startPowerSaveBlocker() {
  if (powerSaveBlockerId !== null) return;
  powerSaveBlockerId = powerSaveBlocker.start('prevent-app-suspension');
}

function stopPowerSaveBlocker() {
  if (powerSaveBlockerId === null) return;
  powerSaveBlocker.stop(powerSaveBlockerId);
  powerSaveBlockerId = null;
}

function pushDataToHost() {
  if (!hostWindow || hostWindow.isDestroyed()) return;

  hostWindow.webContents.send('electron:active-call-overlay-host-data', {
    payload: activePayload,
    theme: overlayTheme,
    coords: overlaySettings.coords,
  });
}

function closeHostWindow() {
  if (hostWindow && !hostWindow.isDestroyed()) {
    hostWindow.hide();
    hostWindow.close();
  }
  hostWindow = null;
  measuredSize = null;
  stopPowerSaveBlocker();
  if (!activePayload) {
    applyMainWindowThrottleForOverlay(false);
  }
}

function applyHostBounds(payload, sizeOverride) {
  if (!hostWindow || hostWindow.isDestroyed()) {
    return;
  }

  hostWindow.setBounds(getHostBounds(payload, sizeOverride));
}

function syncHostWindow() {
  if (!activePayload?.participants?.length) {
    closeHostWindow();
    return;
  }

  const bounds = getHostBounds(activePayload);

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
      closable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      focusable: false,
      show: false,
      hasShadow: false,
      thickFrame: false,
      webPreferences: {
        preload: path.join(__dirname, 'active-call-overlay-preload.cjs'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
        backgroundThrottling: false,
      },
    });

    hostWindow.webContents.setBackgroundThrottling(false);

    hostWindow.setMenuBarVisibility(false);
    hostWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    applyAlwaysOnTop(hostWindow);

    hostWindow.on('closed', () => {
      hostWindow = null;
      measuredSize = null;
    });

    hostWindow.webContents.on('did-finish-load', () => {
      pushDataToHost();
      if (!hostWindow || hostWindow.isDestroyed()) return;
      applyAlwaysOnTop(hostWindow);
      hostWindow.showInactive();
    });

    hostWindow.loadFile(path.join(__dirname, 'active-call-overlay-host.html'));
    return;
  }

  applyAlwaysOnTop(hostWindow);
  applyHostBounds(activePayload);
  pushDataToHost();
}

function showActiveCallOverlay(payload) {
  if (!payload?.participants?.length) return;
  activePayload = payload;
  measuredSize = null;
  startPowerSaveBlocker();
  applyMainWindowThrottleForOverlay(true);
  syncHostWindow();
}

function updateActiveCallOverlay(payload) {
  if (!payload?.participants?.length) {
    dismissActiveCallOverlay();
    return;
  }

  const prevCount = activePayload?.participants?.length || 0;
  const nextCount = payload.participants.length;
  activePayload = payload;

  if (!hostWindow || hostWindow.isDestroyed()) {
    syncHostWindow();
    return;
  }

  pushDataToHost();

  if (prevCount !== nextCount) {
    measuredSize = null;
    applyHostBounds(activePayload);
  }
}

function dismissActiveCallOverlay() {
  activePayload = null;
  measuredSize = null;
  applyMainWindowThrottleForOverlay(false);
  syncHostWindow();
}

function updateActiveCallOverlaySettings(settings) {
  if (!settings || typeof settings !== 'object') return;

  if (settings.coords) {
    overlaySettings.coords = normalizeCoords(settings.coords);
  }
  if (settings.notificationPosition && VALID_NOTIFICATION_POSITIONS.has(settings.notificationPosition)) {
    overlaySettings.notificationPosition = settings.notificationPosition;
  }

  if (activePayload) {
    syncHostWindow();
  }
}

function updateActiveCallOverlayTheme(theme) {
  overlayTheme = theme;
  pushDataToHost();
}

function repositionActiveCallOverlayIfActive() {
  if (!activePayload || !hostWindow || hostWindow.isDestroyed()) {
    return;
  }

  applyHostBounds(activePayload);
  applyAlwaysOnTop(hostWindow);
}

function registerActiveCallOverlayIpc(mainWindowGetter) {
  getMainWindow = typeof mainWindowGetter === 'function' ? mainWindowGetter : null;
  ipcMain.removeAllListeners('electron:show-active-call-overlay');
  ipcMain.removeAllListeners('electron:update-active-call-overlay');
  ipcMain.removeAllListeners('electron:dismiss-active-call-overlay');
  ipcMain.removeAllListeners('electron:sync-active-call-overlay-settings');
  ipcMain.removeAllListeners('electron:sync-active-call-overlay-theme');
  ipcMain.removeAllListeners('electron:active-call-overlay-host-size');

  ipcMain.on('electron:show-active-call-overlay', (_event, payload) => {
    showActiveCallOverlay(payload);
  });

  ipcMain.on('electron:update-active-call-overlay', (_event, payload) => {
    updateActiveCallOverlay(payload);
  });

  ipcMain.on('electron:dismiss-active-call-overlay', () => {
    dismissActiveCallOverlay();
  });

  ipcMain.on('electron:sync-active-call-overlay-settings', (_event, settings) => {
    updateActiveCallOverlaySettings(settings);
  });

  ipcMain.on('electron:sync-active-call-overlay-theme', (_event, theme) => {
    updateActiveCallOverlayTheme(theme);
  });

  ipcMain.on('electron:active-call-overlay-host-size', (_event, size) => {
    if (!hostWindow || hostWindow.isDestroyed() || !activePayload) return;
    if (!size || !Number.isFinite(size.width) || !Number.isFinite(size.height)) return;

    measuredSize = {
      width: Math.max(180, Math.min(360, Math.round(size.width))),
      height: Math.max(ROW_HEIGHT, Math.round(size.height)),
    };

    applyHostBounds(activePayload, measuredSize);
  });
}

function shutdownActiveCallOverlay() {
  dismissActiveCallOverlay();
}

module.exports = {
  registerActiveCallOverlayIpc,
  shutdownActiveCallOverlay,
  repositionActiveCallOverlayIfActive,
  dismissActiveCallOverlay,
};

const path = require('node:path');
const { BrowserWindow, screen, ipcMain } = require('electron');

const OVERLAY_WIDTH = 320;
const OVERLAY_HEIGHT = 304;
const AUTO_DISMISS_MS = 3 * 60 * 1000;

let hostWindow = null;
let activeCall = null;
let overlayTheme = null;
let expireTimer = null;

function getHostBounds() {
  const { workArea } = screen.getPrimaryDisplay();
  const x = workArea.x + Math.round((workArea.width - OVERLAY_WIDTH) / 2);
  const y = workArea.y + Math.round((workArea.height - OVERLAY_HEIGHT) / 2);

  return {
    x,
    y,
    width: OVERLAY_WIDTH,
    height: OVERLAY_HEIGHT,
  };
}

function applyAlwaysOnTop(win) {
  if (!win || win.isDestroyed()) return;
  win.setAlwaysOnTop(true, 'screen-saver');
}

function clearExpireTimer() {
  if (!expireTimer) return;
  clearTimeout(expireTimer);
  expireTimer = null;
}

function scheduleExpire() {
  clearExpireTimer();
  expireTimer = setTimeout(() => {
    dismissCallOverlay();
  }, AUTO_DISMISS_MS);
}

function pushDataToHost() {
  if (!hostWindow || hostWindow.isDestroyed()) return;

  hostWindow.webContents.send('electron:call-overlay-host-data', {
    call: activeCall,
    theme: overlayTheme,
  });
}

function closeHostWindow() {
  if (hostWindow && !hostWindow.isDestroyed()) {
    hostWindow.close();
  }
  hostWindow = null;
}

function syncHostWindow() {
  if (!activeCall) {
    closeHostWindow();
    return;
  }

  const bounds = getHostBounds();

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
      focusable: true,
      show: false,
      hasShadow: true,
      thickFrame: false,
      webPreferences: {
        preload: path.join(__dirname, 'call-overlay-preload.cjs'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
      },
    });

    hostWindow.setMenuBarVisibility(false);
    hostWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    applyAlwaysOnTop(hostWindow);

    hostWindow.on('closed', () => {
      hostWindow = null;
    });

    hostWindow.webContents.on('did-finish-load', () => {
      pushDataToHost();
      if (!hostWindow || hostWindow.isDestroyed()) return;
      applyAlwaysOnTop(hostWindow);
      hostWindow.showInactive();
    });

    hostWindow.loadFile(path.join(__dirname, 'call-overlay-host.html'));
    return;
  }

  applyAlwaysOnTop(hostWindow);
  hostWindow.setBounds(bounds);
  pushDataToHost();
}

function showCallOverlay(payload) {
  if (!payload?.chatId) return;
  activeCall = payload;
  scheduleExpire();
  syncHostWindow();
}

function dismissCallOverlay() {
  clearExpireTimer();
  activeCall = null;
  syncHostWindow();
}

function updateCallOverlay(payload) {
  if (!payload?.chatId || !activeCall) return;
  if (String(payload.chatId) !== String(activeCall.chatId)) return;
  activeCall = { ...activeCall, ...payload };
  pushDataToHost();
}

function updateCallOverlayTheme(theme) {
  overlayTheme = theme;
  pushDataToHost();
}

function registerCallOverlayIpc(getMainWindow, showMainWindow) {
  ipcMain.removeAllListeners('electron:show-call-overlay');
  ipcMain.removeAllListeners('electron:update-call-overlay');
  ipcMain.removeAllListeners('electron:dismiss-call-overlay');
  ipcMain.removeAllListeners('electron:sync-call-overlay-theme');
  ipcMain.removeAllListeners('electron:call-overlay-accept');
  ipcMain.removeAllListeners('electron:call-overlay-decline');

  ipcMain.on('electron:show-call-overlay', (_event, payload) => {
    showCallOverlay(payload);
  });

  ipcMain.on('electron:update-call-overlay', (_event, payload) => {
    updateCallOverlay(payload);
  });

  ipcMain.on('electron:dismiss-call-overlay', () => {
    dismissCallOverlay();
  });

  ipcMain.on('electron:sync-call-overlay-theme', (_event, theme) => {
    updateCallOverlayTheme(theme);
  });

  ipcMain.on('electron:call-overlay-accept', () => {
    const main = typeof getMainWindow === 'function' ? getMainWindow() : null;
    dismissCallOverlay();
    if (!main || main.isDestroyed()) return;
    if (typeof showMainWindow === 'function') {
      showMainWindow();
    } else {
      main.show();
      main.focus();
    }
    main.webContents.send('electron:call-overlay-action', { action: 'accept' });
  });

  ipcMain.on('electron:call-overlay-decline', () => {
    const main = typeof getMainWindow === 'function' ? getMainWindow() : null;
    dismissCallOverlay();
    if (!main || main.isDestroyed()) return;
    main.webContents.send('electron:call-overlay-action', { action: 'decline' });
  });
}

function shutdownCallOverlay() {
  dismissCallOverlay();
}

module.exports = {
  registerCallOverlayIpc,
  shutdownCallOverlay,
};

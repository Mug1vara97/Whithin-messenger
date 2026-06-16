const { contextBridge, ipcRenderer } = require('electron');

let globalShortcutListener = null;

const TITLE_BAR_OVERLAY_HEIGHT = 32;
const titleBarInsetPx =
  process.platform === 'win32' || process.platform === 'linux' ? TITLE_BAR_OVERLAY_HEIGHT : 0;

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  /** Отступ под стилизованную шапку; перетаскивание — через CSS app-region в клиенте */
  titleBarInsetPx,

  windowMinimize: () => ipcRenderer.send('electron:window-minimize'),
  windowToggleMaximize: () => ipcRenderer.send('electron:window-toggle-maximize'),
  windowClose: () => ipcRenderer.send('electron:window-close'),
  navigationBack: () => ipcRenderer.send('electron:navigation-back'),
  navigationForward: () => ipcRenderer.send('electron:navigation-forward'),
  navigationReload: () => ipcRenderer.send('electron:navigation-reload'),

  syncWindowBackground: (color) => ipcRenderer.send('electron:sync-window-background', color),
  setBadgeCount: (count) => ipcRenderer.send('electron:set-badge-count', count),
  focusWindow: () => ipcRenderer.send('electron:focus-window'),

  showDesktopNotification: (payload) => ipcRenderer.send('electron:show-desktop-notification', payload),
  dismissDesktopNotification: (id) => ipcRenderer.send('electron:dismiss-desktop-notification', id),
  dismissDesktopNotificationsByChatId: (chatId) =>
    ipcRenderer.send('electron:dismiss-desktop-notifications-by-chat', chatId),
  dismissAllDesktopNotifications: () => ipcRenderer.send('electron:dismiss-all-desktop-notifications'),
  syncDesktopNotificationSettings: (settings) =>
    ipcRenderer.send('electron:sync-desktop-notification-settings', settings),
  syncDesktopNotificationTheme: (theme) =>
    ipcRenderer.send('electron:sync-desktop-notification-theme', theme),
  onWindowVisibilityChanged: (callback) => {
    if (typeof callback !== 'function') return undefined;
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('electron:window-visibility-changed', listener);
    return () => ipcRenderer.removeListener('electron:window-visibility-changed', listener);
  },
  showCallOverlay: (payload) => ipcRenderer.send('electron:show-call-overlay', payload),
  updateCallOverlay: (payload) => ipcRenderer.send('electron:update-call-overlay', payload),
  dismissCallOverlay: () => ipcRenderer.send('electron:dismiss-call-overlay'),
  syncCallOverlayTheme: (theme) => ipcRenderer.send('electron:sync-call-overlay-theme', theme),
  onCallOverlayAction: (callback) => {
    if (typeof callback !== 'function') return undefined;
    const listener = (_event, payload) => callback({ detail: payload });
    ipcRenderer.on('electron:call-overlay-action', listener);
    return () => ipcRenderer.removeListener('electron:call-overlay-action', listener);
  },
  showActiveCallOverlay: (payload) => ipcRenderer.send('electron:show-active-call-overlay', payload),
  updateActiveCallOverlay: (payload) => ipcRenderer.send('electron:update-active-call-overlay', payload),
  dismissActiveCallOverlay: () => ipcRenderer.send('electron:dismiss-active-call-overlay'),
  syncActiveCallOverlaySettings: (settings) =>
    ipcRenderer.send('electron:sync-active-call-overlay-settings', settings),
  syncActiveCallOverlayTheme: (theme) =>
    ipcRenderer.send('electron:sync-active-call-overlay-theme', theme),
  onForceActiveCallOverlaySync: (callback) => {
    if (typeof callback !== 'function') return undefined;
    const listener = () => callback();
    ipcRenderer.on('electron:force-active-call-overlay-sync', listener);
    return () => ipcRenderer.removeListener('electron:force-active-call-overlay-sync', listener);
  },
  onOpenNotification: (callback) => {
    if (typeof callback !== 'function') return undefined;
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('electron:open-notification', listener);
    return () => ipcRenderer.removeListener('electron:open-notification', listener);
  },

  openExternal: (url) => ipcRenderer.invoke('electron:open-external', url),
  chooseScreenSource: () => ipcRenderer.invoke('electron:choose-screen-source'),

  updateGlobalShortcuts: (shortcuts) => ipcRenderer.invoke('electron:update-global-shortcuts', shortcuts),

  onGlobalShortcut: (callback) => {
    if (typeof callback !== 'function') {
      return;
    }

    ipcRenderer.send('electron:register-shortcut-listener');

    if (globalShortcutListener) {
      ipcRenderer.removeListener('global-shortcut-triggered', globalShortcutListener);
    }

    globalShortcutListener = (_, action) => {
      callback(action);
    };

    ipcRenderer.on('global-shortcut-triggered', globalShortcutListener);
  },

  removeGlobalShortcutListener: () => {
    ipcRenderer.send('electron:remove-shortcut-listener');
    if (globalShortcutListener) {
      ipcRenderer.removeListener('global-shortcut-triggered', globalShortcutListener);
      globalShortcutListener = null;
    }
  },
});

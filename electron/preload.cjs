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
  }
});

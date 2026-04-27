const { contextBridge, ipcRenderer } = require('electron');

let globalShortcutListener = null;

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,

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

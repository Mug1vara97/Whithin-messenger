const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('screenPickerAPI', {
  onInit: (callback) => {
    if (typeof callback !== 'function') return;
    ipcRenderer.on('electron:screen-picker-init', (_event, payload) => callback(payload));
  },
  submitSelection: (selection) => ipcRenderer.send('electron:screen-picker-submit', selection),
  cancel: () => ipcRenderer.send('electron:screen-picker-cancel'),
  windowMinimize: () => ipcRenderer.send('electron:screen-picker-minimize'),
  windowClose: () => ipcRenderer.send('electron:screen-picker-cancel'),
  refreshSources: () => ipcRenderer.invoke('electron:screen-picker-refresh'),
});

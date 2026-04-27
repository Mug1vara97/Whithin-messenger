const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('screenPickerAPI', {
  onSources: (callback) => {
    if (typeof callback !== 'function') return;
    ipcRenderer.on('electron:screen-picker-sources', (_event, sources) => callback(sources));
  },
  submitSelection: (selection) => ipcRenderer.send('electron:screen-picker-submit', selection),
  cancel: () => ipcRenderer.send('electron:screen-picker-cancel')
});

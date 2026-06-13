const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('activeCallOverlayHostAPI', {
  onData: (callback) => {
    if (typeof callback !== 'function') return;
    ipcRenderer.on('electron:active-call-overlay-host-data', (_event, data) => {
      callback(data);
    });
  },
  reportSize: (size) => ipcRenderer.send('electron:active-call-overlay-host-size', size),
});

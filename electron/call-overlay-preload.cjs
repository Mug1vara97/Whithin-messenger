const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('callOverlayHostAPI', {
  onData: (callback) => {
    if (typeof callback !== 'function') return;
    ipcRenderer.on('electron:call-overlay-host-data', (_event, data) => {
      callback(data);
    });
  },
  accept: () => ipcRenderer.send('electron:call-overlay-accept'),
  decline: () => ipcRenderer.send('electron:call-overlay-decline'),
});

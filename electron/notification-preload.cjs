const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('notificationHostAPI', {
  onData: (callback) => {
    if (typeof callback !== 'function') return;
    ipcRenderer.on('electron:notification-host-data', (_event, data) => {
      callback(data);
    });
  },
  dismiss: (id) => ipcRenderer.send('electron:dismiss-desktop-notification', id),
  dismissAll: () => ipcRenderer.send('electron:dismiss-all-desktop-notifications'),
  open: (payload) => ipcRenderer.send('electron:notification-host-click', payload),
  reportHeight: (height) => ipcRenderer.send('electron:notification-host-height', height),
});

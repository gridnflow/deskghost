const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('deskghost', {
  onGhost: (callback) => ipcRenderer.on('ghost', (_event, data) => callback(data)),
});

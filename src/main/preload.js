const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  getScreenStream: () => ipcRenderer.invoke('get-screen-stream')
});

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    loadURL: (url) => ipcRenderer.send('load-url', url),
    // NEW: Expose a function to send measured bounds from renderer to main
    sendBounds: (bounds) => ipcRenderer.send('set-webview-bounds', bounds),
    goBack: () => ipcRenderer.send('navigate-back'),
    goForward: () => ipcRenderer.send('navigate-forward'),
    reload: () => ipcRenderer.send('navigate-reload'),
});
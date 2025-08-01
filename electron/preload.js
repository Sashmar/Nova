const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    loadURL: (url) => ipcRenderer.send('load-url', url),
    // NEW: Expose a function to send measured bounds from renderer to main
    sendBounds: (bounds) => ipcRenderer.send('set-webview-bounds', bounds),
    goBack: () => ipcRenderer.send('navigate-back'),
    goForward: () => ipcRenderer.send('navigate-forward'),
    reload: () => ipcRenderer.send('navigate-reload'),
    getTabs: () => ipcRenderer.invoke('get-tabs'),
    switchTab: (id) => ipcRenderer.send('switch-tab', id),
    onTabsUpdated: (callback) => ipcRenderer.on('tabs-updated', (event, tabsData) => callback(tabsData)),
    createNewTab: (url) => ipcRenderer.send('create-new-tab', url),
    goHome: () => ipcRenderer.send('go-home'),
    toggleBrowserViewVisibility: (isVisible) => ipcRenderer.send('toggle-browser-view-visibility', isVisible),
    onUpdateAddressBar: (callback) => {
        ipcRenderer.on('update-address-bar', (event, url) => callback(url));
    },
});
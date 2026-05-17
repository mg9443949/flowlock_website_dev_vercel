const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electron', {
  /**
   * Returns a Promise that resolves to the list of installed applications.
   */
  getInstalledApps: () => ipcRenderer.invoke('get-installed-apps')
})

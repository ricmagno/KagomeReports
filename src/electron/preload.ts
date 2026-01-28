import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getAppPath: () => ipcRenderer.invoke('get-app-path'),
  showErrorDialog: (title: string, message: string) =>
    ipcRenderer.invoke('show-error-dialog', title, message),
  showMessageDialog: (options: any) =>
    ipcRenderer.invoke('show-message-dialog', options),
  showOpenDialog: (options: any) =>
    ipcRenderer.invoke('show-open-dialog', options),
  showSaveDialog: (options: any) =>
    ipcRenderer.invoke('show-save-dialog', options)
})

declare global {
  interface Window {
    electronAPI: {
      getAppVersion: () => Promise<string>
      getAppPath: () => Promise<string>
      showErrorDialog: (title: string, message: string) => Promise<void>
      showMessageDialog: (options: any) => Promise<any>
      showOpenDialog: (options: any) => Promise<any>
      showSaveDialog: (options: any) => Promise<any>
    }
  }
}

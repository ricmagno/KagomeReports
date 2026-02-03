import { app, BrowserWindow, Menu, ipcMain, dialog, IpcMainInvokeEvent } from 'electron'
import * as path from 'path'
import isDev from 'electron-is-dev'
import { spawn, ChildProcess } from 'child_process'
import * as fs from 'fs'

let mainWindow: BrowserWindow | null = null
let serverProcess: ChildProcess | null = null

const isDevelopment = isDev || process.env.NODE_ENV === 'development'

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,

      sandbox: true
    },
    icon: path.join(__dirname, '../../assets/icon.png')
  })

  const startUrl = isDevelopment
    ? 'http://localhost:3000'
    : `file://${path.join(__dirname, '../../client/build/index.html')}`

  mainWindow.loadURL(startUrl)

  if (isDevelopment) {
    mainWindow.webContents.openDevTools()
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function startServer() {
  if (serverProcess) return

  const serverPath = path.join(__dirname, '../server.js')

  serverProcess = spawn('node', [serverPath], {
    cwd: app.getAppPath(),
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: isDevelopment ? 'development' : 'production'
    }
  })

  serverProcess.on('error', (err) => {
    console.error('Failed to start server:', err)
    dialog.showErrorBox('Server Error', 'Failed to start the application server')
  })

  serverProcess.on('exit', (code) => {
    console.log(`Server process exited with code ${code}`)
    serverProcess = null
  })
}

app.on('ready', () => {
  startServer()

  // Wait a moment for server to start
  setTimeout(() => {
    createWindow()
    createMenu()
  }, 1000)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
})

app.on('before-quit', () => {
  if (serverProcess) {
    serverProcess.kill()
  }
})

function createMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Exit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.quit()
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About',
          click: () => {
            dialog.showMessageBox(mainWindow!, {
              type: 'info',
              title: 'About Historian Reports',
              message: 'Historian Reports',
              detail: `Version ${app.getVersion()}\n\nProfessional reporting application for AVEVA Historian database`
            })
          }
        }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

// IPC handlers for common operations
ipcMain.handle('get-app-version', () => {
  return app.getVersion()
})

ipcMain.handle('get-app-path', () => {
  return app.getAppPath()
})

ipcMain.handle('show-error-dialog', (_event: IpcMainInvokeEvent, title: string, message: string) => {
  return dialog.showErrorBox(title, message)
})

ipcMain.handle('show-message-dialog', (_event: IpcMainInvokeEvent, options: Electron.MessageBoxOptions) => {
  return dialog.showMessageBox(mainWindow!, options)
})

ipcMain.handle('show-open-dialog', (_event: IpcMainInvokeEvent, options: Electron.OpenDialogOptions) => {
  return dialog.showOpenDialog(mainWindow!, options)
})

ipcMain.handle('show-save-dialog', (_event: IpcMainInvokeEvent, options: Electron.SaveDialogOptions) => {
  return dialog.showSaveDialog(mainWindow!, options)
})

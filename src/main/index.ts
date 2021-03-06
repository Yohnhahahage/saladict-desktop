import { app, BrowserWindow, ipcMain, Tray, nativeImage } from 'electron'
import path from 'path'
import Serve from 'electron-serve'
import initGlobalShareVars from './shareVars'
import initIpcHandler from './ipc'
import initTray from './tray'
import initIOListener from './ioListener'
import { SCHEME } from '../consts'
import { emitter } from './utils'
import { autoUpdater } from 'electron-updater'
import initShortcuts from './shortcut'
import { initGA } from './ga'

initGlobalShareVars()

/**
 * Set `__static` path to static files in production
 * https://simulatedgreg.gitbooks.io/electron-vue/content/en/using-static-assets.html
 */
if (process.env.NODE_ENV !== 'development') {
  global.__static = path.join(__dirname, '/static').replace(/\\/g, '\\\\')
}

if (process.env.NODE_ENV !== 'development' && process.platform === 'darwin') {
  app.dock?.hide()
}

let mainWindow: BrowserWindow | null

let forceQuit = false

Serve({
  scheme: SCHEME,
  directory: app.getAppPath(),
})

const baseURL = `${SCHEME}://-`

async function createWindow(baseURL: string) {
  mainWindow = new BrowserWindow({
    width: global.shareVars.panelWidth || 450,
    resizable: false,
    fullscreenable: false,
    minimizable: false,
    maximizable: false,
    useContentSize: true,
    frame: false,
    show: false,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: true,
      webSecurity: false,
      nodeIntegrationInSubFrames: true,
    },
  })

  mainWindow.setMenu(null)
  mainWindow.setMenuBarVisibility(false)
  mainWindow.setVisibleOnAllWorkspaces(true)

  initIpcHandler(mainWindow, { baseURL })

  await mainWindow.loadURL(`${baseURL}/iframe.html?sub=quick-search.html`)

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.on('close', (event) => {
    if (forceQuit) {
      app.quit()
    } else {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  mainWindow.on('blur', () => {
    if (!global.shareVars.isPinPanel) {
      mainWindow?.hide()
    }
  })

  // mainWindow.on('ready-to-show', () => {
  //   mainWindow?.show()
  // })

  emitter.on('panelWidth', (width) => {
    const { height = 550 } = mainWindow?.getBounds() || {}
    mainWindow?.setSize(width, height, false)
  })

  global.shareVars.mainWindowId = mainWindow.id

  return mainWindow
}

app.on('ready', async () => {
  const mainWindow = await createWindow(baseURL)
  initTray(mainWindow)
  initShortcuts(mainWindow)
  initGA(mainWindow)
  autoUpdater.checkForUpdatesAndNotify()

  setTimeout(() => {
    initIOListener(mainWindow)
  }, 500)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', (e) => {
  forceQuit = true
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow(baseURL)
  }
})

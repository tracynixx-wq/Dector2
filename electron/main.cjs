const { app, BrowserWindow, dialog } = require('electron')
const path = require('node:path')
const { autoUpdater } = require('electron-updater')

let mainWindow
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 820, minWidth: 760, minHeight: 560,
    backgroundColor: '#101114',
    title: 'Dector',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  mainWindow.on('closed', () => { mainWindow = null })
}
app.whenReady().then(() => {
  createWindow()
  if (app.isPackaged) {
    autoUpdater.autoDownload = true
    autoUpdater.checkForUpdatesAndNotify().catch(error => console.error('Update check failed:', error))
    autoUpdater.on('update-downloaded', async () => {
      const result = await dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Обновление Dector готово',
        message: 'Обновление скачано и готово к установке.',
        detail: 'Перезапустить приложение сейчас? Перезагрузка компьютера не требуется.',
        buttons: ['Перезапустить приложение', 'Позже'],
        defaultId: 0,
        cancelId: 1
      })
      if (result.response === 0) autoUpdater.quitAndInstall()
    })
  }
})
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })

const { app, BrowserWindow } = require('electron')
const path = require('node:path')

function createWindow() {
  const win = new BrowserWindow({
    width: 600,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
    autoHideMenuBar: true,
    alwaysOnTop:true
  });

  win.loadURL('http://localhost:3000');
}

app.whenReady().then(createWindow);
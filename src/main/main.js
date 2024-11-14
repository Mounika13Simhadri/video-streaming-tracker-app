const { app, BrowserWindow, ipcMain, screen, desktopCapturer } = require("electron");
const path = require("path");

function createWindow() {
  const preloadPath = path.join(__dirname, 'preload.js');
  console.log("Preload Path:", preloadPath);
  const win = new BrowserWindow({
    width: 600,
    height: 700,
    webPreferences: {
      preload: preloadPath ,
      contextIsolation: true,
      nodeIntegration: false,
      enableRemoteModule: false
    },
    autoHideMenuBar: true,
    alwaysOnTop: true
  });

  win.loadURL("http://localhost:3000");
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});


ipcMain.handle('get-screen-stream', async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen']
    });
    return sources;
  } catch (error) {
    console.error('Error retrieving screen sources:', error);
    return [];
  }
});




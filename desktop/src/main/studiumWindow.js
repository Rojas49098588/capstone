// The Studium window. Closing it only hides it; the app keeps running in the tray until Quit.
const { app, BrowserWindow } = require('electron');

function createStudiumWindow({ url, preload, show }) {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Studium',
    show,
    autoHideMenuBar: true,
    webPreferences: {
      preload,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  win.on('close', (event) => {
    if (app.isQuitting) return;
    event.preventDefault();
    win.hide();
  });
  win.loadURL(url);
  return win;
}

/** Shows and focuses Studium, optionally following a link such as "project=<id>" (Studium handles hashchange). */
async function showStudium(win, hash) {
  if (!win || win.isDestroyed()) return;
  if (hash) {
    await win.webContents.executeJavaScript(`location.hash = ${JSON.stringify('#' + hash)}`).catch(() => {});
  }
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

module.exports = { createStudiumWindow, showStudium };

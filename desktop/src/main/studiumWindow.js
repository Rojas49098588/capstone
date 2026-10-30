// The Studium window. Closing it only hides it; the app keeps running in the tray until Quit.
const { app, BrowserWindow, shell } = require('electron');

/** `isAllowed(url)` says which pages the window may show: Studium only. */
function createStudiumWindow({ url, preload, show, isAllowed }) {
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
  // Dropping a file on the window, or a link, would otherwise replace Studium with that page (with
  // no way back) and give that page the preload's bridge.
  win.webContents.on('will-navigate', (event, target) => {
    if (!isAllowed(target)) event.preventDefault();
  });
  // Links that open a new window go to the default browser instead (web pages only).
  win.webContents.setWindowOpenHandler(({ url: target }) => {
    if (/^https?:\/\//i.test(target)) shell.openExternal(target).catch(() => {});
    return { action: 'deny' };
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

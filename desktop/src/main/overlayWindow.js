// The pet overlay: one transparent, frameless, always-on-top window over the primary display's
// work area (so pets walk on top of the taskbar, not behind it). It never takes keyboard focus, and
// it lets the mouse through except where src/overlay/mouse.js says a pet wants it.
// overlayBounds and overlayOptions are pure; createOverlayWindow wires them to Electron.

function overlayBounds(workArea) {
  return { x: workArea.x, y: workArea.y, width: workArea.width, height: workArea.height };
}

function overlayOptions(workArea) {
  return {
    ...overlayBounds(workArea),
    transparent: true,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    focusable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    show: false,
    title: 'Studium pets',
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false, backgroundThrottling: false },
  };
}

/** Lets clicks through (wants = false) or takes them (wants = true). Moves are always forwarded. */
function setOverlayMouse(win, wants) {
  if (win && !win.isDestroyed()) win.setIgnoreMouseEvents(!wants, { forward: true });
}

// On Windows the overlay window can stop getting mouse presses (moves still arrive), so the pets
// ignore every click until the window is replaced. Seen after waking from sleep; a fresh window in
// the same app works (bugs.md, 2026-11-05). So main.js builds a new overlay after a wake or an
// unlock, and the tray has Reload pets for any other time.
const REBUILD_AFTER_WAKE_MS = 2000;

/** Calls rebuild once, ms after the last request (waking fires both resume and unlock-screen). */
function createRebuildTimer(rebuild, ms) {
  let timer = null;
  const dispose = () => {
    clearTimeout(timer);
    timer = null;
  };
  return {
    request() {
      dispose();
      timer = setTimeout(() => {
        timer = null;
        rebuild();
      }, ms);
    },
    dispose,
  };
}

function createOverlayWindow({ url, screen }) {
  const { BrowserWindow } = require('electron');
  const win = new BrowserWindow(overlayOptions(screen.getPrimaryDisplay().workArea));
  setOverlayMouse(win, false);
  win.once('ready-to-show', () => win.showInactive());

  // Follow the work area when the taskbar moves or the screen changes; pet.js clamps pets on resize.
  const fit = () => {
    if (!win.isDestroyed()) win.setBounds(overlayBounds(screen.getPrimaryDisplay().workArea));
  };
  screen.on('display-metrics-changed', fit);
  screen.on('display-added', fit);
  screen.on('display-removed', fit);
  win.on('closed', () => {
    screen.off('display-metrics-changed', fit);
    screen.off('display-added', fit);
    screen.off('display-removed', fit);
  });

  win.webContents.on('will-navigate', (event) => event.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  // If the page crashes, bring the pets back rather than leaving an empty window.
  win.webContents.on('render-process-gone', () => {
    if (!win.isDestroyed()) win.reload();
  });
  win.loadURL(url);
  return win;
}

module.exports = { REBUILD_AFTER_WAKE_MS, overlayBounds, overlayOptions, setOverlayMouse, createRebuildTimer, createOverlayWindow };

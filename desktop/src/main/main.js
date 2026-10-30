// Studium desktop app: main process. This file only wires the pieces together; the rules live in
// the modules next to it, which have unit tests.
const path = require('node:path');
const { app, ipcMain } = require('electron');
const { parseArgs, resolvePaths, startUrl } = require('./paths');
const { registerStudiumScheme, handleStudiumScheme } = require('./protocol');
const { createStudiumWindow, showStudium } = require('./studiumWindow');
const { createStore } = require('./store');
const { createAwayRunner } = require('./away');
const { CHANNELS, handleStudium } = require('./bridge');
const { createTray } = require('./tray');

const args = parseArgs(process.argv);
if (args.userData) app.setPath('userData', args.userData);

// Hooks for the end-to-end tests (e2e/), which can't click the tray.
globalThis.studiumTest = {};

registerStudiumScheme();

if (!app.requestSingleInstanceLock()) {
  // Already running (for example started with the computer): the first copy shows its window.
  app.quit();
} else {
  let win = null;
  let runner = null;
  let tray = null; // kept here so it isn't garbage-collected (which would remove the icon)
  app.isQuitting = false;
  app.on('before-quit', () => {
    app.isQuitting = true;
    runner?.dispose();
  });
  app.on('second-instance', () => showStudium(win));
  // The app lives in the tray, so closing every window doesn't quit it.
  app.on('window-all-closed', () => {});

  app.whenReady().then(() => {
    const paths = resolvePaths({ packaged: app.isPackaged, resourcesPath: process.resourcesPath, desktopDir: path.join(__dirname, '..', '..') });
    handleStudiumScheme(paths.webDist);
    // The pets' rules, shared with the extension. A plain script that sets globalThis.PetLogic.
    require(paths.logicJs);
    const L = globalThis.PetLogic;
    const store = createStore({ file: path.join(app.getPath('userData'), 'pet-state.json') });
    runner = createAwayRunner({ store, L, open: (hash) => showStudium(win, hash) });

    const sendSessions = (sessions) => {
      if (win && !win.isDestroyed()) win.webContents.send('studium:focus-sessions', sessions);
    };
    const deps = { store, runner, L, sendSessions };
    for (const channel of CHANNELS) {
      ipcMain.on(channel, (event, payload) => {
        // Only Studium's own window may talk to the main process.
        if (win && event.sender === win.webContents) handleStudium(channel, payload, deps);
      });
    }
    // A nap that ends while Studium is open reaches it at once; otherwise Studium asks on studium:ready.
    store.onChange((keys, state) => {
      if (keys.includes('focusOutbox') && win && !win.isDestroyed() && !win.webContents.isLoading()) {
        sendSessions(Object.values(L.parseOutbox(state.focusOutbox)));
      }
    });

    win = createStudiumWindow({ url: startUrl(args.dev), preload: path.join(__dirname, '..', 'preload', 'studium.js'), show: !args.hidden });
    tray = createTray({
      L,
      store,
      runner,
      iconPath: paths.trayIcon,
      open: () => showStudium(win),
      quit: () => {
        app.isQuitting = true;
        app.quit();
      },
    });
    // End naps that finished while the app was closed, and re-arm the others.
    runner.request({ type: 'endOverdue' });
    Object.assign(globalThis.studiumTest, { store, runner });
  });
}

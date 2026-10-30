// Studium desktop app: main process. This file only wires the pieces together; the rules live in
// the modules next to it, which have unit tests.
const path = require('node:path');
const { app } = require('electron');
const { parseArgs, resolvePaths, startUrl } = require('./paths');
const { registerStudiumScheme, handleStudiumScheme } = require('./protocol');
const { createStudiumWindow, showStudium } = require('./studiumWindow');

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
  app.isQuitting = false;
  app.on('before-quit', () => {
    app.isQuitting = true;
  });
  app.on('second-instance', () => showStudium(win));
  // The app lives in the tray, so closing every window doesn't quit it.
  app.on('window-all-closed', () => {});

  app.whenReady().then(() => {
    const paths = resolvePaths({ packaged: app.isPackaged, resourcesPath: process.resourcesPath, desktopDir: path.join(__dirname, '..', '..') });
    handleStudiumScheme(paths.webDist);
    win = createStudiumWindow({ url: startUrl(args.dev), show: !args.hidden });
  });
}

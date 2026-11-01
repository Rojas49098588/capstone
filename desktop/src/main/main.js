// Studium desktop app: main process. This file only wires the pieces together; the rules live in
// the modules next to it, which have unit tests.
const fs = require('node:fs');
const path = require('node:path');
const { app, ipcMain, screen, session } = require('electron');
const { parseArgs, resolvePaths, startUrl, isStudiumPage } = require('./paths');
const { registerStudiumScheme, handleStudiumScheme } = require('./protocol');
const { createStudiumWindow, showStudium } = require('./studiumWindow');
const { createStore } = require('./store');
const { createAwayRunner } = require('./away');
const { CHANNELS, handleStudium } = require('./bridge');
const { createTray } = require('./tray');
const { loginItemSettings } = require('./loginItem');
const { quitTask } = require('./taskbar');
const { createOverlayWindow, setOverlayMouse } = require('./overlayWindow');
const { createHabitatTracker } = require('./habitat');
const { readPetState, cleanPetWrite, changesFor, changeTargets, handlePetMessage } = require('./petChannel');
const { habitatFiles, habitatScript } = require('./petScripts');

const OVERLAY_URL = 'studium://overlay/index.html';

const args = parseArgs(process.argv);
if (args.userData) app.setPath('userData', args.userData);

// Hooks for the end-to-end tests (e2e/), which can't click the tray.
globalThis.studiumTest = {};

registerStudiumScheme();

const quitApp = () => {
  app.isQuitting = true;
  app.quit();
};

if (!app.requestSingleInstanceLock() || args.quit) {
  // Already running (for example started with the computer): the first copy shows its window, or
  // quits if this copy came from the taskbar menu's Quit Studium. --quit with nothing running just exits.
  app.quit();
} else {
  let win = null;
  let overlay = null;
  let runner = null;
  let tray = null; // kept here so it isn't garbage-collected (which would remove the icon)
  app.isQuitting = false;
  app.on('before-quit', () => {
    app.isQuitting = true;
    runner?.dispose();
  });
  app.on('second-instance', (_event, argv) => {
    if (parseArgs(argv).quit) quitApp();
    else showStudium(win);
  });
  // The app lives in the tray, so closing every window doesn't quit it.
  app.on('window-all-closed', () => {});

  app.whenReady().then(() => {
    const paths = resolvePaths({ packaged: app.isPackaged, resourcesPath: process.resourcesPath, desktopDir: path.join(__dirname, '..', '..') });
    handleStudiumScheme({ app: paths.webDist, pets: paths.petsRoot, overlay: paths.overlayDir });
    // The pets' rules, shared with the extension. A plain script that sets globalThis.PetLogic.
    require(paths.logicJs);
    const L = globalThis.PetLogic;
    const store = createStore({ file: path.join(app.getPath('userData'), 'pet-state.json') });
    runner = createAwayRunner({ store, L, open: (hash) => showStudium(win, hash) });

    const sendSessions = (sessions) => {
      if (win && !win.isDestroyed()) win.webContents.send('studium:focus-sessions', sessions);
    };
    // Only an installed build registers itself: in development it would register electron.exe, and
    // a test run (--user-data) must not change the computer's real start-up list.
    const applyLoginItem = (on, quiet) => {
      if (app.isPackaged && !args.userData) app.setLoginItemSettings(loginItemSettings(on, process.execPath, quiet));
    };
    const deps = { store, runner, L, sendSessions, applyLoginItem };
    for (const channel of CHANNELS) {
      ipcMain.on(channel, (event, payload) => {
        // Only Studium itself, in its own window, may talk to the main process.
        if (win && event.sender === win.webContents && isStudiumPage(event.senderFrame?.url, args.dev)) handleStudium(channel, payload, deps);
      });
    }
    // A nap that ends while Studium is open reaches it at once; otherwise Studium asks on studium:ready.
    store.onChange((keys, state) => {
      if (keys.includes('focusOutbox') && win && !win.isDestroyed() && !win.webContents.isLoading()) {
        sendSessions(Object.values(L.parseOutbox(state.focusOutbox)));
      }
    });

    // ---- The pets' windows (the overlay, and the habitat pet in the Studium window) ----
    // window.petBridge in every window; what each may do is decided below, by sender.
    session.defaultSession.registerPreloadScript({ type: 'frame', id: 'studium-pet-bridge', filePath: path.join(__dirname, '..', 'preload', 'petBridge.js') });
    const broadcast = (changes) => {
      for (const w of changeTargets([overlay, win])) w.webContents.send('pets:changed', changes);
    };
    const habitat = createHabitatTracker((id) => broadcast({ petHabitat: { newValue: id } }));
    store.onChange((keys, state) => {
      const changes = changesFor(keys, state);
      if (Object.keys(changes).length > 0) broadcast(changes);
    });
    const from = (event) => {
      const url = event.senderFrame?.url;
      if (overlay && event.sender === overlay.webContents && typeof url === 'string' && url.startsWith('studium://overlay/')) return 'overlay';
      if (win && event.sender === win.webContents && isStudiumPage(url, args.dev)) return 'studium';
      return null;
    };
    let overlayMouse = false;
    ipcMain.handle('pets:get', (event, keys) => (from(event) ? readPetState(store.get(), keys, habitat.get()) : {}));
    ipcMain.on('pets:set', (event, patch) => {
      if (from(event) === 'overlay') store.set(cleanPetWrite(patch, L));
    });
    ipcMain.on('pets:message', (event, msg) => {
      const sender = from(event);
      if (sender) handlePetMessage(msg, sender, { L, runner, open: (hash) => showStudium(win, hash), reportHabitat: habitat.report });
    });
    // Where the cursor is, in the overlay's own pixels (null off it), for a pet chasing the mouse.
    ipcMain.handle('overlay:cursor', (event) => {
      if (from(event) !== 'overlay' || !overlay || overlay.isDestroyed()) return null;
      return L.cursorInOverlay(screen.getCursorScreenPoint(), overlay.getBounds());
    });
    ipcMain.on('overlay:mouse', (event, wants) => {
      if (from(event) !== 'overlay') return;
      overlayMouse = wants === true;
      setOverlayMouse(overlay, overlayMouse);
    });

    win = createStudiumWindow({
      url: startUrl(args.dev),
      preload: path.join(__dirname, '..', 'preload', 'studium.js'),
      show: !args.hidden,
      isAllowed: (url) => isStudiumPage(url, args.dev),
    });
    // Habitats: the pet code runs in the Studium window too, drawing only a project page's pet.
    // Its box counts only while the window shows (src/main/habitat.js).
    win.webContents.on('did-finish-load', () => {
      if (!isStudiumPage(win.webContents.getURL(), args.dev)) return;
      habitat.reset();
      const sources = habitatFiles(paths).map((file) => fs.readFileSync(file, 'utf8'));
      win.webContents.executeJavaScript(habitatScript(sources)).catch((e) => console.error('Could not start the habitat pets', e));
    });
    win.webContents.on('did-start-navigation', (details) => {
      if (details.isMainFrame && !details.isSameDocument) habitat.reset();
    });
    win.webContents.on('render-process-gone', () => habitat.reset());
    const windowState = () => {
      if (!win.isDestroyed()) habitat.setWindow({ visible: win.isVisible(), minimized: win.isMinimized() });
    };
    for (const event of ['show', 'hide', 'minimize', 'restore']) win.on(event, windowState);
    windowState();

    overlay = createOverlayWindow({ url: OVERLAY_URL, screen });
    Object.assign(globalThis.studiumTest, { win, overlay, habitat, overlayMouse: () => overlayMouse });
    tray = createTray({
      L,
      store,
      runner,
      iconPath: paths.trayIcon,
      open: () => showStudium(win),
      quit: quitApp,
    });
    // Quit Studium in the taskbar button's right-click menu. Only for an installed build: in
    // development it would point at electron.exe.
    if (app.isPackaged && process.platform === 'win32') app.setUserTasks([quitTask(process.execPath)]);
    // End naps that finished while the app was closed, and re-arm the others.
    runner.request({ type: 'endOverdue' });
    Object.assign(globalThis.studiumTest, { store, runner });
  });
}

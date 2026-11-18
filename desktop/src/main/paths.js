// Where things are, and how the app was launched. Pure: no Electron here.
const path = require('node:path');

const STUDIUM_URL = 'studium://app/';
// Where Studium is hosted: the page that signs in with Google in the person's own browser (desktop-sign-in.html).
const HOSTED_URL = 'https://studium-9a00e.web.app/';
// web/vite.config.ts keeps the dev server on this port.
const DEV_URL = 'http://localhost:5173/';

/**
 * Files the main process needs. In a packaged build they are copied into the app's resources
 * folder (see electron-builder.yml); in development they are read from the repo.
 */
function resolvePaths({ packaged, resourcesPath, desktopDir }) {
  // petsRoot: the pet code and art shared with the extension (content/*.js, assets/pets/).
  // overlayDir: the pet overlay page (desktop/src/overlay).
  if (packaged) {
    const webDist = path.resolve(resourcesPath, 'web');
    const petsRoot = path.resolve(resourcesPath, 'extension');
    return {
      webDist,
      petsRoot,
      overlayDir: path.resolve(resourcesPath, 'overlay'),
      logicJs: path.join(petsRoot, 'content', 'logic.js'),
      trayIcon: path.join(webDist, 'pets', 'egg.png'),
    };
  }
  const repo = path.resolve(desktopDir, '..');
  const petsRoot = path.join(repo, 'extension');
  return {
    webDist: path.join(repo, 'web', 'dist'),
    petsRoot,
    overlayDir: path.join(path.resolve(desktopDir), 'src', 'overlay'),
    logicJs: path.join(petsRoot, 'content', 'logic.js'),
    trayIcon: path.join(repo, 'web', 'public', 'pets', 'egg.png'),
  };
}

/**
 * --dev: load the Vite dev server. --hidden: start in the tray without showing the window.
 * --quit: quit a running Studium (the taskbar menu's Quit Studium). --user-data=<dir>: for tests.
 * --demo: the demo copy for the stand (Settings → Reset demo, no account). Only together with
 * --user-data, so a Reset can never replace the real save.
 */
function parseArgs(argv) {
  const userDataArg = argv.find((a) => a.startsWith('--user-data='));
  const userData = userDataArg ? userDataArg.slice('--user-data='.length) : '';
  return {
    dev: argv.includes('--dev'),
    hidden: argv.includes('--hidden'),
    quit: argv.includes('--quit'),
    userData: userData || null,
    demo: argv.includes('--demo') && userData !== '',
  };
}

/**
 * Whether --demo may use this folder: it must be a folder of its own, not Studium's real data folder
 * (realUserData, read before --user-data is applied) nor one inside or around it. Otherwise a mistyped
 * shortcut (say, missing quotes around "Studium Demo") would let Reset demo replace the real save.
 */
function demoFolderOk(userData, realUserData) {
  if (!userData) return false;
  const norm = (p) => {
    const r = path.resolve(p).replace(/[\\/]+$/, '');
    return process.platform === 'win32' || process.platform === 'darwin' ? r.toLowerCase() : r;
  };
  const a = norm(userData);
  const b = norm(realUserData);
  const inside = (x, y) => x === y || x.startsWith(y + path.sep);
  return !inside(a, b) && !inside(b, a);
}

function startUrl(dev) {
  return dev ? DEV_URL : STUDIUM_URL;
}

/** Whether a URL is Studium itself (the only page the Studium window may show or take messages from). */
function isStudiumPage(url, dev) {
  return typeof url === 'string' && url.startsWith(startUrl(dev));
}

module.exports = { HOSTED_URL, STUDIUM_URL, DEV_URL, resolvePaths, parseArgs, startUrl, isStudiumPage, demoFolderOk };

// Where things are, and how the app was launched. Pure: no Electron here.
const path = require('node:path');

const STUDIUM_URL = 'studium://app/';
// web/vite.config.ts keeps the dev server on this port.
const DEV_URL = 'http://localhost:5173/';

/**
 * Files the main process needs. In a packaged build they are copied into the app's resources
 * folder (see electron-builder.yml); in development they are read from the repo.
 */
function resolvePaths({ packaged, resourcesPath, desktopDir }) {
  if (packaged) {
    const webDist = path.resolve(resourcesPath, 'web');
    return {
      webDist,
      logicJs: path.resolve(resourcesPath, 'extension', 'logic.js'),
      trayIcon: path.join(webDist, 'pets', 'egg.png'),
    };
  }
  const repo = path.resolve(desktopDir, '..');
  return {
    webDist: path.join(repo, 'web', 'dist'),
    logicJs: path.join(repo, 'extension', 'content', 'logic.js'),
    trayIcon: path.join(repo, 'web', 'public', 'pets', 'egg.png'),
  };
}

/**
 * --dev: load the Vite dev server. --hidden: start in the tray without showing the window.
 * --quit: quit a running Studium (the taskbar menu's Quit Studium). --user-data=<dir>: for tests.
 */
function parseArgs(argv) {
  const userDataArg = argv.find((a) => a.startsWith('--user-data='));
  const userData = userDataArg ? userDataArg.slice('--user-data='.length) : '';
  return {
    dev: argv.includes('--dev'),
    hidden: argv.includes('--hidden'),
    quit: argv.includes('--quit'),
    userData: userData || null,
  };
}

function startUrl(dev) {
  return dev ? DEV_URL : STUDIUM_URL;
}

/** Whether a URL is Studium itself (the only page the Studium window may show or take messages from). */
function isStudiumPage(url, dev) {
  return typeof url === 'string' && url.startsWith(startUrl(dev));
}

module.exports = { STUDIUM_URL, DEV_URL, resolvePaths, parseArgs, startUrl, isStudiumPage };

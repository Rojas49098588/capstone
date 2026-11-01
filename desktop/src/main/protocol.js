// Studium's built files are served on studium://app/ rather than file://, so the page has a fixed
// origin (its localStorage is kept across runs) and absolute paths like /decor/clock.svg work.
const path = require('node:path');
const { pathToFileURL } = require('node:url');

/**
 * The file in webDist to answer a studium:// request with. Anything outside webDist, malformed, or
 * without a file extension (an app route) gets index.html.
 */
function fileForRequest(url, webDist) {
  const index = path.join(webDist, 'index.html');
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(url).pathname);
  } catch {
    return index;
  }
  // Treat backslashes as separators too, so an encoded "..\" can't climb out on Windows.
  const resolved = path.resolve(webDist, '.' + pathname.replace(/\\/g, '/'));
  const rel = path.relative(webDist, resolved);
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) return index;
  if (!path.extname(resolved)) return index;
  return resolved;
}

/** Must run before the app is ready. */
function registerStudiumScheme() {
  const { protocol } = require('electron');
  protocol.registerSchemesAsPrivileged([
    { scheme: 'studium', privileges: { standard: true, secure: true, supportFetchAPI: true } },
  ]);
}

/** Runs after the app is ready. */
function handleStudiumScheme(webDist) {
  const { protocol, net } = require('electron');
  protocol.handle('studium', (request) => net.fetch(pathToFileURL(fileForRequest(request.url, webDist)).toString()));
}

module.exports = { fileForRequest, registerStudiumScheme, handleStudiumScheme };

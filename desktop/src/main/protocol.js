// Studium's files are served on a private studium:// scheme rather than file://, so pages have a
// fixed origin (Studium's localStorage is kept across runs) and absolute paths like /decor/clock.svg work.
//   studium://app/      the built web app (web/dist)
//   studium://pets/     the pet code and art shared with the extension (extension/)
//   studium://overlay/  the pet overlay page (desktop/src/overlay)
const path = require('node:path');
const { pathToFileURL } = require('node:url');

/** A file inside root for this URL path, or null if it's outside, malformed, or has no extension. */
function fileInside(pathname, root) {
  // Treat backslashes as separators too, so an encoded "..\" can't climb out on Windows.
  const resolved = path.resolve(root, '.' + pathname.replace(/\\/g, '/'));
  const rel = path.relative(root, resolved);
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) return null;
  if (!path.extname(resolved)) return null;
  return resolved;
}

/**
 * The file to answer a studium:// request with, or null (404). roots: { app, pets, overlay }.
 * For app, anything unusable (an app route, a bad path) gets index.html.
 */
function fileForRequest(url, roots) {
  let host;
  let pathname;
  try {
    const parsed = new URL(url);
    host = parsed.host;
    pathname = decodeURIComponent(parsed.pathname);
  } catch {
    return roots.app ? path.join(roots.app, 'index.html') : null;
  }
  if (host === 'app') return fileInside(pathname, roots.app) ?? path.join(roots.app, 'index.html');
  if (host === 'pets' || host === 'overlay') return fileInside(pathname, roots[host]);
  return null;
}

/** Must run before the app is ready. */
function registerStudiumScheme() {
  const { protocol } = require('electron');
  protocol.registerSchemesAsPrivileged([
    { scheme: 'studium', privileges: { standard: true, secure: true, supportFetchAPI: true } },
  ]);
}

/** Runs after the app is ready. roots: { app, pets, overlay }. */
function handleStudiumScheme(roots) {
  const { protocol, net } = require('electron');
  protocol.handle('studium', (request) => {
    const file = fileForRequest(request.url, roots);
    if (!file) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
}

module.exports = { fileForRequest, registerStudiumScheme, handleStudiumScheme };

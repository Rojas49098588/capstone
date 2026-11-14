// Where `npm run dist` puts the installer: outside the repo, because the repo lives in OneDrive and
// OneDrive syncing the ~120 MB build made the installer step time out. STUDIUM_RELEASE_DIR overrides it
// (the GitHub workflow points it at the runner's temp folder).
const os = require('node:os');
const path = require('node:path');

function releaseDir(env = process.env) {
  return env.STUDIUM_RELEASE_DIR || path.join(os.homedir(), 'StudiumBuilds');
}

/** The unpacked app electron-builder leaves next to the installer, for e2e/packaged.spec.js. */
function unpackedExe(dir, platform = process.platform) {
  if (platform === 'darwin') return path.join(dir, 'mac-universal', 'Studium.app', 'Contents', 'MacOS', 'Studium');
  if (platform === 'linux') return path.join(dir, 'linux-unpacked', 'studium');
  return path.join(dir, 'win-unpacked', 'Studium.exe');
}

/** npx arguments for one platform's installer. Never publishes: the workflow uploads the files itself. */
function distArgs(platform, out) {
  const targets = { mac: ['--mac', 'dmg', '--universal'], linux: ['--linux', 'deb'], win: ['--win', 'nsis'] };
  const target = targets[platform];
  return ['electron-builder', ...target, '--publish', 'never', `--config.directories.output=${out}`];
}

module.exports = { releaseDir, unpackedExe, distArgs };

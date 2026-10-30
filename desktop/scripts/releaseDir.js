// Where `npm run dist` puts the installer: outside the repo, because the repo lives in OneDrive and
// OneDrive syncing the ~120 MB build made the installer step time out. STUDIUM_RELEASE_DIR overrides it.
const os = require('node:os');
const path = require('node:path');

function releaseDir(env = process.env) {
  return env.STUDIUM_RELEASE_DIR || path.join(os.homedir(), 'StudiumBuilds');
}

module.exports = { releaseDir };

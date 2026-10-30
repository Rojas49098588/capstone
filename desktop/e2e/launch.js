// Starts the real app for an end-to-end test, with its own data folder.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { _electron } = require('@playwright/test');

const desktopDir = path.join(__dirname, '..');

/** A fresh, empty data folder for one test. */
function tempUserData() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'studium-e2e-'));
}

/** The environment Electron runs in: some shells (VS Code's) set ELECTRON_RUN_AS_NODE, which turns Electron into plain Node. */
function electronEnv() {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  return env;
}

function launch({ userData, args = [] }) {
  return _electron.launch({ args: ['.', `--user-data=${userData}`, ...args], cwd: desktopDir, env: electronEnv() });
}

module.exports = { desktopDir, tempUserData, electronEnv, launch };

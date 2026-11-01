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

/** The first page whose address starts with prefix, once it has opened. */
async function pageAt(app, prefix) {
  for (let i = 0; i < 150; i++) {
    const page = app.windows().find((p) => p.url().startsWith(prefix));
    if (page) return page;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`no window opened ${prefix}`);
}

/** The Studium window's page. (app.firstWindow() may be the pet overlay, which can open first.) */
const studiumPage = (app) => pageAt(app, 'studium://app/');

/** The pet overlay's page (studium://overlay/). */
const overlayPage = (app) => pageAt(app, 'studium://overlay/');

/** An adult, Happy cat's status, as Studium publishes it. */
function testPet(projectId, o = {}) {
  return {
    projectId, shortName: projectId, name: projectId, color: '#2d3a8c', petKind: 'cat', mood: 'Happy',
    recovering: false, idleRequirement: null, suggestion: null, celebration: null, furniture: [], ...o,
  };
}

/**
 * Gives the app these pets. Studium publishes its own statuses when it loads (none, for a new
 * user), so this waits for that first and then replaces them in the main process's store. Studium
 * publishes again on its once-a-minute refresh, so tests using this stay short.
 */
async function seedPets(app, studium, pets) {
  await studium.waitForLoadState('load');
  for (let i = 0; i < 100; i++) {
    if (await app.evaluate(() => globalThis.studiumTest.store?.get().petStatuses !== undefined)) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  await app.evaluate((_electron, list) => {
    globalThis.studiumTest.store.set({ petStatuses: { updatedAt: new Date().toISOString(), pets: list } });
  }, pets);
}

module.exports = { desktopDir, tempUserData, electronEnv, launch, studiumPage, overlayPage, testPet, seedPets };

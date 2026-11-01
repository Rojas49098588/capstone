// Checks the unpacked installer build (<releaseDir>/win-unpacked, see scripts/releaseDir.js) after `npm run dist`:
//   STUDIUM_PACKAGED=1 npx playwright test packaged
// It proves the extraResources paths and the studium:// scheme work outside the repo.
const path = require('node:path');
const { spawn } = require('node:child_process');
const { test, expect, _electron } = require('@playwright/test');
const { tempUserData, electronEnv, studiumPage } = require('./launch');
const { releaseDir } = require('../scripts/releaseDir');

test.skip(process.env.STUDIUM_PACKAGED !== '1', 'set STUDIUM_PACKAGED=1 after npm run dist');

const exe = () => path.join(releaseDir(), 'win-unpacked', 'Studium.exe');

test('the packaged build opens Studium and loads the pet rules', async () => {
  const app = await _electron.launch({
    executablePath: exe(),
    args: [`--user-data=${tempUserData()}`],
    env: electronEnv(),
  });
  const page = await studiumPage(app);
  await expect(page.getByRole('heading', { name: 'What do you make?' })).toBeVisible();
  expect(await app.evaluate(() => typeof globalThis.PetLogic?.applyAwayRequest)).toBe('function');
  expect(await app.evaluate(({ app: a }) => a.isPackaged)).toBe(true);
  await app.close();
});

test("the packaged build's Quit Studium (--quit) ends it", async () => {
  const userData = tempUserData();
  const app = await _electron.launch({ executablePath: exe(), args: [`--user-data=${userData}`], env: electronEnv() });
  await studiumPage(app);
  const exited = new Promise((resolve) => app.process().on('exit', () => resolve('exited')));
  spawn(exe(), [`--user-data=${userData}`, '--quit'], { env: electronEnv() });
  await expect(Promise.race([exited, new Promise((r) => setTimeout(() => r('still running'), 10000))])).resolves.toBe('exited');
});

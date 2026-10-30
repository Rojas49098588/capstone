// Checks the unpacked installer build (<releaseDir>/win-unpacked, see scripts/releaseDir.js) after `npm run dist`:
//   STUDIUM_PACKAGED=1 npx playwright test packaged
// It proves the extraResources paths and the studium:// scheme work outside the repo.
const path = require('node:path');
const { test, expect, _electron } = require('@playwright/test');
const { tempUserData, electronEnv } = require('./launch');
const { releaseDir } = require('../scripts/releaseDir');

test.skip(process.env.STUDIUM_PACKAGED !== '1', 'set STUDIUM_PACKAGED=1 after npm run dist');

test('the packaged build opens Studium and loads the pet rules', async () => {
  const app = await _electron.launch({
    executablePath: path.join(releaseDir(), 'win-unpacked', 'Studium.exe'),
    args: [`--user-data=${tempUserData()}`],
    env: electronEnv(),
  });
  const page = await app.firstWindow();
  await expect(page.getByRole('heading', { name: 'What do you make?' })).toBeVisible();
  expect(await app.evaluate(() => typeof globalThis.PetLogic?.applyAwayRequest)).toBe('function');
  expect(await app.evaluate(({ app: a }) => a.isPackaged)).toBe(true);
  await app.close();
});

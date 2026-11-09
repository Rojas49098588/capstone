// Checks the unpacked build (unpackedExe in scripts/releaseDir.js: win-unpacked or mac-universal) after `npm run dist`:
//   STUDIUM_PACKAGED=1 npx playwright test packaged
// It proves the extraResources paths and the studium:// scheme work outside the repo.
const { spawn } = require('node:child_process');
const { test, expect, _electron } = require('@playwright/test');
const { tempUserData, electronEnv, studiumPage, overlayPage } = require('./launch');
const { releaseDir, unpackedExe } = require('../scripts/releaseDir');

test.skip(process.env.STUDIUM_PACKAGED !== '1', 'set STUDIUM_PACKAGED=1 after npm run dist');

const exe = () => unpackedExe(releaseDir());

test('the packaged build opens Studium and loads the pet rules', async () => {
  const app = await _electron.launch({
    executablePath: exe(),
    args: [`--user-data=${tempUserData()}`],
    env: electronEnv(),
  });
  const page = await studiumPage(app);
  await expect(page.getByRole('heading', { name: 'What should we call you?' })).toBeVisible();
  expect(await app.evaluate(() => typeof globalThis.PetLogic?.applyAwayRequest)).toBe('function');
  expect(await app.evaluate(({ app: a }) => a.isPackaged)).toBe(true);
  await app.close();
});

test("the packaged build's pet overlay loads the pet code and art", async () => {
  const app = await _electron.launch({ executablePath: exe(), args: [`--user-data=${tempUserData()}`], env: electronEnv() });
  await studiumPage(app);
  const overlay = await overlayPage(app);
  await expect.poll(() => overlay.evaluate(() => typeof globalThis.PetLogic?.shownPets)).toBe('function');
  expect(await overlay.evaluate(() => typeof chrome.storage.local.get)).toBe('function');
  // Loaded as the pets load it, with <img> (a cross-host fetch would need CORS headers).
  const artLoads = (src) =>
    overlay.evaluate(
      (url) =>
        new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve(img.naturalWidth > 0);
          img.onerror = () => resolve(false);
          img.src = url;
        }),
      src,
    );
  expect(await artLoads('studium://pets/assets/pets/cat.png')).toBe(true);
  expect(await artLoads('studium://pets/assets/pets/no-such-pet.png')).toBe(false);
  // The pets' sounds are packaged too.
  const soundLoads = (src) =>
    overlay.evaluate(
      (url) =>
        new Promise((resolve) => {
          const audio = new Audio();
          audio.oncanplaythrough = () => resolve(true);
          audio.onerror = () => resolve(false);
          audio.src = url;
        }),
      src,
    );
  expect(await soundLoads('studium://pets/assets/sounds/meow.wav')).toBe(true);
  expect(await soundLoads('studium://pets/assets/sounds/no-such-sound.wav')).toBe(false);
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

// The pet overlay: pets roam a transparent window over the whole screen, which lets clicks through
// except on a pet, and does everything the extension's pets did.
const { test, expect } = require('@playwright/test');
const { tempUserData, launch, overlayPage, studiumPage, testPet, seedPets } = require('./launch');

async function start() {
  const app = await launch({ userData: tempUserData() });
  const studium = await studiumPage(app);
  await seedPets(app, studium, [testPet('p1')]);
  const overlay = await overlayPage(app);
  const pet = overlay.locator('#capstone-pet-host .pet');
  await expect(pet).toBeVisible();
  return { app, studium, overlay, pet };
}

const store = (app) => app.evaluate(() => globalThis.studiumTest.store.get());
const mouse = (app) => app.evaluate(() => globalThis.studiumTest.overlayMouse());
const trayClick = (app, id) => app.evaluate((_e, item) => globalThis.studiumTest.trayClick(item), id);

test('the overlay covers the work area, on top, without focus', async () => {
  const { app } = await start();
  const w = await app.evaluate(({ screen }) => {
    const o = globalThis.studiumTest.overlay;
    return { bounds: o.getBounds(), workArea: screen.getPrimaryDisplay().workArea, focusable: o.isFocusable(), onTop: o.isAlwaysOnTop() };
  });
  expect(w.bounds).toEqual(w.workArea);
  expect(w.focusable).toBe(false);
  expect(w.onTop).toBe(true);
  await app.close();
});

test('a pet walks in the overlay, and stays after Studium is closed', async () => {
  const { app, pet } = await start();
  await app.evaluate(() => globalThis.studiumTest.win.close());
  await expect(pet).toBeVisible();
  await app.close();
});

test('clicks pass through except on a pet', async () => {
  const { app, overlay, pet } = await start();
  expect(await mouse(app)).toBe(false);

  // Pets walk, so aim at where the pet is now on every try.
  const hoverPet = async () => {
    const box = await pet.boundingBox();
    await overlay.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    return mouse(app);
  };
  await expect.poll(hoverPet).toBe(true);
  await overlay.mouse.move(5, 5);
  await expect.poll(() => mouse(app)).toBe(false);

  // Hiding the pets under a still pointer gives the mouse back without a move.
  await expect.poll(hoverPet).toBe(true);
  await trayClick(app, 'toggle-pets');
  await expect.poll(() => mouse(app)).toBe(false);
  await app.close();
});

test('right-click → Open project opens its page', async () => {
  const { app, studium, overlay, pet } = await start();
  await app.evaluate(() => globalThis.studiumTest.win.hide());
  // Studium follows a #project= link and then clears it from the address, so record the link.
  await studium.evaluate(() => {
    window.e2eLinks = [];
    window.addEventListener('hashchange', (e) => window.e2eLinks.push(e.newURL));
  });
  await pet.click({ button: 'right' });
  await overlay.getByRole('menuitem', { name: 'Open project' }).click();
  await expect.poll(() => app.evaluate(() => globalThis.studiumTest.win.isVisible())).toBe(true);
  await expect.poll(() => studium.evaluate(() => window.e2eLinks)).toEqual([expect.stringMatching(/#project=p1$/)]);
  await app.close();
});

test('Nap from the menu, Wake from the tray, then the check-in', async () => {
  const { app, overlay, pet } = await start();
  await pet.click({ button: 'right' });
  await overlay.getByRole('menuitem', { name: /^Nap/ }).click();
  await expect.poll(async () => Boolean((await store(app)).petAway?.p1)).toBe(true);
  await expect(pet).toBeHidden();

  await trayClick(app, 'wake:p1');
  await expect(pet).toBeVisible();
  const bubble = overlay.locator('#capstone-pet-host .talk.show');
  await expect(bubble).toBeVisible();
  await bubble.getByRole('button', { name: 'OK' }).click();
  await expect.poll(async () => Boolean((await store(app)).petCheckIn)).toBe(false);
  await app.close();
});

test('checking off the nap\'s task in Studium wakes the pet early with congrats', async () => {
  const app = await launch({ userData: tempUserData() });
  const studium = await studiumPage(app);
  await seedPets(app, studium, [testPet('p1', { napTasks: [{ taskId: 't1', title: 'Push', estimateMin: 30, group: 'today' }] })]);
  const overlay = await overlayPage(app);
  const pet = overlay.locator('#capstone-pet-host .pet');
  await expect(pet).toBeVisible();

  // Nap, choosing the task.
  await pet.click({ button: 'right' });
  await overlay.getByRole('menuitem', { name: /^Nap/ }).click();
  await overlay.locator('#capstone-pet-host .talk.show').getByRole('button', { name: /^Push/ }).click();
  await expect.poll(async () => (await store(app)).petAway?.p1?.taskId).toBe('t1');

  // Studium checks it off (what useStudium's completeTask announces).
  await studium.evaluate(() => window.dispatchEvent(new CustomEvent('studium:task-done', { detail: 't1' })));
  await expect.poll(async () => (await store(app)).petAway?.p1).toBeUndefined();
  await expect(overlay.locator('#capstone-pet-host .talk.show')).toContainText('Congrats! You finished Push!');
  await app.close();
});

test('Show/Hide pets from the tray', async () => {
  const { app, overlay } = await start();
  const host = overlay.locator('#capstone-pet-host');
  await trayClick(app, 'toggle-pets');
  await expect(host).toBeHidden();
  await trayClick(app, 'toggle-pets');
  await expect(host).toBeVisible();
  await app.close();
});

// The overlay window can get stuck ignoring mouse presses after a wake from sleep (bugs.md), so it is
// replaced on Reload pets and after a wake or unlock. The new window must take clicks on a pet.
test('Reload pets and waking the computer replace the pet window', async () => {
  const { app } = await start();
  const overlayId = () => app.evaluate(() => globalThis.studiumTest.overlay.id);
  const overlayCount = () => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().filter((w) => w.getTitle() === 'Studium pets').length);
  const hoverPetInNewWindow = async () => {
    // The page of the current overlay window (the old one may still be listed for a moment).
    const id = await overlayId();
    let page = null;
    await expect.poll(async () => {
      for (const p of app.windows()) {
        if (p.isClosed() || !p.url().startsWith('studium://overlay/')) continue;
        const winId = await (await app.browserWindow(p)).evaluate((w) => w.id).catch(() => null);
        if (winId === id) page = p;
      }
      return page !== null;
    }).toBe(true);
    const pet = page.locator('#capstone-pet-host .pet');
    await expect(pet).toBeVisible();
    await expect.poll(async () => {
      const box = await pet.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      return mouse(app);
    }).toBe(true);
  };

  const first = await overlayId();
  await trayClick(app, 'reload-pets');
  const second = await overlayId();
  expect(second).not.toBe(first);
  await expect.poll(overlayCount).toBe(1);
  expect(await mouse(app)).toBe(false);
  await hoverPetInNewWindow();

  // Waking fires resume and unlock-screen: one new window, a moment later.
  await app.evaluate(() => {
    globalThis.studiumTest.powerMonitor.emit('resume');
    globalThis.studiumTest.powerMonitor.emit('unlock-screen');
  });
  expect(await overlayId()).toBe(second);
  await expect.poll(overlayId, { timeout: 10000 }).not.toBe(second);
  const third = await overlayId();
  await expect.poll(overlayCount).toBe(1);
  await hoverPetInNewWindow();
  await new Promise((r) => setTimeout(r, 2500));
  expect(await overlayId()).toBe(third);
  await app.close();
});

// Settings → Sound: the volume reaches the overlay, and with Sound bubbles off a pet's "Meow!" is
// heard but not shown.
test('a clicked pet plays its sound at the chosen volume, with or without the bubble', async () => {
  const { app, overlay, pet } = await start();
  await overlay.evaluate(() => {
    window.e2eSounds = [];
    globalThis.PetSound.play = (key, volume) => window.e2eSounds.push([key, volume]);
  });
  const setPrefs = (prefs) => app.evaluate((_e, p) => globalThis.studiumTest.store.set({ petPrefs: p }), prefs)
    .then(() => new Promise((r) => setTimeout(r, 500))); // the overlay hears about it a moment later
  const bubble = pet.locator('.bubble');

  await setPrefs({ involvement: 'moderate', nickname: '', sounds: true, volume: 0.7, soundBubbles: false });
  await pet.click();
  await expect.poll(() => overlay.evaluate(() => window.e2eSounds)).toEqual([['meow', 0.7]]);
  await expect(bubble).not.toHaveClass(/show/);

  await setPrefs({ involvement: 'moderate', nickname: '', sounds: true, volume: 0.7, soundBubbles: true });
  await pet.click();
  await expect(bubble).toHaveClass(/show/);
  await expect(bubble).toHaveText('Meow!');
  await app.close();
});

// Recorded clips are bigger than the old placeholders; media over studium:// needs the scheme's
// stream privilege once a file is past about 512 KB, or the audio fails to load. Each clip must
// play to its end (muted) within 8 seconds: they are cut to at most 6.
test('every pet sound plays in the overlay', async () => {
  test.setTimeout(60000);
  const app = await launch({ userData: tempUserData() });
  const overlay = await overlayPage(app);
  await overlay.waitForLoadState('load');
  const keys = ['meow', 'bark', 'ribbit', 'coo', 'sneeze', 'sniffle', 'cough', 'sigh'];
  const results = await overlay.evaluate((list) => Promise.all(list.map((key) => new Promise((resolve) => {
    const audio = new Audio(`studium://pets/assets/sounds/${key}.wav`);
    audio.muted = true;
    const started = performance.now();
    const timer = setTimeout(() => resolve(`${key}: still playing after 8 s`), 8000);
    audio.addEventListener('ended', () => {
      clearTimeout(timer);
      resolve(`${key}: ended after ${Math.round((performance.now() - started) / 100) / 10} s`);
    });
    audio.addEventListener('error', () => {
      clearTimeout(timer);
      resolve(`${key}: error ${audio.error?.code}`);
    });
    audio.play().catch((e) => resolve(`${key}: ${e.message}`));
  }))), keys);
  for (const r of results) expect(r).toMatch(/: ended after/);
  await app.close();
});

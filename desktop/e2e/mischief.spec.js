// Moderate mischief in the real app, with the timings shortened by petTimingOverride.mischiefMinutes.
const { test, expect } = require('@playwright/test');
const { tempUserData, launch, overlayPage, studiumPage, testPet, seedPets } = require('./launch');

async function start(pets) {
  const app = await launch({ userData: tempUserData() });
  const studium = await studiumPage(app);
  await seedPets(app, studium, pets);
  await app.evaluate(() =>
    globalThis.studiumTest.store.set({
      petPrefs: { involvement: 'moderate', nickname: '' },
      petTimingOverride: { mischiefMinutes: 0.05 }, // every gap is 3 seconds
    }),
  );
  const overlay = await overlayPage(app);
  return { app, studium, overlay };
}

test('a sick Moderate pet opens its project in Studium without taking focus', async () => {
  const { app, studium } = await start([testPet('p1', { mood: 'Sick' })]);
  await app.evaluate(() => globalThis.studiumTest.win.hide());
  // Studium follows a #project= link and then clears it from the address, so record the link.
  await studium.evaluate(() => {
    window.e2eLinks = [];
    window.addEventListener('hashchange', (e) => window.e2eLinks.push(e.newURL));
  });
  await new Promise((r) => setTimeout(r, 4000)); // past the 3-second "Studium was just showing" wait
  await app.evaluate(() => globalThis.studiumTest.openTimer.tick());
  expect(await app.evaluate(() => globalThis.studiumTest.win.isVisible())).toBe(true);
  expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getFocusedWindow() === globalThis.studiumTest.win)).toBe(false);
  await expect.poll(() => studium.evaluate(() => window.e2eLinks)).toEqual([expect.stringMatching(/#project=p1$/)]);
  await app.close();
});

test('a Moderate pet chases the mouse', async () => {
  // A dog: cats doze now and then (10–20 s) and a dozing pet doesn't chase.
  const { app, overlay } = await start([testPet('p1', { petKind: 'dog' })]);
  // Asking where the cursor is never throws: a point on the overlay, or null.
  const cursor = await overlay.evaluate(() => window.petBridge.cursor());
  expect(cursor === null || (typeof cursor.x === 'number' && typeof cursor.y === 'number')).toBe(true);
  // The real cursor may be off the overlay (taskbar, another screen), which ends a chase at once,
  // so record that a chase started rather than looking for one in progress.
  await overlay.evaluate(() => {
    window.e2eChased = false;
    const root = document.getElementById('capstone-pet-host').shadowRoot;
    new MutationObserver(() => {
      if (root.querySelector('.pet.chasing')) window.e2eChased = true;
    }).observe(root, { subtree: true, attributes: true, attributeFilter: ['class'] });
  });
  await expect.poll(() => overlay.evaluate(() => window.e2eChased), { timeout: 15000 }).toBe(true);
  await app.close();
});

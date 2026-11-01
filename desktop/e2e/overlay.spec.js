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

  const box = await pet.boundingBox();
  await overlay.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect.poll(() => mouse(app)).toBe(true);
  await overlay.mouse.move(5, 5);
  await expect.poll(() => mouse(app)).toBe(false);

  // Hiding the pets under a still pointer gives the mouse back without a move.
  const again = await pet.boundingBox();
  await overlay.mouse.move(again.x + again.width / 2, again.y + again.height / 2);
  await expect.poll(() => mouse(app)).toBe(true);
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

test('Show/Hide pets from the tray', async () => {
  const { app, overlay } = await start();
  const host = overlay.locator('#capstone-pet-host');
  await trayClick(app, 'toggle-pets');
  await expect(host).toBeHidden();
  await trayClick(app, 'toggle-pets');
  await expect(host).toBeVisible();
  await app.close();
});

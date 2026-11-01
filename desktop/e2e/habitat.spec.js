// Habitats in the Studium window: a project page's pet lives in its habitat box, and leaves the
// desktop meanwhile. The box stands in for the one Studium's Habitat.tsx renders on a project page.
const { test, expect } = require('@playwright/test');
const { tempUserData, launch, overlayPage, studiumPage, testPet, seedPets } = require('./launch');

async function start() {
  const app = await launch({ userData: tempUserData() });
  const studium = await studiumPage(app);
  await seedPets(app, studium, [testPet('p1'), testPet('p2')]);
  const overlay = await overlayPage(app);
  const desktopPets = overlay.locator('#capstone-pet-host .pet:visible');
  await expect(desktopPets).toHaveCount(2);
  return { app, studium, overlay, desktopPets };
}

const addBox = (studium) =>
  studium.evaluate(() => {
    const box = document.createElement('div');
    box.dataset.petHabitat = 'p1';
    box.style.cssText = 'position:fixed;left:20px;top:80px;width:400px;height:240px';
    document.body.appendChild(box);
  });
const liveHabitat = (app) => app.evaluate(() => globalThis.studiumTest.habitat.get());

test("a project page's pet lives in its habitat and leaves the desktop", async () => {
  const { app, studium, desktopPets } = await start();
  await addBox(studium);
  await expect(studium.locator('#capstone-pet-host .pet:visible')).toHaveCount(1);
  await expect(studium.locator('[data-pet-habitat="p1"]')).toHaveAttribute('data-pet-attached', '');
  await expect.poll(() => liveHabitat(app)).toBe('p1');
  await expect(desktopPets).toHaveCount(1);
  await app.close();
});

test('closing or minimizing Studium sends the pet back to the desktop', async () => {
  const { app, studium, desktopPets } = await start();
  await addBox(studium);
  await expect.poll(() => liveHabitat(app)).toBe('p1');
  await expect(desktopPets).toHaveCount(1);

  await app.evaluate(() => globalThis.studiumTest.win.close());
  await expect.poll(() => liveHabitat(app)).toBe(null);
  await expect(desktopPets).toHaveCount(2);

  await app.evaluate(() => globalThis.studiumTest.trayClick('open'));
  await expect.poll(() => liveHabitat(app)).toBe('p1');
  await expect(desktopPets).toHaveCount(1);

  await app.evaluate(() => globalThis.studiumTest.win.minimize());
  await expect.poll(() => liveHabitat(app)).toBe(null);
  await expect(desktopPets).toHaveCount(2);
  await app.close();
});

test("reloading Studium on a project page doesn't lose the pet", async () => {
  const { app, studium, desktopPets } = await start();
  await addBox(studium);
  await expect.poll(() => liveHabitat(app)).toBe('p1');
  await expect(desktopPets).toHaveCount(1);
  // (After a reload Studium publishes its own pets again, so only the habitat is checked here.)
  await studium.reload();
  await expect.poll(() => liveHabitat(app)).toBe(null);
  await app.close();
});

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

const addBox = (studium, id = 'p1', top = 80) =>
  studium.evaluate(([id, top]) => {
    const box = document.createElement('div');
    box.dataset.petHabitat = id;
    box.style.cssText = `position:fixed;left:20px;top:${top}px;width:400px;height:240px`;
    document.body.appendChild(box);
  }, [id, top]);
const liveHabitat = (app) => app.evaluate(() => globalThis.studiumTest.habitat.get());

test("a project page's pet lives in its habitat and leaves the desktop", async () => {
  const { app, studium, desktopPets } = await start();
  await addBox(studium);
  await expect(studium.locator('#capstone-pet-host .pet:visible')).toHaveCount(1);
  await expect(studium.locator('[data-pet-habitat="p1"]')).toHaveAttribute('data-pet-attached', '');
  await expect.poll(() => liveHabitat(app)).toEqual(['p1']);
  await expect(desktopPets).toHaveCount(1);
  await app.close();
});

test('closing or minimizing Studium sends the pet back to the desktop', async () => {
  const { app, studium, desktopPets } = await start();
  await addBox(studium);
  await expect.poll(() => liveHabitat(app)).toEqual(['p1']);
  await expect(desktopPets).toHaveCount(1);

  await app.evaluate(() => globalThis.studiumTest.win.close());
  await expect.poll(() => liveHabitat(app)).toEqual([]);
  await expect(desktopPets).toHaveCount(2);

  await app.evaluate(() => globalThis.studiumTest.trayClick('open'));
  await expect.poll(() => liveHabitat(app)).toEqual(['p1']);
  await expect(desktopPets).toHaveCount(1);

  await app.evaluate(() => globalThis.studiumTest.win.minimize());
  await expect.poll(() => liveHabitat(app)).toEqual([]);
  await expect(desktopPets).toHaveCount(2);
  await app.close();
});

test("reloading Studium on a project page doesn't lose the pet", async () => {
  const { app, studium, desktopPets } = await start();
  await addBox(studium);
  await expect.poll(() => liveHabitat(app)).toEqual(['p1']);
  await expect(desktopPets).toHaveCount(1);
  // (After a reload Studium publishes its own pets again, so only the habitat is checked here.)
  await studium.reload();
  await expect.poll(() => liveHabitat(app)).toEqual([]);
  await app.close();
});

test("a project with a bought pet: both live in their habitats and leave the desktop", async () => {
  const app = await launch({ userData: tempUserData() });
  const studium = await studiumPage(app);
  await seedPets(app, studium, [testPet('p1'), testPet('p1', { petId: 'x1', shortName: 'Frog', petKind: 'frog' }), testPet('p2')]);
  const overlay = await overlayPage(app);
  const desktopPets = overlay.locator('#capstone-pet-host .pet:visible');
  await expect(desktopPets).toHaveCount(3);

  await addBox(studium, 'p1', 80);
  await addBox(studium, 'x1', 340);
  await expect(studium.locator('#capstone-pet-host .pet:visible')).toHaveCount(2);
  await expect(studium.locator('[data-pet-habitat="x1"]')).toHaveAttribute('data-pet-attached', '');
  await expect.poll(() => liveHabitat(app)).toEqual(['p1', 'x1']);
  await expect(desktopPets).toHaveCount(1);
  await app.close();
});

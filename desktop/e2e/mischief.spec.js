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

test('a Moderate pet chases the mouse', async () => {
  const { app, overlay } = await start([testPet('p1')]);
  // Asking where the cursor is never throws: a point on the overlay, or null.
  const cursor = await overlay.evaluate(() => window.petBridge.cursor());
  expect(cursor === null || (typeof cursor.x === 'number' && typeof cursor.y === 'number')).toBe(true);
  await expect(overlay.locator('#capstone-pet-host .pet.chasing')).toHaveCount(1, { timeout: 15000 });
  await app.close();
});

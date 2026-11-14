const { test, expect } = require('@playwright/test');
const { tempUserData, launch, studiumPage } = require('./launch');

test('Settings shows Link account in the desktop app', async () => {
  const app = await launch({ userData: tempUserData() });
  const page = await studiumPage(app);
  await page.waitForLoadState('domcontentloaded');
  // Skip the first-run setup, then reload so Studium starts from these settings.
  await page.evaluate(() => localStorage.setItem('studium-settings-v1', JSON.stringify({ setupDone: true, nickname: 'Test', tutorialDone: true, shopTutorialDone: true })));
  await page.reload();
  await page.getByRole('button', { name: 'Not now' }).click(); // the first-project prompt
  await page.getByRole('button', { name: 'Settings' }).click();
  // The button shows (disabled) while Firebase loads; no network is needed to show it.
  await expect(page.getByRole('button', { name: 'Link account' })).toBeVisible();
  expect(await page.evaluate(() => typeof window.studiumDesktop.signInWithBrowser)).toBe('function');
  await app.close();
});

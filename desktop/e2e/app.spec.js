const { spawn } = require('node:child_process');
const { test, expect } = require('@playwright/test');
const { desktopDir, tempUserData, electronEnv, launch } = require('./launch');

const isVisible = (app) => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible());

test('opens Studium in its own window', async () => {
  const app = await launch({ userData: tempUserData() });
  const page = await app.firstWindow();
  await expect(page.getByRole('heading', { name: 'What do you make?' })).toBeVisible();
  await app.close();
});

test("keeps Studium's data across restarts", async () => {
  const userData = tempUserData();
  let app = await launch({ userData });
  let page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.evaluate(() => localStorage.setItem('e2e', 'kept'));
  await app.close();

  app = await launch({ userData });
  page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  expect(await page.evaluate(() => localStorage.getItem('e2e'))).toBe('kept');
  await app.close();
});

test('closing the window hides it and the app keeps running', async () => {
  const app = await launch({ userData: tempUserData() });
  await app.firstWindow();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
  expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1);
  expect(await isVisible(app)).toBe(false);
  await app.close();
});

test('--hidden starts in the background with Studium loaded', async () => {
  const app = await launch({ userData: tempUserData(), args: ['--hidden'] });
  const page = await app.firstWindow();
  expect(await isVisible(app)).toBe(false);
  expect(page.url()).toMatch(/^studium:\/\/app\//);
  await app.close();
});

test('a second launch exits and shows the first copy', async () => {
  const userData = tempUserData();
  const app = await launch({ userData, args: ['--hidden'] });
  await app.firstWindow();
  expect(await isVisible(app)).toBe(false);

  const second = spawn(require('electron'), ['.', `--user-data=${userData}`], { cwd: desktopDir, env: electronEnv() });
  const code = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('second copy did not exit')), 10000);
    second.on('exit', (c) => {
      clearTimeout(timer);
      resolve(c);
    });
  });
  expect(code).toBe(0);
  await expect.poll(() => isVisible(app)).toBe(true);
  await app.close();
});

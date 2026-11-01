const { spawn } = require('node:child_process');
const { test, expect } = require('@playwright/test');
const { desktopDir, tempUserData, electronEnv, launch, studiumPage } = require('./launch');

const isVisible = (app) => app.evaluate(() => globalThis.studiumTest.win.isVisible());

test('opens Studium in its own window', async () => {
  const app = await launch({ userData: tempUserData() });
  const page = await studiumPage(app);
  await expect(page.getByRole('heading', { name: 'What do you make?' })).toBeVisible();
  await app.close();
});

test("keeps Studium's data across restarts", async () => {
  const userData = tempUserData();
  let app = await launch({ userData });
  let page = await studiumPage(app);
  await page.waitForLoadState('domcontentloaded');
  await page.evaluate(() => localStorage.setItem('e2e', 'kept'));
  await app.close();

  app = await launch({ userData });
  page = await studiumPage(app);
  await page.waitForLoadState('domcontentloaded');
  expect(await page.evaluate(() => localStorage.getItem('e2e'))).toBe('kept');
  await app.close();
});

test('closing the window hides it and the app keeps running', async () => {
  const app = await launch({ userData: tempUserData() });
  await studiumPage(app);
  await app.evaluate(() => globalThis.studiumTest.win.close());
  expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(2);
  expect(await isVisible(app)).toBe(false);
  await app.close();
});

test('--hidden starts in the background with Studium loaded', async () => {
  const app = await launch({ userData: tempUserData(), args: ['--hidden'] });
  const page = await studiumPage(app);
  expect(await isVisible(app)).toBe(false);
  expect(page.url()).toMatch(/^studium:\/\/app\//);
  await app.close();
});

test('a second launch exits and shows the first copy', async () => {
  const userData = tempUserData();
  const app = await launch({ userData, args: ['--hidden'] });
  await studiumPage(app);
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

test("Studium's settings reach the main process", async () => {
  const app = await launch({ userData: tempUserData() });
  const page = await studiumPage(app);
  await page.waitForLoadState('domcontentloaded');
  await page.evaluate(() => {
    localStorage.setItem('studium-settings-v1', JSON.stringify({ petInvolvement: 'moderate' }));
    window.dispatchEvent(new Event('studium:settings-updated'));
  });
  await expect.poll(() => app.evaluate(() => globalThis.studiumTest.store.get().petPrefs?.involvement)).toBe('moderate');
  expect(await page.evaluate(() => window.studiumDesktop)).toEqual({ desktop: true });
  await app.close();
});

test('a nap that ended while the app was closed reaches Studium on the next start', async () => {
  const userData = tempUserData();
  const now = Date.now();
  const nap = { kind: 'nap', id: 'nap-e2e', startedAt: new Date(now - 20 * 60000).toISOString(), until: new Date(now - 5 * 60000).toISOString(), taskId: null, taskTitle: null };
  require('node:fs').writeFileSync(require('node:path').join(userData, 'pet-state.json'), JSON.stringify({ petAway: { webDev: nap } }));
  const app = await launch({ userData });
  await studiumPage(app);
  // Ended by endOverdue, delivered on studium:ready, confirmed by Studium, then removed.
  await expect.poll(() => app.evaluate(() => globalThis.studiumTest.store.get().petAway)).toEqual({});
  await expect.poll(() => app.evaluate(() => globalThis.studiumTest.store.get().focusOutbox)).toEqual({});
  await app.close();
});

test('the tray hides and shows the pets', async () => {
  const app = await launch({ userData: tempUserData() });
  await studiumPage(app);
  await app.evaluate(() => globalThis.studiumTest.trayClick('toggle-pets'));
  expect(await app.evaluate(() => globalThis.studiumTest.store.get().petHidden)).toBe(true);
  expect(await app.evaluate(() => globalThis.studiumTest.trayItems[1].label)).toBe('Show pets');
  await app.close();
});

test("the tray's Open Studium brings back a closed window", async () => {
  const app = await launch({ userData: tempUserData() });
  await studiumPage(app);
  await app.evaluate(() => globalThis.studiumTest.win.close());
  expect(await isVisible(app)).toBe(false);
  await app.evaluate(() => globalThis.studiumTest.trayClick('open'));
  await expect.poll(() => isVisible(app)).toBe(true);
  await app.close();
});

test("the tray's Quit ends the app", async () => {
  const app = await launch({ userData: tempUserData() });
  await studiumPage(app);
  const exited = new Promise((resolve) => app.process().on('exit', resolve));
  await app.evaluate(() => globalThis.studiumTest.trayClick('quit')).catch(() => {});
  await expect(Promise.race([exited.then(() => 'exited'), new Promise((r) => setTimeout(() => r('still running'), 10000))])).resolves.toBe('exited');
});

test('the window stays on Studium when something tries to navigate it away', async () => {
  const app = await launch({ userData: tempUserData() });
  const page = await studiumPage(app);
  await page.waitForLoadState('domcontentloaded');
  // Turn start-with-computer off, as the user would in Settings.
  await page.evaluate(() => {
    localStorage.setItem('studium-settings-v1', JSON.stringify({ startWithComputer: false }));
    window.dispatchEvent(new Event('studium:settings-updated'));
  });
  // What dropping a file onto the window does: a navigation started by the page.
  await page.evaluate(() => {
    location.href = 'file:///C:/Windows/win.ini';
  });
  const popup = await page.evaluate(() => window.open('file:///C:/Windows/win.ini') === null);
  await page.waitForTimeout(1000);
  expect(page.url()).toMatch(/^studium:\/\/app\//);
  expect(popup).toBe(true);
  expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(2);
  await app.close();
});

/** Starts a second copy of the app (as Windows does for a taskbar menu item) and waits for it to exit. */
function runCopy(userData, extraArgs) {
  const copy = spawn(require('electron'), ['.', `--user-data=${userData}`, ...extraArgs], { cwd: desktopDir, env: electronEnv() });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      copy.kill();
      reject(new Error('copy did not exit'));
    }, 10000);
    copy.on('exit', (c) => {
      clearTimeout(timer);
      resolve(c);
    });
  });
}

test("the taskbar menu's Quit Studium ends the running app", async () => {
  const userData = tempUserData();
  const app = await launch({ userData });
  await studiumPage(app);
  const exited = new Promise((resolve) => app.process().on('exit', resolve));
  expect(await runCopy(userData, ['--quit'])).toBe(0);
  await expect(Promise.race([exited.then(() => 'exited'), new Promise((r) => setTimeout(() => r('still running'), 10000))])).resolves.toBe('exited');
});

test('Quit Studium when Studium is not running just exits', async () => {
  expect(await runCopy(tempUserData(), ['--quit'])).toBe(0);
});

# Desktop App, Week 1: Electron Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Studium runs as a Windows desktop app: its own window, a tray icon with a menu, close-to-tray, start-with-computer (with a setting to turn it off), the main-process pet state with naps and sleep, and a Windows installer. Pets on the desktop are Week 2.

**Architecture:** A new `desktop/` package (Electron 45, plain CommonJS JavaScript, like `extension/`). The main process serves the built `web/dist` over a private `studium://app/` scheme so Studium's `localStorage` has a stable origin, keeps the pet state the extension kept in `chrome.storage.local` in one JSON-file store, and runs naps/sleep with `setTimeout` in place of `chrome.alarms`, using the existing pure rules in `extension/content/logic.js` (loaded with `require`, which sets `globalThis.PetLogic`). A preload script replaces `extension/content/bridge.js` and the Studium half of `pet.js`, using the same DOM events, so Studium itself needs no changes except one new setting.

**Tech Stack:** Electron 45, electron-builder 26 (NSIS), Vitest 5, Playwright 1.64 (`_electron`), Node 24. Studium: React 19 / Vite 8 (unchanged).

**Spec:** `docs/superpowers/specs/2026-10-28-desktop-app-design.md`

## Global Constraints

- Work on `feature/desktop-app` (already cut from `main` at `fec52e3`; tag `chrome-extension-final` exists).
- New code lives in `desktop/`. Nothing in `extension/` changes this week. `web/` changes only for the start-with-computer setting (Task 6).
- Electron-facing files (`main.js`, `studiumWindow.js`, `tray.js` wiring) stay thin; every rule lives in a pure function with a Vitest test. Pure modules never `require('electron')`.
- Reuse `logic.js` for every pet rule (`parseStatuses`, `parseAway`, `parseOutbox`, `parseCheckIn`, `napMinutesFrom`, `applyAwayRequest`, `wakeMenuEntries`, `screenFromSettings`, `prefsFromSettings`). Do not copy them.
- The Studium window uses `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`.
- Studium is shown with focus only when the user asked (tray "Open Studium", second launch, a nap's "open" effect). The app never steals focus otherwise.
- Closing the Studium window hides it. Only the tray's Quit ends the app.
- Starts with the computer by default, launched with `--hidden`; only a packaged build registers itself (`app.isPackaged`), so development never registers `electron.exe`.
- State file: `<userData>/pet-state.json`. A damaged file is renamed to `pet-state.json.damaged` and the app starts from empty state.
- Tests first. At the end of every task: `npm test` in `desktop/` and `npx vitest run --maxWorkers=4` in `web/` pass.
- Windows only this week. Mac build is Week 4. No code signing, no auto-update.

## Review Focus

1. **Launched twice** (start-with-computer, then a double-click on the shortcut): the second copy exits and the first shows its Studium window; there's never a second tray icon. (Pinned in Task 1, e2e.)
2. **Studium's data survives quitting and restarting the app**: `localStorage` on `studium://app/` persists in `userData`. (Pinned in Task 1, e2e.)
3. **Damaged `pet-state.json`** (half-written by a power cut, hand-edited): the app starts, the damaged copy is kept, and the next save writes a good file. Saves go through a temp file and a rename, so a crash mid-save leaves the old file. (Pinned in Task 2.)
4. **A nap that ended while the PC was off**: on the next start the nap is ended and its session reaches Studium, even though Studium's window loads after the main process has already ended it (delivery on `studium:ready`). (Pinned in Tasks 3 and 4.)
5. **A `studium://` path outside `web/dist`** (`studium://app/../../secret`, encoded `%2e%2e`): never served; unknown paths fall back to `index.html` so a reload on `#project=…` still opens Studium. (Pinned in Task 1.)

---

### Task 1: The `desktop/` package and the Studium window

**Files:**
- Create: `desktop/package.json`, `desktop/vitest.config.js`, `desktop/playwright.config.js`
- Create: `desktop/src/main/main.js` (wiring), `desktop/src/main/paths.js`, `desktop/src/main/protocol.js`, `desktop/src/main/studiumWindow.js`
- Test: `desktop/test/paths.test.js`, `desktop/test/protocol.test.js`, `desktop/e2e/app.spec.js`, `desktop/e2e/launch.js` (shared helper)
- Modify: `.gitignore` (add `desktop/release/`, `test-results/`, `playwright-report/`)

**Interfaces:**
- Produces:
  - `paths.js`: `resolvePaths({ packaged: boolean, resourcesPath: string, desktopDir: string }) -> { webDist: string, logicJs: string, trayIcon: string }`. Packaged: `<resourcesPath>/web`, `<resourcesPath>/extension/logic.js`, `<resourcesPath>/web/pets/egg.png`. Not packaged: `<desktopDir>/../web/dist`, `<desktopDir>/../extension/content/logic.js`, `<desktopDir>/../web/public/pets/egg.png`.
  - `paths.js`: `parseArgs(argv: string[]) -> { dev: boolean, hidden: boolean, userData: string | null }` from `--dev`, `--hidden`, `--user-data=<path>`.
  - `paths.js`: `STUDIUM_URL = 'studium://app/'`, `DEV_URL = 'http://localhost:5173/'`, `startUrl(dev: boolean) -> string`.
  - `protocol.js`: `fileForRequest(url: string, webDist: string) -> string` (absolute path inside `webDist`) and `registerStudiumScheme()` (call before `ready`: `protocol.registerSchemesAsPrivileged([{ scheme: 'studium', privileges: { standard: true, secure: true, supportFetchAPI: true } }])`), `handleStudiumScheme(webDist)` (after `ready`: `protocol.handle('studium', req => net.fetch(pathToFileURL(fileForRequest(req.url, webDist)).toString()))`).
  - `studiumWindow.js`: `createStudiumWindow({ url, preload, show }) -> BrowserWindow` (1200×800, min 800×600, title "Studium"; `close` hides unless `app.isQuitting`), `showStudium(win, hash?: string)` (sets `location.hash` with `win.webContents.executeJavaScript`, then restores, shows and focuses).
  - `main.js` sets `app.isQuitting = true` on `before-quit`, and exposes `globalThis.studiumTest = {}` for the e2e tests (later tasks add to it).

- [ ] **Step 1: Create `desktop/package.json`**

`"name": "studium-desktop"`, `"productName": "Studium"`, `"version": "0.4.0"`, `"main": "src/main/main.js"`, `"private": true`. Scripts:
- `"start": "npm --prefix ../web run build && electron ."`
- `"dev": "electron . --dev"` (run `npm run dev` in `web/` first)
- `"test": "vitest run"`
- `"test:e2e": "npm --prefix ../web run build && playwright test"`

devDependencies: `electron@^45.1.0`, `electron-builder@^26.18.0`, `vitest@^5.0.4`, `jsdom` (same version as `web/`), `@playwright/test@^1.64.1`. `vitest.config.js` runs `test/**/*.test.js` only (node environment). `playwright.config.js` uses `testDir: 'e2e'`, `workers: 1`, `timeout: 60000`. Run `npm install` in `desktop/`.

- [ ] **Step 2: Write the failing unit tests**

`test/paths.test.js`:
```js
it('resolves dev paths next to the repo', () => {
  const p = resolvePaths({ packaged: false, resourcesPath: 'X', desktopDir: '/r/desktop' });
  expect(p.webDist).toBe(path.resolve('/r/web/dist'));
  expect(p.logicJs).toBe(path.resolve('/r/extension/content/logic.js'));
});
it('resolves packaged paths in resources', () => {
  const p = resolvePaths({ packaged: true, resourcesPath: '/app/res', desktopDir: 'ignored' });
  expect(p.webDist).toBe(path.resolve('/app/res/web'));
  expect(p.logicJs).toBe(path.resolve('/app/res/extension/logic.js'));
});
it('parses flags', () => {
  expect(parseArgs(['electron.exe', '.', '--hidden', '--user-data=C:\\tmp\\u'])).toEqual({ dev: false, hidden: true, userData: 'C:\\tmp\\u' });
  expect(parseArgs(['Studium.exe'])).toEqual({ dev: false, hidden: false, userData: null });
});
it('startUrl', () => {
  expect(startUrl(true)).toBe('http://localhost:5173/');
  expect(startUrl(false)).toBe('studium://app/');
});
```
`test/protocol.test.js` (with `const dist = path.resolve('/r/web/dist')`):
- `studium://app/` → `<dist>/index.html`
- `studium://app/decor/clock.svg` → `<dist>/decor/clock.svg`
- `studium://app/assets/index-abc.js?x=1#project=a` → `<dist>/assets/index-abc.js`
- `studium://app/../../secret.txt`, `studium://app/%2e%2e/%2e%2e/secret.txt`, `studium://app/..%5c..%5csecret.txt` → `<dist>/index.html`
- `studium://app/no-such-page` (no extension) → `<dist>/index.html`

- [ ] **Step 3: Run `npm test` in `desktop/`.** Expected: FAIL, modules not found.

- [ ] **Step 4: Implement `paths.js` and `protocol.js`**

`fileForRequest`: take `new URL(url).pathname`, `decodeURIComponent` it, `path.resolve(webDist, '.' + pathname)`; if the result isn't inside `webDist` (check with `path.relative` not starting with `..` and not absolute), or the path has no file extension, return `index.html`. A missing file with an extension is passed through; `net.fetch` answers 404.

- [ ] **Step 5: Run `npm test`.** Expected: PASS.

- [ ] **Step 6: Implement `studiumWindow.js` and `main.js`**

`main.js` order: `parseArgs(process.argv)`; if `userData`, `app.setPath('userData', userData)`; `registerStudiumScheme()`; `if (!app.requestSingleInstanceLock()) { app.quit(); return; }`; `app.on('second-instance', () => showStudium(win))`; on `ready`: `handleStudiumScheme(paths.webDist)`, create the window with `show: !args.hidden` and `url = startUrl(args.dev)`. `window-all-closed` does nothing (the app lives in the tray). No preload yet (Task 3).

- [ ] **Step 7: Write the e2e tests**

`e2e/launch.js` exports `launch({ userData, args = [] })`, which returns `_electron.launch({ args: ['.', `--user-data=${userData}`, ...args], cwd: desktopDir })`. Each test makes a fresh temp folder with `fs.mkdtempSync`. `e2e/app.spec.js`:
- **opens Studium:** `firstWindow()` shows heading "What do you make?" (setup's first step).
- **keeps data across restarts:** `page.evaluate(() => localStorage.setItem('e2e', 'kept'))`, `app.close()`, launch again with the same `userData`, read it back: `'kept'`.
- **closing hides:** `app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close())`; then the window count is 1 and `isVisible()` is `false`.
- **--hidden:** launched with `--hidden`, the window exists, is not visible, and its URL starts with `studium://app/`.
- **second launch:** with the first app hidden, spawn `require('electron')` (the binary path) with the same `.` and `--user-data`; it exits within 10 s, and the first app's window becomes visible.

- [ ] **Step 8: Run `npm run test:e2e` in `desktop/`.** Expected: 5 passed.

- [ ] **Step 9: Commit**

```bash
git add .gitignore desktop/package.json desktop/package-lock.json desktop/vitest.config.js desktop/playwright.config.js desktop/src desktop/test desktop/e2e
git commit -m "feat(desktop): Electron shell that opens Studium in its own window"
```

---

### Task 2: The pet state store

**Files:**
- Create: `desktop/src/main/store.js`
- Test: `desktop/test/store.test.js`

**Interfaces:**
- Produces:
  - `STATE_KEYS = ['petStatuses', 'petPrefs', 'petScreen', 'petAway', 'petCheckIn', 'focusOutbox', 'petNoteAt', 'pets', 'petHidden', 'petTimingOverride']`: the same names the extension used in `chrome.storage.local`, holding the same raw values. Readers clean them with the `logic.js` parsers, as `background.js` did.
  - `createStore({ file: string, fs = require('fs') }) -> { get(): object, set(patch: object): void, onChange(fn: (keys: string[], state: object) => void): () => void }`.
  - `get()` returns a shallow copy. `set` ignores keys not in `STATE_KEYS`, saves at once (write `file + '.tmp'`, then `renameSync` over `file`), and calls listeners with the changed keys. It doesn't save or notify if nothing changed (compare with `JSON.stringify` per key). The main process is the only writer, so saving synchronously is fine.

- [ ] **Step 1: Write the failing tests** (`test/store.test.js`, each in a fresh `fs.mkdtempSync` folder)

- no file → `get()` is `{}`
- `set({ petHidden: true })` then a new `createStore` on the same file → `get().petHidden === true`
- `set({ bogus: 1 })` → not saved, no listener call
- listener receives `['petAway']` for `set({ petAway: { a: {...} } })`; setting the same value again calls nothing
- file contains `{"petHidden": tru` → `get()` is `{}`, `pet-state.json.damaged` exists with the original text, and a following `set` writes valid JSON
- file contains `[1,2]` or `"text"` → treated as damaged too
- a save that throws mid-write (inject an `fs` whose `renameSync` throws) leaves the old file content in place, and `set` still updates `get()` (logged with `console.error`, not thrown)

- [ ] **Step 2: Run `npm test`.** Expected: FAIL.
- [ ] **Step 3: Implement `store.js`.**
- [ ] **Step 4: Run `npm test`.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(desktop): pet state store in a JSON file`

---

### Task 3: Naps and sleep in the main process

**Files:**
- Create: `desktop/src/main/away.js`
- Test: `desktop/test/away.test.js`

**Interfaces:**
- Consumes: `createStore` (Task 2), `globalThis.PetLogic` (`logic.js`).
- Produces: `createAwayRunner({ store, L, open, now = Date.now, newId = crypto.randomUUID, setTimer = setTimeout, clearTimer = clearTimeout }) -> { request(req: object): Promise<void>, dispose(): void }`.
  - `request` serializes like `background.js`'s queue: `queue = queue.then(() => run(req)).catch(console.error)`.
  - `run` is `background.js` `run()` with the store in place of `chrome.storage`: build `state` from `L.parseAway(petAway, now)`, `L.parseOutbox(focusOutbox)`, `L.parseCheckIn(petCheckIn)`, and `ctx` from `L.parseStatuses(petStatuses ?? null)` and `L.napMinutesFrom(petTimingOverride)`; `L.applyAwayRequest(state, req, ctx)`; `store.set(result.state)` if `changed`.
  - Effects: `setAlarm` → one timer per `name` (clear any old one with that name), firing `request({ type: 'end', projectId: name.slice('away:'.length) })` at `when - now()` ms (0 if past); `clearAlarm` → clear it; `open` → `open(effect.hash)`.
  - `dispose` clears all timers.

- [ ] **Step 1: Write the failing tests** (`vi.useFakeTimers()`, real `logic.js` imported like `web/src/extension/petLogic.test.ts`, an in-memory store `{ get, set }`, statuses with one pet `webDev`)

- `request({ type: 'nap', projectId: 'webDev' })` → `petAway.webDev` set; after `vi.advanceTimersByTime(15 * 60000)` and flushing the queue, `petAway.webDev` is gone and `focusOutbox` has one session for `webDev`
- with `petTimingOverride: { napMinutes: 1 }` the nap ends after 1 minute
- `wake` before the timer → nap ended early, and the timer is cleared (advancing 15 minutes adds no second session)
- `endOverdue` with a stored `petAway` entry whose end is in the past → ended at once, session in the outbox (Review Focus 4)
- `endOverdue` with one that ends in 5 minutes → a timer is armed, and fires at 5 minutes
- `delivered` with the session's id → removed from `focusOutbox`
- with a stored `petCheckIn` for `webDev` and no `taskId`, `request({ type: 'checkIn', answer: 'done' })` calls `open('project=webDev')` and clears `petCheckIn` (the check-in question itself is shown by pets in Week 2; the rule is ready now)
- two requests sent without awaiting run in order (the second sees the first's state)

- [ ] **Step 2: Run `npm test`.** Expected: FAIL.
- [ ] **Step 3: Implement `away.js`.**
- [ ] **Step 4: Run `npm test`.** Expected: PASS.
- [ ] **Step 5: Wire it in `main.js`:** after `ready`, `require(paths.logicJs)`, create the store at `path.join(app.getPath('userData'), 'pet-state.json')`, create the runner with `open: (hash) => showStudium(win, hash)`, and call `runner.request({ type: 'endOverdue' })`. Add `store` and `runner` to `globalThis.studiumTest`.
- [ ] **Step 6: Commit** `feat(desktop): naps and sleep run in the main process`

---

### Task 4: The Studium preload bridge

**Files:**
- Create: `desktop/src/preload/studium.js`, `desktop/src/main/bridge.js`
- Test: `desktop/test/preload.test.js` (`// @vitest-environment jsdom`), `desktop/test/bridge.test.js`
- Modify: `desktop/src/main/main.js`, `desktop/src/main/studiumWindow.js` (pass `preload`)

**Interfaces:**
- Consumes: store (Task 2), runner (Task 3).
- Produces:
  - IPC channels (renderer → main): `studium:statuses` (raw string or null from `localStorage[PET_STATUS_KEY]`), `studium:settings` (raw string or null from `localStorage[SETTINGS_KEY]`), `studium:ready`, `studium:delivered` (`string[]`), `studium:wake` (`string`). Main → renderer: `studium:focus-sessions` (array of sessions).
  - `preload/studium.js`: `EVENTS = { PET_STATUS_KEY: 'studium-pets-v1', PET_STATUS_EVENT: 'studium:pets-updated', SETTINGS_KEY: 'studium-settings-v1', SETTINGS_EVENT: 'studium:settings-updated', FOCUS_SESSIONS_EVENT: 'studium:focus-sessions', FOCUS_RECEIVED_EVENT: 'studium:focus-received', READY_EVENT: 'studium:ready', WAKE_PET_EVENT: 'studium:wake-pet' }`. These are copied because a sandboxed preload can only `require('electron')`; a test keeps them equal to `logic.js`.
  - `installBridge({ win, storage, ipc: { send(channel, payload), on(channel, fn) } })`: sends statuses and settings once at install and again on `PET_STATUS_EVENT` / `SETTINGS_EVENT`; forwards `READY_EVENT` as `studium:ready`; forwards `FOCUS_RECEIVED_EVENT` (parse `detail` JSON, only a non-empty array of strings) as `studium:delivered`; forwards `WAKE_PET_EVENT` (non-empty string `detail`) as `studium:wake`; on `studium:focus-sessions`, dispatches `new CustomEvent(FOCUS_SESSIONS_EVENT, { detail: JSON.stringify(sessions) })` if the array is not empty.
  - At the bottom, only when `process.type === 'renderer'`: install with `ipcRenderer` and `window.localStorage`, and `contextBridge.exposeInMainWorld('studiumDesktop', { desktop: true })` (Task 6 reads it). `module.exports = { EVENTS, installBridge }`.
  - `bridge.js`: `handleStudium(channel, payload, { store, runner, L, sendSessions })` →
    - `studium:statuses`: `L.parseStatuses(payload ?? null)`; if not null, `store.set({ petStatuses: parsed })`
    - `studium:settings`: `store.set({ petScreen: L.screenFromSettings(payload), petPrefs: L.prefsFromSettings(payload) })` (Task 6 adds start-with-computer here)
    - `studium:ready`: `sendSessions(Object.values(L.parseOutbox(store.get().focusOutbox)))`
    - `studium:delivered`: `runner.request({ type: 'delivered', ids: payload })` if `L.parseRequest` accepts it
    - `studium:wake`: `runner.request({ type: 'wake', projectId: payload })` the same way
    - anything else: ignored

- [ ] **Step 1: Write the failing tests**

`preload.test.js`: for each `EVENTS` key, the value equals the `logic.js` constant of the same name. Then with a fake `ipc` and jsdom's `window`/`localStorage`:
- installing with `localStorage['studium-pets-v1'] = '{"x":1}'` sends `['studium:statuses', '{"x":1}']`
- dispatching `studium:settings-updated` sends the current settings text
- `studium:focus-received` with detail `'["a"]'` sends `['studium:delivered', ['a']]`, and with `'nope'`, `'[]'` or `'[1]'` sends nothing
- `studium:wake-pet` with detail `'webDev'` sends `['studium:wake', 'webDev']`, and with `''` sends nothing
- an incoming `studium:focus-sessions` with `[{id:'s1'}]` dispatches `studium:focus-sessions` with detail `'[{"id":"s1"}]'`

`bridge.test.js`, with a real store in a temp folder, a fake runner (records requests) and real `logic.js`:
- damaged statuses text → `petStatuses` unchanged
- valid statuses → saved
- settings with `petInvolvement: 'moderate'` → `petPrefs.involvement === 'moderate'`
- `studium:ready` with two sessions in the outbox → `sendSessions` gets both (Review Focus 4)
- `studium:delivered` with `[1]` → no request

- [ ] **Step 2: Run `npm test`.** Expected: FAIL.
- [ ] **Step 3: Implement `preload/studium.js` and `bridge.js`.**
- [ ] **Step 4: Run `npm test`.** Expected: PASS.
- [ ] **Step 5: Wire it.**
  - Pass `preload: path.join(__dirname, '../preload/studium.js')` to the window.
  - In `main.js`, route each channel with `ipcMain.on(channel, (e, payload) => handleStudium(channel, payload, deps))`, but only from the Studium window: check `e.sender === win.webContents`.
  - Use `sendSessions = (s) => win.webContents.send('studium:focus-sessions', s)`.
  - Also call `sendSessions` from `store.onChange` when `focusOutbox` changes and the window has finished loading.
- [ ] **Step 6: Extend `e2e/app.spec.js`:** after launch, `page.evaluate` saves settings with `petInvolvement: 'moderate'` through `localStorage` and dispatches `studium:settings-updated`. Then `app.evaluate(() => globalThis.studiumTest.store.get().petPrefs.involvement)` is `'moderate'`.
- [ ] **Step 7: Run `npm test` and `npm run test:e2e`.** Expected: PASS.
- [ ] **Step 8: Commit** `feat(desktop): preload bridge between Studium and the main process`

---

### Task 5: Tray icon and menu

**Files:**
- Create: `desktop/src/main/tray.js`
- Test: `desktop/test/tray.test.js`
- Modify: `desktop/src/main/main.js`

**Interfaces:**
- Consumes: store, runner, `showStudium`, `paths.trayIcon`.
- Produces:
  - `trayItems({ statuses, away, hidden }) -> Array<{ id: string, label: string } | { type: 'separator' }>` in this order:
    1. `{ id: 'open', label: 'Open Studium' }`
    2. `{ id: 'toggle-pets', label: hidden ? 'Show pets' : 'Hide pets' }`
    3. one `{ id: 'wake:<id>', label: 'Wake <short name>' }` per entry of `L.wakeMenuEntries(away, statuses)`
    4. a separator
    5. `{ id: 'quit', label: 'Quit Studium' }`

    It takes `L` as a first parameter: `trayItems(L, state)`.
  - `trayTooltip(statuses) -> string`: `'Studium'` when `statuses?.pets?.length > 0`, otherwise `'Studium: no pets yet. Create a project to get one.'`
  - `handleTrayClick(id, { store, runner, open, quit })`:
    - `open` → `open()`
    - `toggle-pets` → `store.set({ petHidden: !store.get().petHidden })`
    - `wake:<id>` → `runner.request({ type: 'wake', projectId })`
    - `quit` → `quit()`
  - `createTray({ L, store, runner, open, quit, iconPath }) -> Tray`:
    - Electron wiring: the icon is `nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })`.
    - A left click calls `open()`.
    - The menu is rebuilt from `trayItems` and the tooltip set from `trayTooltip`. Both happen at start and on `store.onChange` when `petAway`, `petStatuses` or `petHidden` changed.
    - Store the click handler on `globalThis.studiumTest.trayClick` and the current items on `globalThis.studiumTest.trayItems` (the e2e tests can't click the tray).

- [ ] **Step 1: Write the failing tests** (`tray.test.js`, real `logic.js`)

- no statuses, nothing away, `hidden: false` → ids `['open', 'toggle-pets', <separator>, 'quit']` and label `'Hide pets'`
- `hidden: true` → `'Show pets'`
- one pet away (statuses `shortName: 'webDev'`) → `{ id: 'wake:webDev', label: 'Wake webDev' }` between toggle and separator
- `trayTooltip(null)` and `trayTooltip({ pets: [] })` → the "no pets yet" text; with one pet → `'Studium'`
- `handleTrayClick('toggle-pets', …)` twice → `petHidden` true then false
- `handleTrayClick('wake:webDev', …)` → runner got `{ type: 'wake', projectId: 'webDev' }`

- [ ] **Step 2: Run `npm test`.** Expected: FAIL.
- [ ] **Step 3: Implement `tray.js`.**
- [ ] **Step 4: Run `npm test`.** Expected: PASS.
- [ ] **Step 5: Wire it in `main.js`.** `open = () => showStudium(win)` and `quit = () => { app.isQuitting = true; app.quit(); }`. On `before-quit`: `runner.dispose()`.
- [ ] **Step 6: Extend the e2e tests:**
  - **tray hides pets:** `studiumTest.trayClick('toggle-pets')`, then `store.get().petHidden === true` and the item label is `'Show pets'`.
  - **tray quits:** `studiumTest.trayClick('quit')` and the app process exits (`app.process()` emits `exit` within 10 s).
  - **tray opens:** close the window (it hides), then `trayClick('open')` shows it again.
- [ ] **Step 7: Run `npm test` and `npm run test:e2e`.** Expected: PASS.
- [ ] **Step 8: Commit** `feat(desktop): tray icon with Open, Show/Hide pets, Wake and Quit`

---

### Task 6: Start with the computer

**Files:**
- Create: `desktop/src/main/loginItem.js`
- Test: `desktop/test/loginItem.test.js`, `web/src/store/settings.test.ts`, `web/src/components/Settings.test.tsx`
- Modify:
  - `web/src/store/settings.ts`: add `startWithComputer: boolean`, default `true`; `parseSettings` returns `o.startWithComputer !== false`
  - `web/src/components/Settings.tsx`
  - `web/src/vite-env.d.ts`: `interface Window { studiumDesktop?: { desktop: true } }`
  - `desktop/src/main/bridge.js`
  - `desktop/src/main/main.js`

**Interfaces:**
- Produces:
  - `loginItemSettings(startWithComputer: boolean, exePath: string) -> { openAtLogin: boolean, path: string, args: string[] }`, with `args: ['--hidden']`.
  - `startWithComputerFrom(raw: string | null) -> boolean`: `false` only when the parsed settings have `startWithComputer === false`. Damaged or missing settings → `true`.
  - `handleStudium` gets a new dependency, `applyLoginItem(on: boolean)`. On `studium:settings` it calls `applyLoginItem(startWithComputerFrom(payload))`.
  - In `main.js`, `applyLoginItem` calls `app.setLoginItemSettings(loginItemSettings(on, process.execPath))` only when `app.isPackaged`.
  - When the app starts with `--hidden`, it does not show the window (Task 1 already handles the flag).

- [ ] **Step 1: Write the failing tests**
  - `loginItem.test.js`:
    - `loginItemSettings(true, 'C:\\S\\Studium.exe')` → `{ openAtLogin: true, path: 'C:\\S\\Studium.exe', args: ['--hidden'] }`, and `false` → `openAtLogin: false`.
    - `startWithComputerFrom` gives `true` for `null`, for `'{'` and for `'{}'`, and `false` for `'{"startWithComputer":false}'`.
  - `bridge.test.js`: settings with `startWithComputer: false` → `applyLoginItem` called with `false`.
  - `settings.test.ts`: the default is `true`; old saved settings without the field → `true`; a saved `false` → `false`.
  - `Settings.test.tsx`:
    - With `window.studiumDesktop = { desktop: true }`, a checkbox labelled "Start Studium when your computer starts" is checked. Clicking it saves `startWithComputer: false`.
    - Without `studiumDesktop`, there's no such checkbox.
- [ ] **Step 2: Run the tests.** Run `npm test` in `desktop/` and `npx vitest run --maxWorkers=4 src/store/settings.test.ts src/components/Settings.test.tsx` in `web/`. Expected: FAIL.
- [ ] **Step 3: Implement it.**
  - The checkbox goes at the end of the Settings card, after "How much pets interact".
  - Its hint reads: "Your pets are there as soon as you log in. Studium stays in the tray by the clock until you open it."
  - Put both the label and the hint in `web/src/ui/format.ts`, next to the other Settings copy.
- [ ] **Step 4: Run the same tests.** Expected: PASS. Then run the whole `web/` suite and `npm run build` in `web/`.
- [ ] **Step 5: Commit** `feat: Start with computer setting for the desktop app`

---

### Task 7: Windows installer and docs

**Files:**
- Create: `desktop/electron-builder.yml`
- Modify: `desktop/package.json` (script `"dist": "npm --prefix ../web run build && electron-builder --win nsis"`), `README.md`, `HANDOFF.md`

**Interfaces:**
- `electron-builder.yml`:
  - Settings: `appId: edu.smu.studium`, `productName: Studium`, `directories.output: release`, `files: [src/**, package.json]`.
  - `extraResources`:
    - `{ from: ../web/dist, to: web }`
    - `{ from: ../extension/content/logic.js, to: extension/logic.js }`

    These are the paths `resolvePaths` expects when packaged (Task 1).
  - `nsis`:
    - `oneClick: false`, `perMachine: false`, `allowToChangeInstallationDirectory: true`
    - `createDesktopShortcut: true`, `runAfterFinish: true`
  - No `icon` this week. electron-builder uses Electron's default icon; a real icon comes with the README install section in Week 4.

- [ ] **Step 1: Write `electron-builder.yml` and the `dist` script.**
- [ ] **Step 2: Build the installer.** Run `npm run dist` in `desktop/`. Expected: `desktop/release/Studium Setup 0.4.0.exe` exists.
- [ ] **Step 3: Smoke-test the unpacked build.** Launch `desktop/release/win-unpacked/Studium.exe` with Playwright: in `e2e/packaged.spec.js`, skipped unless `STUDIUM_PACKAGED=1` is set, use `_electron.launch({ executablePath })` with a temp `--user-data`. Expected: the "What do you make?" heading. This proves the `extraResources` paths and the `studium://` scheme work when packaged.
- [ ] **Step 4: Update the docs.**
  - `README.md`: add a short "Desktop app (in progress)" section covering:
    - `cd desktop && npm install`
    - `npm start` (built Studium)
    - `npm run dev` with `web/`'s `npm run dev` running. Dev mode uses `localhost:5173`, so its Studium data is separate from the built app's.
    - `npm test`
    - `npm run test:e2e`
    - `npm run dist`, which puts the installer in `desktop/release/`
  - Note that `desktop/node_modules` holds the Electron binary. Like `web/node_modules`, it's best kept out of OneDrive sync.
  - Leave the extension's instructions in place; the switch-over wording comes when pets move (Week 2).
  - `HANDOFF.md`: record Week 1 as done and Week 2 (pets in the overlay) as next. List the by-hand checks from Step 5.
- [ ] **Step 5: By hand on the user's PC (the user does this, not the agent)**

  Install from `Studium Setup 0.4.0.exe`, clicking "More info → Run anyway". Then check that:
  1. Studium opens.
  2. Closing the window leaves the tray icon.
  3. Tray → Open Studium brings it back.
  4. After a restart of the PC, Studium is in the tray with the window hidden.
  5. Turning off "Start Studium when your computer starts" means the next restart doesn't open it.
  6. Tray → Quit ends the app.
- [ ] **Step 6: Run everything.** Run `npm test` and `npm run test:e2e` in `desktop/`, and `npx vitest run --maxWorkers=4` and `npm run build` in `web/`. Expected: all pass.
- [ ] **Step 7: Commit** `build(desktop): Windows installer; docs for running the desktop app`

# Desktop App, Week 2: Pets on the Desktop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hatched pets roam the whole primary screen on top of every app, in a transparent overlay that lets clicks through except on a pet, its menu or its bubbles. Everything the extension's pets did keeps working: drag/throw/click, moods, the right-click menu (What should I work on?, Nap, Sleep, Open project), naps, sleep, check-ins and celebrations. A project page in the Studium window shows that pet in its habitat (with its furniture) while the overlay hides it.

**Architecture:** The extension's pet code (`extension/content/pet.js`, `menu.js`, `logic.js`) runs unchanged in spirit in two new places: the **overlay** window (`studium://overlay/`) and the **Studium window**, where the main process injects it in a habitat-only mode. `pet.js` learns one new input, `globalThis.PetSurface` (`'page'` = the extension, the default, behaviour unchanged; `'overlay'`; `'habitat'`), and the "who shows where" rule moves into one pure function, `PetLogic.shownPets`. Its `chrome.*` calls go to a small stand-in, `chromeShim.js`, which talks to the main process through a session-wide preload (`petBridge.js`). The main process answers from the Week 1 store, runs nap/sleep/check-in requests through the Week 1 away runner, and tells the overlay which project's habitat is showing (`petHabitat`, live state that is never saved).

**Tech Stack:** Electron 45 (`setIgnoreMouseEvents(…, { forward: true })`, `session.registerPreloadScript`), Vitest 5 (`desktop/` and `web/`), Playwright 1.64 `_electron`, Node 24. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-28-desktop-app-design.md` (Week 2 in "Order of work"). Week 1's plan, `docs/superpowers/plans/2026-10-29-desktop-week1-shell.md`, built the pieces this one reuses.

## Global Constraints

- Branch `feature/desktop-week2-overlay`, cut from `main` at `f82f6b0` (Week 1 and the blocking round are merged there).
- The extension keeps working exactly as before: `PetSurface` missing means `'page'`, and every existing `web/src/extension/*Script.test.ts` passes unchanged.
- Pets stay on the primary display. The overlay covers `screen.getPrimaryDisplay().workArea`, so pets walk on top of the taskbar, not behind it.
- The overlay never takes keyboard focus (`focusable: false`, shown with `showInactive()`). Only "Open project" and the tray's Open Studium show and focus the Studium window.
- Click-through: the overlay ignores the mouse (`setIgnoreMouseEvents(true, { forward: true })`) except while the pointer is over something inside the pet host's shadow root, while a pet menu is open, or while a button is held after pressing on a pet (a drag).
- A hidden or minimized Studium window doesn't count as a project page showing: its pet stays on the desktop.
- Each window may only do its own job. The overlay may write `pets` (positions) and `petNoteAt` and send nap/sleep/wake/checkIn/openProject. The Studium window's injected pet code may send the same requests plus `habitat`, and writes nothing (Studium's statuses and settings still arrive through Week 1's `studium.js` preload). Nobody else is heard.
- Both windows: `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`.
- Sticky notes run in the overlay as they do in a tab, but stay until closed. The 15-minute limit, the carried-in note and the other mischief are Week 3.
- Tests first. At the end of every task: `npm test` in `desktop/` and `npx vitest run --maxWorkers=4` in `web/` pass. From Task 5 on, `npm run test:e2e` in `desktop/` passes too (unset `ELECTRON_RUN_AS_NODE` if Electron exits at once; `e2e/launch.js` already does).
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **The overlay keeps the mouse after the pet is gone** (pets hidden from the tray while the pointer rests on one, a pet rebuilt or put to sleep under a still pointer, the menu closed by picking an item): the desktop underneath must become clickable again without the user having to move the mouse. `mouse.js` re-checks every `MOUSE_RECHECK_MS` (250), not only on mouse moves. (Pinned in Task 5: gate test, and the e2e hide-while-hovering check.)
2. **The Studium window is minimized, closed to the tray, or reloaded while a project page is open:** the habitat pet must come back to the desktop at once, and go back into its habitat when the window is restored. (Pinned in Task 3: tracker tests; Task 6: e2e close/restore.)
3. **A message from the wrong window, or a forged one:** the overlay can't send `delivered` or `habitat`, nobody can write `petStatuses`/`petAway`/`petCheckIn` through `pets:set`, and the Studium window can't overwrite the overlay's saved positions with stale ones. (Pinned in Task 3.)
4. **The work area changes** (taskbar moved or auto-hidden, resolution or scale changed): the overlay follows the new work area and pets are clamped back onto it, never stuck off-screen or behind the taskbar. (Pinned in Task 5: `overlayBounds` test and the `display-metrics-changed` wiring.)
5. **The habitat pet and its desktop copy at the same time:** a pet must never show in both places, and a celebration or check-in for it plays once, where it is shown. (Pinned in Task 1: `shownPets` overlay/habitat tests; Task 6: e2e.)

---

### Task 1: Pet code knows where it runs

**Files:**
- Modify: `extension/content/logic.js` (add `PET_SURFACES`, `cleanSurface`, `shownPets`; export them on `PetLogic`)
- Modify: `extension/content/pet.js` (surface, live habitat, habitat report, no saving in the habitat)
- Test: `web/src/extension/petLogic.test.ts` (new `describe("shownPets")`)
- Create: `web/src/extension/petOverlayScript.test.ts`, `web/src/extension/petHabitatScript.test.ts`

**Interfaces:**
- Produces (on `globalThis.PetLogic`):
  - `PET_SURFACES = ['page', 'overlay', 'habitat']`
  - `cleanSurface(v: unknown) -> 'page' | 'overlay' | 'habitat'` (anything else → `'page'`)
  - `shownPets({ surface, pets, petAway, screen, boxId, liveHabitat }) -> Set<string>`; `pets` is the status list in project order (`{ projectId, deadline? }[]`), `boxId` the `data-pet-habitat` id on the page or `null`, `liveHabitat` the project whose habitat shows in the Studium window or `null`:
    - `'page'`: `boxId` set → `{boxId}` if that pet exists (asleep or not); otherwise `petsOnScreen(pets, petAway, screen)`. (Today's rule.)
    - `'habitat'`: `{boxId}` if that pet exists, else empty.
    - `'overlay'`: `petsOnScreen(pets without liveHabitat, petAway, screen)`; `boxId` is ignored. Leaving out the habitat pet first lets the next pet fill its slot.
- Produces (pet.js behaviour other tasks rely on):
  - Reads `petHabitat` (string or anything else → `null`) with the other keys in `load()` and from `storage.onChanged`, and re-applies who shows.
  - With `PetSurface === 'habitat'`, sends `{ type: 'habitat', projectId: string | null }` through `chrome.runtime.sendMessage` each time the page's habitat box changes.

- [ ] **Step 1: Create the branch**

Run: `git switch -c feature/desktop-week2-overlay main`

- [ ] **Step 2: Write the failing `shownPets` tests** in `petLogic.test.ts`, using its `pet()` helper:

```ts
describe("shownPets", () => {
  const pets = [pet({ projectId: "a" }), pet({ projectId: "b" }), pet({ projectId: "c" })];
  const one = { limit: 1, order: "project" };
  const ids = (s: Set<string>) => [...s].sort();
  const base = { pets, petAway: {}, screen: null, boxId: null, liveHabitat: null };

  it("page without a box: the pets-on-screen rule", () => {
    expect(ids(L.shownPets({ ...base, surface: "page", screen: one }))).toEqual(["a"]);
  });
  it("page with a box: only the box's pet, even asleep", () => {
    const away = { b: { kind: "nap", until: Date.now() + 60000 } };
    expect(ids(L.shownPets({ ...base, surface: "page", boxId: "b", petAway: away }))).toEqual(["b"]);
  });
  it("habitat: nothing without a box, the box's pet with one", () => {
    expect(ids(L.shownPets({ ...base, surface: "habitat" }))).toEqual([]);
    expect(ids(L.shownPets({ ...base, surface: "habitat", boxId: "c" }))).toEqual(["c"]);
    expect(ids(L.shownPets({ ...base, surface: "habitat", boxId: "zzz" }))).toEqual([]);
  });
  it("overlay: leaves out the pet in the Studium habitat, and the next pet takes its slot", () => {
    expect(ids(L.shownPets({ ...base, surface: "overlay", liveHabitat: "a", screen: one }))).toEqual(["b"]);
    expect(ids(L.shownPets({ ...base, surface: "overlay", liveHabitat: "a" }))).toEqual(["b", "c"]);
  });
  it("overlay: away pets are hidden and a page box is ignored", () => {
    const away = { b: { kind: "sleep", until: Date.now() + 60000 } };
    expect(ids(L.shownPets({ ...base, surface: "overlay", petAway: away, boxId: "b" }))).toEqual(["a", "c"]);
  });
});

describe("cleanSurface", () => {
  it("keeps the three surfaces and treats anything else as a page", () => {
    for (const s of ["page", "overlay", "habitat"]) expect(L.cleanSurface(s)).toBe(s);
    for (const s of [undefined, null, "Overlay", 3]) expect(L.cleanSurface(s)).toBe("page");
  });
});
```

- [ ] **Step 3: Run them and see them fail**

Run (in `web/`): `npx vitest run src/extension/petLogic.test.ts`
Expected: FAIL, `L.shownPets is not a function`.

- [ ] **Step 4: Implement `PET_SURFACES`, `cleanSurface` and `shownPets` in `logic.js`**, next to `petsOnScreen`, reusing it. Add them to the `globalThis.PetLogic` object.

- [ ] **Step 5: Run `petLogic.test.ts` again.** Expected: PASS.

- [ ] **Step 6: Write the failing overlay script test** `petOverlayScript.test.ts`. Copy the fake `chrome` from `petLimitScript.test.ts` (store, listeners, `set` that notifies), with a `sets: Record<string, unknown>[]` log of every `set` call, and `@vitest-environment-options {"url":"http://overlay.test/"}`.

`it("shows every pet except the one in the Studium habitat, and never copies Studium's data")`:
- Store: `petStatuses` with pets `a` and `b` (cats, Happy), `petHabitat: "a"`. `localStorage` also has `studium-pets-v1` with a different list (`z`) and `studium-settings-v1`, to prove the overlay ignores them.
- `globalThis.PetSurface = "overlay"`, then import `pet.js` and wait one tick.
- Expect the shown pets (same `shownPets()` helper as `petLimitScript.test.ts`) to be index `[1]` (b).
- `await chrome.storage.local.set({ petHabitat: null })`, wait one tick → shown `[0, 1]`.
- Expect no entry in `sets` to have the key `petStatuses`, `petScreen` or `petPrefs`.

- [ ] **Step 7: Write the failing habitat script test** `petHabitatScript.test.ts`, with `@vitest-environment-options {"url":"http://localhost:5173/"}` (the dev Studium address, the case where `isStudiumUrl` is true) and a `messages: unknown[]` log in the fake `sendMessage`.

`it("shows only the pet whose habitat box is on the page, reports the box, and saves nothing")`:
- Store: `petStatuses` with `a` and `b`, no `petHabitat`. `localStorage` has `studium-pets-v1` (so a `'page'` copy would write it).
- `globalThis.PetSurface = "habitat"`, import `pet.js`, wait one tick → shown `[]`.
- Append `<div data-pet-habitat="b">` to `document.body`, wait one tick → shown `[1]`, `messages` ends with `{ type: "habitat", projectId: "b" }`, and the box has the attribute `data-pet-attached`.
- Remove the box, wait one tick → shown `[]`, `messages` ends with `{ type: "habitat", projectId: null }`.
- Dispatch `visibilitychange` and `pagehide` on `document`/`window` (which save in a tab) → `sets` is still empty (no `pets`, no `petStatuses`).

- [ ] **Step 8: Run both and see them fail**

Run: `npx vitest run src/extension/petOverlayScript.test.ts src/extension/petHabitatScript.test.ts`
Expected: FAIL. The overlay test shows both pets. The habitat test copies `petStatuses` and shows pets with no box.

- [ ] **Step 9: Change `pet.js`**
  - Near `const L = …`: `const SURFACE = L.cleanSurface(globalThis.PetSurface);`
  - `const onStudium = SURFACE === 'habitat' || (SURFACE === 'page' && L.isStudiumUrl(location.href));`. The copy-from-Studium block (`copyStatusesFromStudium` / `copySettingsFromStudium` listeners and first calls) runs only when `SURFACE === 'page' && onStudium`. The habitat `MutationObserver` keeps using `onStudium`, so it runs in a tab on Studium and in the habitat surface, never in the overlay. `chooseNote` keeps getting `onStudium`, so the habitat surface leaves no notes.
  - `let liveHabitat = null;` Add `'petHabitat'` to the keys `load()` reads, and set it there and in the `storage.onChanged` listener with `typeof v === 'string' && v ? v : null`. A change re-runs `applyHabitat()`.
  - `applyHabitat()`: `const shown = L.shownPets({ surface: SURFACE, pets: pets.map((pet) => statusOf(pet.id) ?? { projectId: pet.id }), petAway: away, screen: petScreen, boxId: habitatEl?.dataset.petHabitat ?? null, liveHabitat });` then `pet.setShown(shown.has(pet.id))`. Entering and leaving the box stays as it is.
  - `save()` returns at once when `SURFACE === 'habitat'`.
  - `checkHabitat()`: after `habitatEl = el;`, when `SURFACE === 'habitat'`, `send({ type: 'habitat', projectId: el?.dataset.petHabitat ?? null })`.
  - Update the header comment: one paragraph on the three surfaces.

- [ ] **Step 10: Run the whole web suite**

Run: `npx vitest run --maxWorkers=4`, then `npm run build`
Expected: every test passes, including the existing `petScript`, `petLimitScript`, `petNotesScript`, `petPrefsScript`, `petChatterScript`, `petAwayBed` and `bridge` tests. The build is clean.

- [ ] **Step 11: Commit**

```bash
git add extension/content/logic.js extension/content/pet.js web/src/extension/petLogic.test.ts web/src/extension/petOverlayScript.test.ts web/src/extension/petHabitatScript.test.ts
git commit -m "feat(pets): pet code runs in the desktop overlay or a Studium habitat"
```

---

### Task 2: Serving the pet files and the overlay page

**Files:**
- Modify: `desktop/src/main/protocol.js`, `desktop/src/main/paths.js`, `desktop/electron-builder.yml`, `desktop/src/main/main.js` (pass roots)
- Test: `desktop/test/protocol.test.js`, `desktop/test/paths.test.js`

**Interfaces:**
- Produces:
  - `paths.js`: `resolvePaths(…)` also returns `petsRoot` and `overlayDir`. Not packaged: `<repo>/extension` and `<desktopDir>/src/overlay`. Packaged: `<resourcesPath>/extension` and `<resourcesPath>/overlay`. `logicJs` becomes `<petsRoot>/content/logic.js` in both.
  - `protocol.js`: `fileForRequest(url: string, roots: { app: string, pets: string, overlay: string }) -> string | null`. Host `app`: today's behaviour (anything unusable → `index.html`). Hosts `pets` and `overlay`: a file inside that root with an extension, else `null`. Any other host → `null`.
  - `protocol.js`: `handleStudiumScheme(roots)` answers `null` with `new Response('Not found', { status: 404 })`.
  - URLs other tasks use: `studium://overlay/index.html`, `studium://overlay/<file>`, `studium://pets/content/<script>.js`, `studium://pets/assets/pets/<kind>.png`.

- [ ] **Step 1: Update the tests.** In `protocol.test.js`, call `fileForRequest(url, roots)` with `roots = { app: dist, pets: path.resolve('/r/extension'), overlay: path.resolve('/r/desktop/src/overlay') }` in every existing case (expected results unchanged), and add:

```js
it('serves pet art and scripts from the pets root', () => {
  expect(fileForRequest('studium://pets/assets/pets/cat.png', roots)).toBe(path.join(roots.pets, 'assets', 'pets', 'cat.png'));
  expect(fileForRequest('studium://pets/content/pet.js', roots)).toBe(path.join(roots.pets, 'content', 'pet.js'));
});
it('serves the overlay page', () => {
  expect(fileForRequest('studium://overlay/index.html', roots)).toBe(path.join(roots.overlay, 'index.html'));
});
it('gives nothing outside pets/overlay, for folders, or for unknown hosts', () => {
  expect(fileForRequest('studium://pets/..%5c..%5csecret.txt', roots)).toBeNull();
  expect(fileForRequest('studium://pets/content', roots)).toBeNull();
  expect(fileForRequest('studium://overlay/', roots)).toBeNull();
  expect(fileForRequest('studium://other/x.js', roots)).toBeNull();
});
```

In `paths.test.js`, expect the new `petsRoot`/`overlayDir` and the moved packaged `logicJs` (`<res>/extension/content/logic.js`).

- [ ] **Step 2: Run them and see them fail.** Run (in `desktop/`): `npx vitest run test/protocol.test.js test/paths.test.js`. Expected: FAIL.

- [ ] **Step 3: Implement** the new `fileForRequest`, `handleStudiumScheme(roots)` and `resolvePaths`. In `main.js`, call `handleStudiumScheme({ app: paths.webDist, pets: paths.petsRoot, overlay: paths.overlayDir })`.

- [ ] **Step 4: Update `electron-builder.yml` `extraResources`.** Replace the single `logic.js` entry with:

```yaml
  - from: ../extension/content
    to: extension/content
    filter: ['*.js']
  - from: ../extension/assets/pets
    to: extension/assets/pets
  - from: src/overlay
    to: overlay
```

Create `desktop/src/overlay/` with a placeholder `index.html` (`<!doctype html><title>Studium pets</title>`), so the folder exists. Task 5 fills it in.

- [ ] **Step 5: Run the desktop tests and the existing e2e.** Run: `npm test`, then `npm run test:e2e`. Expected: all pass. Studium still loads on `studium://app/`, and the main process still loads `logic.js` from its new path.

- [ ] **Step 6: Commit**

```bash
git add desktop/src/main/protocol.js desktop/src/main/paths.js desktop/src/main/main.js desktop/electron-builder.yml desktop/src/overlay/index.html desktop/test/protocol.test.js desktop/test/paths.test.js
git commit -m "feat(desktop): serve pet code, pet art and the overlay page on studium://"
```

---

### Task 3: The main process answers the pets

**Files:**
- Create: `desktop/src/main/petChannel.js`, `desktop/src/main/habitat.js` (both pure: no `electron`)
- Test: `desktop/test/petChannel.test.js`, `desktop/test/habitat.test.js`

**Interfaces:**
- Consumes: the Week 1 store (`get()`, `set(patch)`, `onChange(fn(keys, state))`) and away runner (`request(req)`); `L.parseRequest`, `L.parsePositions`.
- Produces (`petChannel.js`):
  - `READABLE_KEYS = ['pets', 'petHidden', 'petStatuses', 'petAway', 'petCheckIn', 'petScreen', 'petPrefs', 'petNoteAt', 'petHabitat']`
  - `readPetState(state: object, keys: string | string[] | null | undefined, petHabitat: string | null) -> object`: the asked-for readable keys (all of them when `keys` is null or undefined) that have a value. `petHabitat` comes from the argument, never from `state`.
  - `cleanPetWrite(patch: unknown, L) -> object`: only `pets` (through `L.parsePositions`) and `petNoteAt` (a finite number ≥ 0). Everything else is dropped. A non-object gives `{}`.
  - `changesFor(keys: string[], state: object) -> { [key]: { newValue } }` for the readable keys among `keys`.
  - `handlePetMessage(msg: unknown, from: 'overlay' | 'studium', { L, runner, open, reportHabitat }) -> void`:
    - `{ type: 'habitat' }` from `'studium'` → `reportHabitat(projectId)` when `projectId` is a non-empty string, otherwise `reportHabitat(null)`. From the overlay it's ignored.
    - Otherwise `L.parseRequest(msg)`. `null` or `delivered` → ignored. `openProject` → `open('project=' + encodeURIComponent(projectId))`. Anything else → `runner.request(request)`.
- Produces (`habitat.js`): `createHabitatTracker(onChange: (projectId: string | null) => void) -> { report(projectId: string | null), setWindow({ visible: boolean, minimized: boolean }), reset(), get(): string | null }`. `get()` is the reported id only while the window is visible and not minimized, else `null`. `reset()` forgets the report (page reloaded or crashed). `onChange` fires only when `get()`'s value changes. It starts with no report and the window hidden.

- [ ] **Step 1: Write the failing tests**

`habitat.test.js`:
- `report('a')` with the window hidden → `get()` is `null` and `onChange` isn't called.
- `setWindow({ visible: true, minimized: false })` → `get()` is `'a'` and `onChange` gets `'a'` once.
- Minimizing gives `null`, restoring gives `'a'`, hiding gives `null`. Each fires `onChange` once.
- `reset()` while showing → `null`, and a later `setWindow` visible stays `null` until the next `report`.
- Repeating `report('a')` while it's already `'a'` doesn't call `onChange`.

`petChannel.test.js` (load `extension/content/logic.js` with `require` to get `globalThis.PetLogic`, like `away.test.js`):
- `readPetState({ pets: {…}, petStatuses: {…}, secret: 1 }, ['pets', 'secret'], 'p1')` → `{ pets: {…} }`. With `null` keys → every readable key present, plus `petHabitat: 'p1'`. With the string `'petHabitat'` → `{ petHabitat: 'p1' }`.
- `cleanPetWrite({ pets: { a: { xRatio: 0.5 } }, petNoteAt: 5, petStatuses: {}, petAway: {}, petCheckIn: {} }, L)` → `{ pets: { a: { xRatio: 0.5 } }, petNoteAt: 5 }`. Also `cleanPetWrite({ petNoteAt: NaN }, L)` → `{}`, and `cleanPetWrite('x', L)` → `{}`.
- `changesFor(['petAway', 'focusOutbox'], { petAway: { a: 1 }, focusOutbox: {} })` → `{ petAway: { newValue: { a: 1 } } }`.
- `handlePetMessage`, with spies for `runner.request`, `open` and `reportHabitat`:
  - `{ type: 'nap', projectId: 'a' }` from either window → `runner.request({ type: 'nap', projectId: 'a' })`.
  - `{ type: 'openProject', projectId: 'a b' }` → `open('project=a%20b')` and no runner call.
  - `{ type: 'delivered', ids: ['x'] }` from either window → nothing called.
  - `{ type: 'habitat', projectId: 'a' }` from `'studium'` → `reportHabitat('a')`. `{ type: 'habitat' }` → `reportHabitat(null)`. From `'overlay'` → nothing.
  - Garbage (`null`, `{ type: 'sleep', projectId: 'a', hours: 3 }`) → nothing.

- [ ] **Step 2: Run them and see them fail.** Run: `npx vitest run test/petChannel.test.js test/habitat.test.js`. Expected: FAIL, the modules don't exist.

- [ ] **Step 3: Implement `petChannel.js` and `habitat.js`.**

- [ ] **Step 4: Run `npm test`.** Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add desktop/src/main/petChannel.js desktop/src/main/habitat.js desktop/test/petChannel.test.js desktop/test/habitat.test.js
git commit -m "feat(desktop): rules for what pet windows may read, write and ask"
```

---

### Task 4: The bridge and the `chrome` stand-in

**Files:**
- Create: `desktop/src/preload/petBridge.js` (session-wide preload), `desktop/src/overlay/chromeShim.js` (page script)
- Test: `desktop/test/petBridge.test.js`, `desktop/test/chromeShim.test.js`

**Interfaces:**
- Produces (`petBridge.js`): `installPetBridge({ ipc, expose })`, where `expose(name, api)` is `contextBridge.exposeInMainWorld` in Electron. It exposes `petBridge`:
  - `get(keys)` → `ipc.invoke('pets:get', keys)` (a Promise)
  - `set(patch)` → `ipc.send('pets:set', patch)`
  - `send(msg)` → `ipc.send('pets:message', msg)`
  - `onChanged(fn)` → `ipc.on('pets:changed', (_e, changes) => fn(changes))`
  - `setMouse(wants)` → `ipc.send('overlay:mouse', wants === true)`

  At the bottom, guarded like `studium.js`: when `process.type === 'renderer'`, call it with `require('electron')`'s `ipcRenderer` and `contextBridge.exposeInMainWorld`. Channel names: `pets:get`, `pets:set`, `pets:message`, `pets:changed`, `overlay:mouse`.
- Produces (`chromeShim.js`): `makeChrome(bridge) -> chrome-like object`:
  - `runtime.id = 'studium-desktop'`
  - `runtime.getURL(p) = 'studium://pets/' + p` without leading slashes
  - `runtime.sendMessage(msg)` → `bridge.send(msg)`, resolves `undefined`
  - `storage.local.get(keys)` → `bridge.get(keys)`
  - `storage.local.set(patch)` → `bridge.set(patch)`, resolves `undefined`
  - `storage.onChanged.addListener(fn)` → `bridge.onChanged((c) => fn(c, 'local'))`

  When `globalThis.petBridge` exists, it installs the result with `Object.defineProperty(globalThis, 'chrome', { value, configurable: true, writable: true })`, so it works even if the page already has a `chrome` object. `module.exports = { makeChrome }` behind `typeof module !== 'undefined'`.

- [ ] **Step 1: Write the failing tests**

`petBridge.test.js`, with a fake `ipc` that records `send`/`invoke` calls and keeps `on` handlers, and a fake `expose` that captures the API:
- `get(['pets'])` calls `invoke('pets:get', ['pets'])` and returns its promise.
- `set`, `send` and `setMouse` send on the named channels. `setMouse('yes')` sends `false`.
- An `onChanged` listener gets the `changes` object when the fake fires `pets:changed`.

`chromeShim.test.js`, with a fake bridge:
- `getURL('assets/pets/cat.png')` and `getURL('/assets/pets/cat.png')` both give `'studium://pets/assets/pets/cat.png'`.
- `storage.local.get(['pets'])` resolves to what `bridge.get` resolved.
- `set` and `sendMessage` resolve `undefined` and pass their argument on.
- An `onChanged` listener is called with `(changes, 'local')`.
- `runtime.id` is truthy (pet.js stops without it).

- [ ] **Step 2: Run them and see them fail.** Run: `npx vitest run test/petBridge.test.js test/chromeShim.test.js`. Expected: FAIL.

- [ ] **Step 3: Implement both files.** Header comments: `petBridge.js` runs in every window of the default session (Task 5 registers it), and the main process decides per window what it accepts. `chromeShim.js` gives `pet.js` the few `chrome.*` calls it makes.

- [ ] **Step 4: Run `npm test`.** Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add desktop/src/preload/petBridge.js desktop/src/overlay/chromeShim.js desktop/test/petBridge.test.js desktop/test/chromeShim.test.js
git commit -m "feat(desktop): bridge and chrome stand-in so the pet code can run in Electron"
```

---

### Task 5: The pet overlay

**Files:**
- Create: `desktop/src/main/overlayWindow.js`, `desktop/src/overlay/mouse.js`
- Modify: `desktop/src/overlay/index.html` (the real page), `desktop/src/main/main.js` (wiring)
- Test: `desktop/test/overlayWindow.test.js`, `desktop/test/mouse.test.js`, `desktop/e2e/overlay.spec.js`, `desktop/e2e/launch.js` (helpers)

**Interfaces:**
- Consumes: Task 2's URLs and roots, Task 3's `petChannel`/`habitat`, Task 4's bridge.
- Produces (`overlayWindow.js`):
  - `overlayBounds(workArea) -> { x, y, width, height }` (copies the four numbers)
  - `overlayOptions(workArea) -> object`: the bounds, plus `transparent: true`, `frame: false`, `resizable: false`, `movable: false`, `minimizable: false`, `maximizable: false`, `focusable: false`, `skipTaskbar: true`, `alwaysOnTop: true`, `hasShadow: false`, `show: false`, and `webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false, backgroundThrottling: false }`
  - `createOverlayWindow({ url, screen }) -> BrowserWindow`: starts with `setIgnoreMouseEvents(true, { forward: true })` and calls `showInactive()` on `ready-to-show`. On `screen` `display-metrics-changed`, `display-added` and `display-removed`, it `setBounds(overlayBounds(screen.getPrimaryDisplay().workArea))`. It blocks `will-navigate`, denies new windows, and reloads on `render-process-gone`.
  - `setOverlayMouse(win, wants: boolean)`: `win.setIgnoreMouseEvents(!wants, { forward: true })`
- Produces (`mouse.js`, a page script with `module.exports` behind a guard):
  - `MOUSE_RECHECK_MS = 250`
  - `wantsMouse({ overPet, menuOpen, pressing }) -> boolean`: true if any of the three is true
  - `createMouseGate(send) -> { update(wants: boolean) }`: starts at `false` and calls `send` only when the value changes
  - Page wiring (when `globalThis.petBridge` exists):
    - Remember the last pointer position from `mousemove`/`pointermove`.
    - `pressing` is true from a `pointerdown` that `overPet` until `pointerup` or `pointercancel`. Use capture listeners on `window`.
    - `overPet`: `host = document.getElementById('capstone-pet-host')`, `hit = host?.shadowRoot?.elementFromPoint(x, y)`, true when `hit` is inside `host.shadowRoot`.
    - `menuOpen`: `globalThis.PetMenu?.isOpen() === true`.
    - Re-check on every move and every `MOUSE_RECHECK_MS`. The gate sends through `petBridge.setMouse`.
- Produces (main wiring and e2e hooks): `globalThis.studiumTest` gains `overlay` (the window), `habitat` (the tracker) and `overlayMouse()` (the last value `overlay:mouse` set).

- [ ] **Step 1: Write the failing unit tests**

`overlayWindow.test.js`:
- `overlayBounds({ x: 0, y: 0, width: 1920, height: 1040 })` gives those four numbers.
- `overlayOptions(...)` has `focusable: false`, `transparent: true`, `alwaysOnTop: true`, `skipTaskbar: true`, `show: false`, the bounds, and the four `webPreferences` values above.

`mouse.test.js`:
- `wantsMouse` is true for each single flag and false for none.
- `createMouseGate(send)`: `update(false)` sends nothing. `update(true)` sends `true` once, and repeating it sends nothing. `update(false)` sends `false`.

- [ ] **Step 2: Run them and see them fail**, then **implement `overlayWindow.js` and `mouse.js`**, then **run `npm test`.** Expected: PASS.

- [ ] **Step 3: Write `desktop/src/overlay/index.html`**: transparent page, scripts in this order:

```html
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Studium pets</title>
  <style>html, body { margin: 0; background: transparent; overflow: hidden; }</style>
</head>
<body>
  <script src="chromeShim.js"></script>
  <script src="studium://pets/content/logic.js"></script>
  <script src="studium://pets/content/menu.js"></script>
  <script>globalThis.PetSurface = 'overlay';</script>
  <script src="studium://pets/content/pet.js"></script>
  <script src="mouse.js"></script>
</body>
</html>
```

- [ ] **Step 4: Wire it up in `main.js`** (keep `main.js` to wiring only):
  - Before any window: `session.defaultSession.registerPreloadScript({ type: 'frame', id: 'studium-pet-bridge', filePath: path.join(__dirname, '..', 'preload', 'petBridge.js') })`.
  - `const habitat = createHabitatTracker((id) => broadcast({ petHabitat: { newValue: id } }));` where `broadcast(changes)` sends `pets:changed` to the overlay and the Studium window when they exist, aren't destroyed and aren't loading.
  - `store.onChange((keys, state) => { const c = changesFor(keys, state); if (Object.keys(c).length) broadcast(c); })`.
  - `from(event)`:
    - `'overlay'` when `event.sender === overlay.webContents` and the frame URL starts with `studium://overlay/`;
    - `'studium'` when it's the Studium window's `webContents` and `isStudiumPage(url, args.dev)`;
    - else `null`.
  - `ipcMain.handle('pets:get', (e, keys) => from(e) ? readPetState(store.get(), keys, habitat.get()) : {})`.
  - `pets:set`: overlay only, `store.set(cleanPetWrite(patch, L))`.
  - `pets:message`: when `from(e)` is not null, `handlePetMessage(msg, from(e), { L, runner, open: (hash) => showStudium(win, hash), reportHabitat: habitat.report })`.
  - `overlay:mouse`: overlay only, `setOverlayMouse(overlay, wants === true)`, and remember the value for `studiumTest.overlayMouse()`.
  - Create the overlay after the Studium window: `createOverlayWindow({ url: 'studium://overlay/index.html', screen })`.

- [ ] **Step 5: Add e2e helpers to `launch.js`**
  - `overlayPage(app)`: polls `app.windows()` for the page whose URL starts with `studium://overlay/`.
  - `seedPets(app, page, pets)`: waits for the Studium page's `load`, waits until the store has `petStatuses` (Studium publishes its own, empty list for a new user), then `app.evaluate` sets `globalThis.studiumTest.store.set({ petStatuses: { updatedAt: new Date().toISOString(), pets } })`.
  - `testPet(id, o)`: an adult, Happy cat status like `petLimitScript.test.ts`'s `pet()`.
  - A comment notes that Studium republishes statuses on its once-a-minute refresh, so these tests stay short.

- [ ] **Step 6: Write the failing e2e** `desktop/e2e/overlay.spec.js`, one app per test, each seeded with `testPet('p1')`. `pet = overlay.locator('#capstone-pet-host .pet')` (Playwright CSS reaches into open shadow roots).
  1. **"the overlay covers the work area, on top, without focus"**: compare in `app.evaluate`: `getBounds()` equals `screen.getPrimaryDisplay().workArea`, `isFocusable()` is false, `isAlwaysOnTop()` is true.
  2. **"a pet walks in the overlay, and stays after Studium is closed"**: `pet` is visible. Closing the Studium window (`studiumTest` or `BrowserWindow`) leaves it visible.
  3. **"clicks pass through except on a pet"**: `overlayMouse()` is false. `overlay.mouse.move` to the pet's centre → polls to true. Move to `(5, 5)` → false. Move back on the pet, then `trayClick('toggle-pets')` without moving the mouse → polls to false (Review Focus 1).
  4. **"right-click → Open project opens its page"**: `pet.click({ button: 'right' })`, then `overlay.getByRole('menuitem', { name: 'Open project' }).click()` → the Studium window is visible and its page URL ends with `#project=p1`.
  5. **"Nap from the menu, Wake from the tray, then the check-in"**: right-click → `Nap`. `store.get().petAway.p1` exists and `pet` is hidden. Then `trayClick('wake:p1')` → `pet` is visible with a `.talk.show` bubble. Click its first button → `store.get().petCheckIn` polls to falsy.
  6. **"Show/Hide pets from the tray"**: `trayClick('toggle-pets')` → `#capstone-pet-host` is hidden. Again → visible.

- [ ] **Step 7: Run the e2e and make it pass.** Run: `npm run test:e2e`. Expected: all Week 1 and overlay tests pass. If `window.petBridge` is missing in the overlay (check with `overlay.evaluate(() => typeof window.petBridge)`), the session preload didn't load. Confirm `registerPreloadScript` ran before the window was created, and note the fix in the commit message.

- [ ] **Step 8: Commit**

```bash
git add desktop/src/main/overlayWindow.js desktop/src/overlay desktop/src/main/main.js desktop/test/overlayWindow.test.js desktop/test/mouse.test.js desktop/e2e/overlay.spec.js desktop/e2e/launch.js
git commit -m "feat(desktop): pets roam the desktop in a click-through overlay"
```

---

### Task 6: Habitats in the Studium window

**Files:**
- Create: `desktop/src/main/petScripts.js` (pure)
- Modify: `desktop/src/main/main.js` (inject, window state → tracker)
- Test: `desktop/test/petScripts.test.js`, `desktop/e2e/habitat.spec.js`

**Interfaces:**
- Consumes: `paths.petsRoot`, `paths.overlayDir`, Task 3's tracker, Task 1's habitat surface.
- Produces (`petScripts.js`):
  - `habitatFiles(paths) -> string[]`: absolute paths in this order: `<overlayDir>/chromeShim.js`, `<petsRoot>/content/logic.js`, `<petsRoot>/content/menu.js`, `<petsRoot>/content/pet.js`.
  - `habitatScript(sources: string[]) -> string`: `'globalThis.PetSurface = "habitat";\n'` followed by each source, joined with `';\n'` so a file without a trailing semicolon can't run into the next.

- [ ] **Step 1: Write the failing test** `petScripts.test.js`:
  - `habitatScript(['A', 'B'])` starts with `globalThis.PetSurface = "habitat";` and has `A` before `B`.
  - `habitatFiles({ petsRoot: R, overlayDir: O })` gives the four paths in order.

- [ ] **Step 2: Run, see it fail, implement, run `npm test`.** Expected: PASS.

- [ ] **Step 3: Wire it up in `main.js`**
  - On the Studium window's `webContents` `did-finish-load`, when `isStudiumPage(win.webContents.getURL(), args.dev)`:
    1. `habitat.reset()`;
    2. read `habitatFiles(paths)` with `fs.readFileSync(…, 'utf8')`;
    3. `executeJavaScript(habitatScript(sources)).catch(console.error)`.
  - `did-start-navigation` for a main-frame, non-same-document navigation, and `render-process-gone` → `habitat.reset()`.
  - On the window's `show`, `hide`, `minimize` and `restore`, and once after creation: `habitat.setWindow({ visible: win.isVisible(), minimized: win.isMinimized() })`.

- [ ] **Step 4: Write the failing e2e** `desktop/e2e/habitat.spec.js`, seeded with `testPet('p1')` and `testPet('p2')`. Stand in for a project page by adding the box Studium's `Habitat.tsx` renders:

```js
await studium.evaluate(() => {
  const box = document.createElement('div');
  box.dataset.petHabitat = 'p1';
  box.style.cssText = 'position:fixed;left:20px;top:80px;width:400px;height:240px';
  document.body.appendChild(box);
});
```

  1. **"a project page's pet lives in its habitat and leaves the desktop"**: with the Studium window shown:
     - the Studium page shows exactly one `#capstone-pet-host .pet`, and the box gets `data-pet-attached`;
     - `studiumTest.habitat.get()` polls to `'p1'`;
     - the overlay shows only one visible pet (p2).
  2. **"closing or minimizing Studium sends the pet back to the desktop"**:
     - closing the window → `habitat.get()` polls to `null` and the overlay shows two visible pets;
     - `showStudium` again (tray `trayClick('open')`) → back to one;
     - `minimize()` → two again.
  3. **"reloading Studium on a project page doesn't lose the pet"**: `studium.reload()` → `habitat.get()` is `null` and the overlay shows two pets until a box is added again.

- [ ] **Step 5: Run `npm run test:e2e` and make it pass.**

- [ ] **Step 6: Commit**

```bash
git add desktop/src/main/petScripts.js desktop/src/main/main.js desktop/test/petScripts.test.js desktop/e2e/habitat.spec.js
git commit -m "feat(desktop): habitat pets in the Studium window; hidden from the desktop meanwhile"
```

---

### Task 7: Installer, check by hand, docs

**Files:**
- Modify: `desktop/package.json` (`"version": "0.5.0"`), `README.md` (desktop section: pets on the desktop, how to hide them), `HANDOFF.md` (Week 2 done, what's next)
- Modify, if the packaged check needs it: `desktop/e2e/packaged.spec.js`

- [ ] **Step 1: Build the installer.** Run (in `desktop/`): `npm run dist`. Expected: `Studium Setup 0.5.0.exe` in `~/StudiumBuilds`. Then run `npx playwright test e2e/packaged.spec.js` if it checks the built app. Expected: PASS (`logic.js` now loads from `resources/extension/content/`).

- [ ] **Step 2: Check by hand with the user** on their PC, after installing 0.5.0. Use a project with a hatched pet, or temporarily the example data. Each line is a pass/fail:
  1. Pets walk along the top of the taskbar with Studium closed to the tray.
  2. Desktop icons, the taskbar and other apps can be clicked right next to a pet.
  3. Typing in Word or a browser keeps going while a pet is clicked or dragged.
  4. Drag and throw a pet over another app. Click it: it hops and talks.
  5. Right-click → What should I work on? / Nap / Sleep 1 h / Open project each work. The menu closes on a click elsewhere.
  6. A nap with `petTimingOverride: { napMinutes: 1 }` set in `pet-state.json` (while Studium is quit) ends, the pet asks how it went, and the answer reaches Studium.
  7. Completing a task in Studium makes its pet celebrate on the desktop.
  8. A project page shows its pet in the habitat, using its bed or furniture. That pet isn't on the desktop until the window is closed or minimized.
  9. The tray's Hide pets / Show pets and Wake work.
  10. Settings: "Pets on screen at once" and Minimal/Mild/Moderate change the desktop pets. Moderate notes appear and close with ×.

Record anything that fails in `HANDOFF.md` under "Still to check by hand" and fix it before Week 3 unless the user defers it.

- [ ] **Step 3: Update `README.md` and `HANDOFF.md`.** In `HANDOFF.md`:
  - Week 2 is done, with this plan's path.
  - The three surfaces and `PetSurface`.
  - `petHabitat` is live state, never saved.
  - The click-through rule and `MOUSE_RECHECK_MS`.
  - Next is Week 3: notes on the desktop (15 minutes, carried in), chase, open its project, sounds.

- [ ] **Step 4: Run every suite once more.** In `desktop/`: `npm test` and `npm run test:e2e`. In `web/`: `npx vitest run --maxWorkers=4` and `npm run build`. Expected: all pass.

- [ ] **Step 5: Commit and push**

```bash
git add desktop/package.json README.md HANDOFF.md desktop/e2e/packaged.spec.js
git commit -m "docs: desktop Week 2 done; version 0.5.0"
git push -u origin feature/desktop-week2-overlay
```

Give the user the pull request link GitHub prints, with a title and a description ending in the Claude Code line (`gh` isn't installed).

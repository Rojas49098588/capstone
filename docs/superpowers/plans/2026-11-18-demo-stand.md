# Demo Stand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A "Studium Demo" copy of the desktop app with its own demo save (the owner's five classes, made-up work, dates from "now"), a Reset demo button only in that copy, and a one-page cheat sheet for the stand.

**Architecture:** The web app gets `web/src/store/demo.ts`: a pure `buildDemo(now)` in the style of `store/seed.ts`, demo settings, and functions that write both to storage. The desktop app gets a `--demo` flag (only honored with `--user-data`), which the Studium window's preload exposes as `window.studiumDesktop.demo`. In demo mode the web app installs the demo save on first start, shows Reset demo in Settings, and hides the Account section.

**Tech Stack:** React + TypeScript + Vitest (web/), Electron + Node test runner (desktop/), as already used.

**Spec:** `docs/superpowers/specs/2026-11-18-demo-stand-design.md`

## Global Constraints

- The owner's real data is never read, changed or synced by the demo copy. The demo copy never signs in.
- Peers who download Studium never see Reset demo or the demo data: demo mode needs `--demo` **and** `--user-data=<dir>`.
- Dates never look stale: everything date-like is built from the `now` passed in, for any day.
- Five projects, one per class, pet kinds cat, dog, frog, pigeon, turtle (one each); no eggs; at least one juvenile; at least one project with a second, hatched Shop pet.
- Project names and short names, exactly: `Capstone: Studium` / `Capstone`, `App Dev: Mustang Closet` / `App Dev`, `Web Dev: Childcare website` / `Web Dev`, `3D Animation: Blender short` / `3D Anim`, `UI/UX: YouTube redesign` / `UI/UX`.
- Web Dev's requirements include `Front end`, `Back end`, `Middle layer`, `Deployment`; Deployment waits on the other three.
- Token balance around 1,500 (test: 1,400 to 1,700).
- Copy: the button is **Reset demo**; the confirm says what it does: "This replaces everything in this demo copy with fresh demo data." with **Reset** and **Cancel**.
- Existing tests keep passing (web `npm test`, desktop `npm test`); type check clean (`npx tsc -b` in web).

## Review Focus

1. **`--demo` without `--user-data`** (a typo in the shortcut) must not turn on demo mode, or Reset would wipe the owner's real save. Pinned in Task 3 (`parseArgs` test).
2. **Reset pressed late at night, or on a different weekday** (rehearsal 12/2, demo 12/3): Today, Soon, moods and "no eggs" must still hold. Pinned in Task 1 by running every check over several `now` values, including 23:50 and 00:10.
3. **The app's normal load pass changing the demo save** (normalize, hatching or growing up on load) would make the first screen differ from what was planned. Pinned in Task 1 (normalize leaves it equal; `settlePets` gives no news).
4. **Pets and toys on the desktop after a Reset** keep their state by project id; ids that change on every build would orphan them. Pinned in Task 1 (same ids for two different `now`s).
5. **Signing in from the demo copy** would sync demo data into a real account. Pinned in Task 2 (no Account section in demo mode).

---

### Task 1: The demo save and demo settings

**Files:**
- Create: `web/src/store/demo.ts`
- Test: `web/src/store/demo.test.ts`

**Interfaces:**
- Consumes (existing): `StudiumData`, `Project`, `ExtraPet`, `Requirement`, `Task`, `StudiumEvent`, `ZERO_BREAKDOWN` (`planner/types.ts`); `addDays`, `localDateKey`, `DAY_MS` (`planner/time.ts`); `giveDefaultBeds` (`store/decor.ts`); `eggProductId` (`planner/pets.ts`); `DEFAULT_SETTINGS`, `Settings` (`store/settings.ts`). For tests: `isValidData`, `normalizeData` (`store/storage.ts`), `settlePets`, `petsOf`, `petMood` (`planner/pets.ts`), `viewOf` (`planner/requirementView.ts`), `isReordered` (`planner/order.ts`), `tokenBalance` (`planner/history.ts`), `hasPlacedWindow` (`planner/timeOfDay.ts`), the project progress function in `planner/progress.ts`.
- Produces:
  - `export const DEMO_PROJECT_IDS: readonly string[]`: `["capstone", "appDev", "webDev", "anim3d", "uiux"]`.
  - `export function buildDemo(now: Date): StudiumData`
  - `export const DEMO_NICKNAME = "Mustang"` (a placeholder the owner can change in this one line).
  - `export const DEMO_SETTINGS: Settings`: `DEFAULT_SETTINGS` with `setupDone`, `tutorialDone`, `shopTutorialDone` true, `petInvolvement: "moderate"`, `petCount: "all"`, `nickname: DEMO_NICKNAME`, `startWithComputer: false`, `petSounds: true`.

- [ ] **Step 1: Write the failing tests** in `web/src/store/demo.test.ts`. Run every check below inside `describe.each` over these `now` values (local time): `2026-12-02T10:00`, `2026-12-03T09:00`, `2026-12-03T23:50`, `2026-12-04T00:10`, `2027-02-15T14:00`.

```ts
it("is a valid save that loading leaves unchanged", () => {
  const d = buildDemo(now);
  expect(isValidData(d)).toBe(true);
  expect(normalizeData(d)).toEqual(d);
  expect(settlePets(d, now).news).toEqual([]); // nothing hatches or grows up on the first load
});
it("has the owner's five classes with stable ids", () => {
  const d = buildDemo(now);
  expect(d.projects.map((p) => p.id)).toEqual([...DEMO_PROJECT_IDS]);
  expect(buildDemo(new Date("2027-06-01T08:00")).projects.map((p) => p.id)).toEqual([...DEMO_PROJECT_IDS]);
  expect(d.projects.map((p) => [p.name, p.shortName])).toEqual([
    ["Capstone: Studium", "Capstone"], ["App Dev: Mustang Closet", "App Dev"], ["Web Dev: Childcare website", "Web Dev"],
    ["3D Animation: Blender short", "3D Anim"], ["UI/UX: YouTube redesign", "UI/UX"],
  ]);
  expect(new Set(d.projects.map((p) => p.petKind))).toEqual(new Set(["cat", "dog", "frog", "pigeon", "turtle"]));
});
it("has pets that roam: no eggs, at least one juvenile, and one bought pet", () => {
  const d = buildDemo(now);
  const pets = d.projects.flatMap(petsOf);
  expect(pets.every((p) => p.stage !== "egg" && p.hatchedAt !== null)).toBe(true);
  expect(pets.some((p) => p.stage === "juvenile")).toBe(true);
  expect(d.projects.some((p) => (p.pets?.length ?? 0) >= 1)).toBe(true);
});
it("gives Web Dev the planner path", () => {
  const d = buildDemo(now);
  const reqs = d.requirements.filter((r) => r.projectId === "webDev");
  expect(reqs.map((r) => r.title)).toEqual(expect.arrayContaining(["Front end", "Back end", "Middle layer", "Deployment"]));
  const deploy = reqs.find((r) => r.title === "Deployment")!;
  const others = reqs.filter((r) => ["Front end", "Back end", "Middle layer"].includes(r.title)).map((r) => r.id);
  expect(deploy.blockedByAll === true || others.every((id) => deploy.blockedBy?.includes(id))).toBe(true);
  expect(reqs.some((r) => r.sublabel)).toBe(true);
  const soon = viewOf("webDev", d, ["soon"], now);
  // shown and hidden counts from viewOf's result: at least 1 shown and at least 1 hidden
  expect(reqs.some((r) => d.tasks.filter((t) => t.requirementId === r.id && !t.done).length >= 4)).toBe(true);
  expect(d.today.taskIds.some((id) => d.tasks.find((t) => t.id === id)?.projectId === "webDev")).toBe(true);
});
it("plans a believable Today", () => {
  const d = buildDemo(now);
  expect(d.today.date).toBe(localDateKey(now));
  expect(d.today.taskIds.length).toBeGreaterThanOrEqual(3);
  expect(d.today.taskIds.length).toBeLessThanOrEqual(5);
  const today = d.today.taskIds.map((id) => d.tasks.find((t) => t.id === id)!);
  expect(today.every((t) => t && !t.done)).toBe(true);
  expect(new Set(today.map((t) => t.projectId)).size).toBeGreaterThanOrEqual(2);
});
it("shows different moods and progress", () => {
  const d = buildDemo(now);
  const moods = d.projects.flatMap(petsOf).map((p) => petMood(p, d, now)?.mood);
  expect(moods.some((m) => m === "Proud" || m === "Delighted" || m === "Happy")).toBe(true);
  expect(moods.some((m) => m === "Worried" || m === "Upset")).toBe(true);
  expect(moods).not.toContain("Sick");
  // Capstone's progress is at least 0.8; at least one other project is below 0.6 (use progress.ts's project progress).
});
it("is ready to play: tokens, toys, decor, a star and a reordered list", () => {
  const d = buildDemo(now);
  expect(tokenBalance(d)).toBeGreaterThanOrEqual(1400);
  expect(tokenBalance(d)).toBeLessThanOrEqual(1700);
  const bought = d.events.filter((e) => e.type === "purchase").map((e) => e.productId);
  expect(bought).toEqual(expect.arrayContaining(["focus-ball", "robo-mouse", "window"]));
  expect(Object.values(d.decor ?? {}).some(hasPlacedWindow)).toBe(true);
  expect(d.tasks.some((t) => t.priority && !t.done)).toBe(true);
  // isReordered is true for at least one list (a project id + requirement id pair).
});
it("has demo settings that survive a save and load", () => {
  expect(parseSettings(JSON.stringify(DEMO_SETTINGS))).toEqual(DEMO_SETTINGS);
  expect(DEMO_SETTINGS.setupDone && DEMO_SETTINGS.tutorialDone && DEMO_SETTINGS.shopTutorialDone).toBe(true);
  expect(DEMO_SETTINGS.petCount).toBe("all");
  expect(DEMO_SETTINGS.petInvolvement).toBe("moderate");
});
```

The two comment-only lines are written as real assertions with the existing functions' actual signatures (read them first).

- [ ] **Step 2: Run them to see them fail.** Run: `npx vitest run src/store/demo.test.ts` (in `web/`). Expected: FAIL, cannot resolve `./demo`.

- [ ] **Step 3: Implement `buildDemo(now)`, `DEMO_PROJECT_IDS`, `DEMO_NICKNAME`, `DEMO_SETTINGS`** in `web/src/store/demo.ts`. Follow `store/seed.ts`: a table of projects → requirements → tasks with day offsets, with ids `<projectId>-r<n>` / `<projectId>-t<n>` so they are stable. The content (requirements for each class, from the spec's table) is the implementer's to write, believably. Give moods through the event history (recent `task_completed` events on happy projects; little recent work and an overdue or close requirement on the worried one). Make tokens by setting `startingTokens` and recording `purchase` events at real prices (`priceOf`) for the toys, the Window, other decor placed in one habitat, and the extra pet's egg (`eggProductId`). Leave at least one habitat with only its default bed (`giveDefaultBeds`). Set `order` on one list's unfinished tasks so it counts as reordered. If a check fails for one `now`, fix the data, not the test.

- [ ] **Step 4: Run them to see them pass.** Run: `npx vitest run src/store/demo.test.ts`. Expected: all pass, for every `now`.

- [ ] **Step 5: Commit.**

```bash
git add web/src/store/demo.ts web/src/store/demo.test.ts
git commit -m "feat(demo): build the demo save and demo settings from the current date"
```

### Task 2: Demo mode in the web app (first start, Reset demo, no Account)

**Files:**
- Modify: `web/src/store/demo.ts`, `web/src/main.tsx`, `web/src/components/Settings.tsx`, `web/src/vite-env.d.ts`
- Test: `web/src/store/demo.test.ts`, `web/src/components/Settings.test.tsx`

**Interfaces:**
- Consumes: Task 1's `buildDemo`, `DEMO_SETTINGS`; `STORAGE_KEY`, `saveData` (`store/storage.ts`); `SETTINGS_KEY`, `saveSettings` (`store/settings.ts`); `window.studiumDesktop.reloadPets` (exists).
- Produces:
  - `window.studiumDesktop.demo?: boolean` in `vite-env.d.ts` (Task 3 fills it in).
  - `export function isDemo(): boolean`: `window.studiumDesktop?.demo === true`.
  - `export function installDemo(storage: Storage, now: Date): void`: writes `buildDemo(now)` and `DEMO_SETTINGS`.
  - `export function startDemoIfNew(storage: Storage | null, now: Date): boolean`: in demo mode with no `STORAGE_KEY` saved, installs and returns true; otherwise touches nothing and returns false.
  - `export function resetDemo(deps: { storage: Storage; now: Date; reloadPets?: () => void; reload: () => void }): void`: `installDemo`, then `reloadPets?.()`, then `reload()`.

- [ ] **Step 1: Write the failing tests.**
  - `demo.test.ts`, "startDemoIfNew": with `studiumDesktop = { desktop: true, demo: true }` and empty storage → returns true, and both keys hold the demo; with data already saved → returns false and the saved text is unchanged; without `demo` → returns false and storage stays empty.
  - `demo.test.ts`, "resetDemo": with existing other data saved, it replaces both keys with the demo, then calls `reloadPets` and then `reload` (in that order).
  - `Settings.test.tsx`, "shows Reset demo only in the demo copy": no button named "Reset demo" without `demo`; with `demo: true` it shows, and the Account section (heading "Account") is absent.
  - `Settings.test.tsx`, "Reset demo asks first": clicking "Reset demo" shows the confirm text "This replaces everything in this demo copy with fresh demo data."; **Cancel** changes nothing; **Reset** writes the demo save to storage and calls `reloadPets` (stub `window.location.reload` for the test).

- [ ] **Step 2: Run them to see them fail.** Run: `npx vitest run src/store/demo.test.ts src/components/Settings.test.tsx`. Expected: FAIL (functions missing; no Reset demo button).

- [ ] **Step 3: Implement.** Add the four functions to `demo.ts`. In `main.tsx`, call `startDemoIfNew(browserStorage(), new Date())` before `createRoot(...).render`. In `Settings.tsx`, when `isDemo()`: replace the Account `<section>` with a "Demo" section holding the Reset demo button and its inline confirm (Reset / Cancel), styled like the existing buttons (`BUTTON_SECONDARY`); Reset calls `resetDemo({ storage, now: new Date(), reloadPets: window.studiumDesktop?.reloadPets, reload: () => window.location.reload() })`.

- [ ] **Step 4: Run them to see them pass,** then the whole web suite and the type check. Run: `npm test` and `npx tsc -b` (in `web/`). Expected: all pass; no type errors.

- [ ] **Step 5: Commit.**

```bash
git add web/src/store/demo.ts web/src/store/demo.test.ts web/src/main.tsx web/src/components/Settings.tsx web/src/components/Settings.test.tsx web/src/vite-env.d.ts
git commit -m "feat(demo): demo copy installs the demo save on first start; Reset demo in Settings; no account"
```

### Task 3: The desktop `--demo` flag

**Files:**
- Modify: `desktop/src/main/paths.js` (`parseArgs`), `desktop/src/main/main.js` (one IPC handler), `desktop/src/preload/studium.js` (`desktopApi`)
- Test: `desktop/test/paths.test.js`, `desktop/test/preload.test.js`

**Interfaces:**
- Consumes: Task 2 reads `window.studiumDesktop.demo`.
- Produces: `parseArgs(argv).demo: boolean`; IPC channel `studium:is-demo` (sync, returns `args.demo` to the Studium window only); `desktopApi(ipc).demo: boolean` from `ipc.sendSync('studium:is-demo') === true`.

- [ ] **Step 1: Write the failing tests.**
  - `paths.test.js`: `parseArgs(['x', '--demo', '--user-data=C:/d']).demo === true`; `parseArgs(['x', '--demo']).demo === false` (no separate folder: never demo); `parseArgs(['x', '--user-data=C:/d']).demo === false`.
  - `preload.test.js`: `desktopApi` with a fake ipc whose `sendSync('studium:is-demo')` returns `true` → `demo === true`; returning `undefined` → `false`; and `sendSync` throwing → `false`.

- [ ] **Step 2: Run them to see them fail.** Run: `npm test` (in `desktop/`). Expected: the new cases fail.

- [ ] **Step 3: Implement.** `parseArgs`: `demo: argv.includes('--demo') && userData !== ''`, and document `--demo` in its comment. `main.js`: `ipcMain.on('studium:is-demo', (event) => { event.returnValue = <sender is the Studium window> ? args.demo : false; })`, using the same sender check the other handlers use. `desktopApi`: compute `demo` once, wrapped in try/catch.

- [ ] **Step 4: Run tests, then try it.** Run: `npm test` (desktop). Expected: all pass. Then build the web app (`npm run build` in `web/`) and run from `desktop/`: `env -u ELECTRON_RUN_AS_NODE npx electron . --demo "--user-data=<scratchpad>/studium-demo-data"`. Expected: Studium opens on the Overview with the five classes (no setup), five pets roam, Settings shows Reset demo and no Account; Reset brings back the fresh save. Running the same without `--demo` on that folder shows no Reset demo.

- [ ] **Step 5: Commit.**

```bash
git add desktop/src/main/paths.js desktop/src/main/main.js desktop/src/preload/studium.js desktop/test/paths.test.js desktop/test/preload.test.js
git commit -m "feat(desktop): --demo flag (only with --user-data) for the demo copy"
```

### Task 4: The cheat sheet and the shortcut

**Files:**
- Create: `docs/demo/cheat-sheet.md`
- Modify: `HANDOFF.md` (a short "Demo copy (2026-11-18)" section), `docs/ROADMAP.md` (item 7: built, how to use it)

- [ ] **Step 1: Write `docs/demo/cheat-sheet.md`** with, in this order, fitting one printed page:
  - **Before the stand:**
    1. Quit the real Studium (tray → Quit Studium).
    2. Open Studium Demo and press Settings → Reset demo.
    3. Check that the sound plays through the TV.
    4. Put out the QR code (`docs/demo/download-qr.png`).
    5. Throw out a toy.
  - **The 30-second pitch** (from the spec).
  - **The planner path** in Web Dev, matching the demo data's real requirement and task names.
  - **"Try it yourself"** list for visitors.
  - **Answers to likely questions:**
    - free;
    - Windows, Mac (signed) and Linux;
    - sync with an account;
    - the phone app (built, not in the demo, coming later);
    - what's next (from the ROADMAP's after-December list).
  - **When busy:** skip the drag and the 🔒; show Soon and one tick, then hand over the pets.
  - **Making the shortcut (once):** a PowerShell snippet using `WScript.Shell` that creates a desktop shortcut "Studium Demo". It points to `%LOCALAPPDATA%\Programs\Studium\Studium.exe` (per-user install: `perMachine: false` in `desktop/electron-builder.yml`; check the path on the laptop) with arguments `--demo "--user-data=%APPDATA%\Studium Demo"`.

- [ ] **Step 2: Check it against the data.** Every requirement or task name the cheat sheet mentions appears in `buildDemo` (grep each one).

- [ ] **Step 3: Commit.**

```bash
git add docs/demo/cheat-sheet.md HANDOFF.md docs/ROADMAP.md
git commit -m "docs(demo): cheat sheet for the stand, demo shortcut steps, handoff and roadmap"
```

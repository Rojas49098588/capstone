# Capstone — Handoff

Briefing for the next Claude session working in this repo. Read this first, then the files it points to.

## Start here: Plans 1–3 and pet interactions are done; ask the user what's next

All three plans from the planner spec are built, and so is the pet interactions round (spec `docs/superpowers/specs/2026-10-19-pet-interactions-design.md`, plan `docs/superpowers/plans/2026-10-19-pet-interactions.md`, branch `feature/pet-interactions`). Its planned next round is **work limiters**, built on the focus sessions it records. Ask the user to choose the next step, for example:
- **Deploy Studium** somewhere other than `localhost` (Vercel, Netlify), so testers don't need Node. Then change `HOMEPAGE_URL` in `extension/content/logic.js`; the toolbar icon and the pets' Studium detection both use it.
- **Deferred ideas** (spec "Out of scope"): the pet lifecycle (hatching later, growing), using food, clothes and toys, and sprite animation frames.
- **Deferred minors** listed under "Known small issues" below.

New work still goes through `superpowers:brainstorming` / `superpowers:writing-plans`, with the user's approval before any code. Plans 1–3 were built with **inline execution** (`superpowers:executing-plans`) at the user's request ("a native approach"): test-first, with one whole-branch review at the end.

**Branches:** Plans 1 and 2 are merged into `main` (Plan 2 locally; check whether `main` has been pushed). Plan 3 was built on `feature/extension-link`; check `git log main` / `git branch` for whether it has been merged or pushed. Don't work on `main`.

## The project

Two parts, one repo (`https://github.com/Rojas49098588/capstone`, private):

- **`extension/`**: Chrome extension (Manifest V3, plain JS, no build step). One pet per project walks on every web page (cat, dog, frog, pigeon, turtle; art in `extension/assets/pets/`). Pets can be dragged and thrown, and each kind has its own behavior (naps, hops, flying). Clicking the toolbar icon opens Studium at `http://localhost:5173/`. Pets come from Studium (Plan 3):
  - Studium writes `studium-pets-v1` to its localStorage.
  - The content script on the Studium page copies it to `chrome.storage.local.petStatuses`.
  - Every tab rebuilds its pets from that.

  Each pet's mood changes its speed and sounds. On a Studium project page, only that project's pet shows, living inside the habitat box.
- **`web/`**: **Studium**, a study/project planner (Vite 8 + React 19 + TypeScript 5.9 + Tailwind v4), originally a Figma Make export. The planner rules are in `web/src/planner/` and `web/src/store/` (Plan 1). The screens (Plan 2) are in `web/src/components/` and read and change data only through `useStudiumContext()` (`web/src/store/useStudium.tsx`), which saves every change to localStorage. `web/src/App.tsx` is just the shell (navigation, theme, modals, toast, notices).

The user is a student building this as their capstone. They make the product decisions and approve designs and plans before code is written. Explain choices in plain language. They chose test-first development, small commits, and a final independent review.

## Status

| Piece | State | Where |
|---|---|---|
| Spec (planner rules, screens, extension link) | Approved, includes requirement start dates | `docs/superpowers/specs/2026-10-14-studium-planner-design.md` |
| Plan 1: planner core (rules, saving, actions, example data) | **Done**, reviewed, 101 tests | merged into `main` (PR #1) |
| Plan 2: Studium screens | **Done**, reviewed (4 fixes after review), 183 tests, checked in a real browser (light, dark, 390 px) | merged into `main` (locally); plan `docs/superpowers/plans/2026-10-15-studium-screens.md` |
| Plan 3: extension link (pet statuses, habitat mode, mood behavior) | **Done**, reviewed (2 fixes after review), 208 tests + a 27-step Playwright check with the real extension | branch `feature/extension-link`; plan `docs/superpowers/plans/2026-10-15-extension-link.md` |
| Pet interactions: pet menu, naps as focus sessions, sleep, check-ins, celebrations | **Done**, 309 tests + a 39-step Playwright check with the real extension | branch `feature/pet-interactions`; plan `docs/superpowers/plans/2026-10-19-pet-interactions.md` |

## Code map

```
extension/
  manifest.json            MV3; content script on <all_urls>; images web-accessible
  background.js            importScripts(content/logic.js); toolbar click → open/focus Studium; tooltip;
                           toolbar menu ("Show / hide pet", "Wake <pet>"); the only writer of petAway/focusOutbox/
                           petCheckIn (runs applyAwayRequest one request at a time, alarms away:<id>); injects the
                           content scripts into open tabs on install
  content/logic.js         pure helpers on globalThis.PetLogic: HOMEPAGE_URL, status parsing, MOOD_EFFECTS/applyMood,
                           idle message, habitat geometry (tests: web/src/extension/petLogic.test.ts)
  content/logic.js (cont.) pet interactions: validators for petAway/focusOutbox/petCheckIn, applyAwayRequest (the
                           worker's whole nap/sleep/check-in state machine, pure), menu items, wording, celebrations
  content/menu.js          the pet's right-click menu (DOM only, globalThis.PetMenu; tests: web/src/extension/menu.test.ts)
  content/bridge.js        Studium page only: delivers focusOutbox to Studium, forwards studium:wake-pet (bridge.test.ts)
  content/pet.js           all pet behavior: KINDS (per-animal tuning), pets from petStatuses, Studium copy, habitat mode,
                           menu wiring, away pets, quiet mode, check-in bubbles, celebrations
  assets/pets/*.png        cleaned-up art (originals in /assets are JPEGs named .png)
web/
  src/planner/             pure rules, no React: types, tuning (ALL numbers), time, history, blocking,
                           learning, progress, mood, value, suggest (+ *.test.ts, testData.ts fixtures)
  src/store/               actions.ts (pure user actions), storage.ts (validate/load/save/backups),
                           seed.ts (example data), products.ts (shop incl. Medicine)
  src/store/useStudium.tsx StudiumProvider + useStudiumContext: data, `now` (refreshed every minute), notices,
                           every action with the time filled in; saves after each change; publishes pet statuses
  src/store/petStatus.ts   buildPetStatuses / publishPetStatuses (studium-pets-v1 + studium:pets-updated event);
                           each pet's suggestion and celebration; the extension event names
  src/planner/focus.ts     focus-session sums (focusMinutes, taskFocusMinutes)
  src/ui/hashLinks.ts      #project=<id> / #complete=<taskId> links, followed by App.tsx
  src/extension/           tests for extension/content/logic.js (the extension has no node_modules of its own)
  src/ui/                  format.ts (ALL wording), derive.ts (per-project summaries), styles.ts (shared classes)
  src/pets/eggs.ts         egg looks + vague descriptions, shuffle
  src/components/          one file per screen piece (Overview, ProjectDetail, RequirementCard, TaskRow,
                           CompletionPrompt, Habitat, Shop, ProjectModal, EggPicker, ...) + tests next to each
  src/test/render.tsx      renderWithStudium, memoryStorage, savedData; importing it registers RTL cleanup
  src/App.tsx              shell only: StudiumApp (needs a provider) and default App (provider + browser storage)
  src/index.css            Tailwind v4 setup, fonts, light/dark theme tokens
  public/pets/*.png        copies of the extension art, shown in the habitat when the extension isn't attached
docs/superpowers/          spec and plans
```

**Habitat box:** `Habitat.tsx` renders `<div data-pet-habitat="<projectId>">`.
- The extension never writes into React's node. The pet is drawn in the extension's own fixed overlay, positioned from the box's `getBoundingClientRect()` every frame and clipped to it.
- The extension only sets or removes `data-pet-attached`.
- Without that attribute, Studium shows `public/pets/<petKind>.png` after 1000 ms (`HABITAT_FALLBACK_MS`). The picture comes back whenever the attribute is removed (pets hidden, extension gone).

Key facts about Plan 1's code that the screens rely on:
- Saved under localStorage key `studium-data-v1`; damaged data is backed up as `studium-data-backup-<ISO time>` and replaced with the example data.
- Every planner/store function that depends on time takes `now: Date`. Never call `Date.now()`/`new Date()` inside `planner/` or `store/`.
- Example data (`buildSeed(now)`) is built relative to `now`. It starts with webDev Happy, appDev behind, Animation's "Rigging" neglected (9 days idle), seniorCap **Sick**, petExt Happy. Project ids (`webDev`, `appDev`, `Animation`, `seniorCap`, `petExt`) match the extension's saved pet positions; keep them.

## Decisions made after the spec (they change behavior; don't undo them)

From Plan 1's final review (all have regression tests):
- **Only a task's first completion counts as the requirement "moving".** Re-checking an old task doesn't reset neglect, cure Sick or end Recovering.
- **Each task's own value pays once.** A re-check can still pay a requirement's **finish bonus** if that bonus was never paid.
- **A requirement's tasks can't be paid more than its 70% share in total**, so creating, completing and deleting tasks can't farm tokens.
- **`task_completed` events carry the task's `requirementId`** (optional field; old data still loads).
- **Actions clean their input:** empty or malformed dates become `null`, `undefined` fields in edits are ignored, and unknown project ids throw (`createTask`, `createRequirement`). `createProject` throws on an invalid deadline, so UI must validate first (Plan 2's ProjectModal does).
- Requirements have an optional **start date**: the plan and neglect only begin then.

From Plan 2's final review (all have regression tests):
- **The minutes box keeps its own text**, so typing 300 isn't cut to 30 when a prefix matches a quick choice.
- **Dialogs move focus in and give it back** to whatever opened them (`components/useReturnFocus.ts`). There's no Tab trap yet.
- **Tabs stay in sync:** the provider listens for `storage` events on `studium-data-v1` and takes another tab's valid data, so tabs don't overwrite each other.
- **`ProjectDetail` is keyed by project id**, so switching projects gives a fresh page and a fresh `[data-pet-habitat]` box. The extension watches for the box being replaced, not just added.

From Plan 3:
- **Pets come only from Studium.** No `petStatuses` in chrome.storage means no pets, and the tooltip reads "Open Studium once to meet your pets".
- **Mood rebuilds keep pets in place**, and a status write that only changes `updatedAt` doesn't rebuild anything (`statusesEqual`).
- **Box positions are never saved** as window positions; leaving the habitat puts the pet back at its saved floor spot.

From pet interactions:
- **Every completion celebrates** (user's decision, changed from the spec draft): re-checks too. A project's first completed task and a finished requirement celebrate bigger.
- **`statusesEqual` ignores `suggestion` and `celebration`**, so completing tasks doesn't rebuild the pets.
- **A focus delivery Studium couldn't save isn't kept in memory**, so the next delivery isn't mistaken for a duplicate and deleted unsaved.
- **The completion prompt's pre-fill follows focus time that arrives after it opened**, until the user picks a time.
- **Right-button presses don't start a drag**, and a background tab plays celebrations when you come back to it.
- `petTimingOverride: { napMinutes }` in chrome.storage shortens naps for browser checks (at most 15). `handleMenuClick` and `menuIds` are on the worker's `globalThis` because Playwright can't open the toolbar menu.

Known small issues, deferred on purpose:
- A task checked off while unlinked never pays its own share, even after it's linked.
- Hand-edited saved data with weight ≤ 0 or negative estimates passes validation.
- Plan 2 review minors: a first completion that earns 0 tokens (pool used up) still says "already paid"; "It hatched" repeats on each return until another project is opened; blocked tasks have no lock icon; TaskForm uses fixed element ids; `estimateMultipliers` is recomputed per card and render.
- Plan 3 review minors: the Studium tab writes chrome.storage on every publish even if nothing but the time stamp changed; any status change rebuilds every pet (the habitat pet jumps to the middle of its box); the habitat pet draws over the sticky header when scrolled and over the Edit project modal; walking pets aren’t clamped if the box narrows without a window resize; habitat switching relies on `ProjectDetail`’s `key` remounting the box; the replaced copy’s resize listener has no `stale()` guard.

## Gotchas learned the hard way

- **Environment:** Windows 11, Git Bash for shell commands, repo inside OneDrive. Use **npm** (not pnpm) from `web/`. Node 24.
- **TypeScript lib is ES2020.** `Array.prototype.at`, `Object.hasOwn` and similar fail `npm run build` even though Vitest runs them. Use `arr[arr.length - 1]` and `.slice(-1)[0]`.
- **`npm run build` type-checks test files too** (`tsc --noEmit` over `src/`). Run it after each task, not just at the end.
- **Vitest 5.** Component tests need `// @vitest-environment jsdom` as the first line. Planner tests run in node. React Testing Library cleanup is registered by importing `src/test/render.tsx` (Plan 2 creates it).
- **Expected test counts in the plans are hand-counted.** If a count is off but every listed test is present and passing, note it in the ledger and continue. Plan 1's tests had two fixture mistakes: a missing `weight: 6`, and 352 instead of 353, since 352.5 rounds up.
- **Keep failures visible.** Piping `vitest` through `grep` hides the exit code. Save the output to a file, grep it, then `exit` with vitest's status.
- **Long inline `node -e`/heredoc scripts can fail to parse** in the Bash tool. Write the script to a file in the plan's workspace and run that.
- **The superpowers workspace/ledger** goes in `.superpowers/sdd/<plan-name>/` (ignored by git via its own `.gitignore`). Create it with the skill's `sdd-workspace` script, and delete it when the plan is finished.
- **GitHub:** the GitHub CLI (`gh`) is **not installed**. After `git push`, give the user the "Create a pull request" link GitHub prints, plus a title and description. The push prints `'credential-manager-core' is not a git command`; it's harmless (the user was told how to fix it).
- **Line-ending warnings** (`LF will be replaced by CRLF`) on `git add` are harmless.
- **Browser checks:** use Playwright from a scratch folder (not added to the repo).
  - It loads the extension headless with `chromium.launchPersistentContext("", { channel: "chromium", args: ["--disable-extensions-except=<ext>", "--load-extension=<ext>"] })`.
  - Get the service worker with `ctx.serviceWorkers()` / `ctx.waitForEvent("serviceworker")`, and call `chrome.*` through `sw.evaluate`.
  - Plan 3's check script is in its plan (Task 5 Step 1, Task 6 Step 1, and "Added after the final review").
  - Studium must be on port 5173 for the extension to recognize it. The user often has `npm run dev` running there already, so reuse it rather than stopping it.
- **Nothing in `extension/` may start with `_`, and there is no `node_modules` there.** Chrome refuses to load such folders. Extension tests live in `web/src/extension/`.
- **The pet overlay's inline style reads `initial`** for unset properties, because its `cssText` starts with `all: initial`. Check `getComputedStyle(...)` instead.
- **Git Bash's `/tmp` isn't `/tmp` to Node** on Windows (Node sees `C:\tmp`). Pass files to Node scripts through the scratchpad or a repo-relative path.
- **Browser-check text is uppercased by CSS.** Labels like "Priority Focus" use `uppercase`, so Playwright's `innerText` returns "PRIORITY FOCUS". Match case-insensitively. The toast and the egg hint are both `aria-live` regions; scope locators to the dialog.
- **Estimates that aren't quick choices** (e.g. the seed's 180 min) show in the "… in minutes" box, not as a selected radio. Plan 2's completion-prompt test was corrected for this.
- **Running the suite from the repo root:** use `npm --prefix web test`. Wrapping commands in `bash -c "cd web && …"` gets blocked by Claude Code's safety check.
- **Parent-folder CLAUDE.md** (`../CLAUDE.md`) says: at session start, read `../App Dev/bugs.md` and remind the user about open bugs there (a different app, Mustang Closet). That still applies.

## Design system (keep it)

- Headings **DM Serif Display**, body **Inter**, labels/metadata **DM Mono** (Google Fonts, so fonts need network access).
- Primary navy, accent terracotta. Each project has its own color, used in charts, rings, and pet outlines in the extension.
- Light and dark palettes are CSS variables in `web/src/index.css`. The theme is applied as `data-theme` on `<html>` and remembered under `studium-theme`.
- Tailwind v4 utility classes directly in JSX with `var(--color-…)` values; Plan 2 collects the common ones in `web/src/ui/styles.ts`.

## Commands

```bash
cd web
npm test          # vitest run (all tests)
npm run build     # tsc --noEmit + vite build
npm run dev       # http://localhost:5173 (port fixed; the extension opens it)
```

Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Commit or push only as the plan's steps say, or when the user asks.

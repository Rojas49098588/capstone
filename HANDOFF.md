# Capstone — Handoff

Briefing for the next Claude session working in this repo. Read this first, then the files it points to.

## Start here: implement Plan 2

1. **Read, in order:**
   - `docs/superpowers/specs/2026-10-14-studium-planner-design.md` (the approved spec; binding when anything conflicts),
   - `docs/superpowers/plans/2026-10-15-studium-screens.md` (Plan 2, the work to do),
   - skim `docs/superpowers/plans/2026-10-15-planner-core.md` (Plan 1, already built; its code is what Plan 2 consumes).
2. **Branch:** Plan 2 builds on Plan 1, which is **not merged into `main`**.
   ```bash
   git fetch origin
   git checkout feature/planner-core && git pull
   git checkout -b feature/studium-screens
   ```
   (Plan 2's Task 1 Step 1 also says this; do it once.) Don't work on `main`.
3. **Execution method:** the user hasn't chosen one for Plan 2 yet. The previous session recommended **inline execution** (`superpowers:executing-plans`: implement every task yourself, test-first, then one fresh whole-branch review on the most capable model). Plan 1 was built that way at the user's request. Confirm with the user before starting.
4. **Finish** with the final review, a fix pass for Critical/Important findings (each with a failing test first), then `superpowers:finishing-a-development-branch`. For Plan 1 the user chose "push and create a PR".

## The project

Two parts, one repo (`https://github.com/Rojas49098588/capstone`, private):

- **`extension/`**: Chrome extension (Manifest V3, plain JS, no build step). One pet per project walks on every web page (cat, dog, frog, pigeon, turtle; art in `extension/assets/pets/`). Pets can be dragged and thrown, and each kind has its own behavior (naps, hops, flying). Clicking the toolbar icon opens Studium at `http://localhost:5173/`. Its project list is still a **hard-coded copy** (`PROJECTS` in `extension/content/pet.js`); Plan 3 replaces it with data from Studium.
- **`web/`**: **Studium**, a study/project planner (Vite 8 + React 19 + TypeScript 5.9 + Tailwind v4), originally a Figma Make export. The planner rules are in `web/src/planner/` and `web/src/store/` (Plan 1). The screens in `web/src/App.tsx` are still the **old in-memory Figma UI**; Plan 2 replaces them.

The user is a student building this as their capstone. They make the product decisions and approve designs and plans before code is written. Explain choices in plain language. They chose test-first development, small commits, and a final independent review.

## Status

| Piece | State | Where |
|---|---|---|
| Spec (planner rules, screens, extension link) | Approved, includes requirement start dates | `docs/superpowers/specs/2026-10-14-studium-planner-design.md` |
| Plan 1: planner core (rules, saving, actions, example data) | **Done**, reviewed, 101/101 tests | branch `feature/planner-core` (pushed); PR link was given to the user: https://github.com/Rojas49098588/capstone/pull/new/feature/planner-core (check whether it's open) |
| Plan 2: Studium screens | **Written, not started** | `docs/superpowers/plans/2026-10-15-studium-screens.md` (committed on `feature/planner-core`) |
| Plan 3: extension link (pet statuses, habitat mode, mood behavior) | Not written | Spec section 5 |

## Code map

```
extension/
  manifest.json            MV3; content script on <all_urls>; images web-accessible
  background.js            toolbar click → open/focus Studium; "Show / hide pet" menu; injects pets into open tabs on install
  content/pet.js           all pet behavior; PROJECTS (hard-coded, Plan 3 removes) and KINDS (per-animal tuning)
  assets/pets/*.png        cleaned-up art (originals in /assets are JPEGs named .png)
web/
  src/planner/             pure rules, no React: types, tuning (ALL numbers), time, history, blocking,
                           learning, progress, mood, value, suggest (+ *.test.ts, testData.ts fixtures)
  src/store/               actions.ts (pure user actions), storage.ts (validate/load/save/backups),
                           seed.ts (example data), products.ts (shop incl. Medicine)
  src/App.tsx              OLD Figma UI, replaced in Plan 2 Task 13
  src/index.css            Tailwind v4 setup, fonts, light/dark theme tokens
docs/superpowers/          spec and plans
```

Key facts about Plan 1's code that Plan 2 relies on:
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

Known small issues, deferred on purpose:
- A task checked off while unlinked never pays its own share, even after it's linked.
- Hand-edited saved data with weight ≤ 0 or negative estimates passes validation.

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
- **Browser checks:** there's a pattern of using Playwright from a scratch folder (not added to the repo) with `npx vite preview`. The extension can be loaded into Chromium with `--load-extension` for testing.
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

## After Plan 2

Plan 3 (to be written with `superpowers:writing-plans` from spec section 5):
- Studium publishes each pet's status (`studium-pets-v1`).
- The content script copies it to `chrome.storage` and rebuilds pets from it, replacing the hard-coded `PROJECTS`.
- **Habitat mode:** on a Studium project page, every pet except that project's one hides, and that pet lives inside `[data-pet-habitat]` and sets `data-pet-attached`.
- Mood changes pet speed and sounds.

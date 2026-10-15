# Capstone — Handoff

Briefing for the next Claude session working in this repo. Read this first, then the files it points to.

## Start here: write and implement Plan 3

1. **Read, in order:**
   - `docs/superpowers/specs/2026-10-14-studium-planner-design.md` (the approved spec; binding when anything conflicts). Plan 3 is **section 5** (extension link).
   - skim `docs/superpowers/plans/2026-10-15-studium-screens.md` (Plan 2, built) for how the screens and the habitat box work.
2. **Write Plan 3** with `superpowers:writing-plans` from spec section 5, and get the user's approval before any code.
3. **Branch:** Plan 1 is merged into `main` (PR #1). Plan 2 was built on `feature/studium-screens` (branched from `feature/planner-core`). Check whether Plan 2 has been pushed or merged (`git log origin/main`, `git branch -r`), and branch Plan 3 from wherever Plan 2 lives. Don't work on `main`.
4. **Execution:** Plans 1 and 2 were both built with **inline execution** (`superpowers:executing-plans`) at the user's request ("a native approach"), test-first, with one whole-branch review at the end. Confirm with the user for Plan 3.

## The project

Two parts, one repo (`https://github.com/Rojas49098588/capstone`, private):

- **`extension/`**: Chrome extension (Manifest V3, plain JS, no build step). One pet per project walks on every web page (cat, dog, frog, pigeon, turtle; art in `extension/assets/pets/`). Pets can be dragged and thrown, and each kind has its own behavior (naps, hops, flying). Clicking the toolbar icon opens Studium at `http://localhost:5173/`. Its project list is still a **hard-coded copy** (`PROJECTS` in `extension/content/pet.js`); Plan 3 replaces it with data from Studium.
- **`web/`**: **Studium**, a study/project planner (Vite 8 + React 19 + TypeScript 5.9 + Tailwind v4), originally a Figma Make export. The planner rules are in `web/src/planner/` and `web/src/store/` (Plan 1). The screens (Plan 2) are in `web/src/components/` and read and change data only through `useStudiumContext()` (`web/src/store/useStudium.tsx`), which saves every change to localStorage. `web/src/App.tsx` is just the shell (navigation, theme, modals, toast, notices).

The user is a student building this as their capstone. They make the product decisions and approve designs and plans before code is written. Explain choices in plain language. They chose test-first development, small commits, and a final independent review.

## Status

| Piece | State | Where |
|---|---|---|
| Spec (planner rules, screens, extension link) | Approved, includes requirement start dates | `docs/superpowers/specs/2026-10-14-studium-planner-design.md` |
| Plan 1: planner core (rules, saving, actions, example data) | **Done**, reviewed, 101 tests | merged into `main` (PR #1) |
| Plan 2: Studium screens | **Done**, reviewed (4 fixes after review), 183 tests, checked in a real browser (light, dark, 390 px) | branch `feature/studium-screens`; plan `docs/superpowers/plans/2026-10-15-studium-screens.md` |
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
  src/store/useStudium.tsx StudiumProvider + useStudiumContext: data, `now` (refreshed every minute), notices,
                           every action with the time filled in; saves after each change
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

**Habitat box (what Plan 3 hooks into):** `Habitat.tsx` renders `<div data-pet-habitat="<projectId>">`. If `data-pet-attached` isn't set on it within 1000 ms (`HABITAT_FALLBACK_MS`), it shows `public/pets/<petKind>.png`; a MutationObserver hides the still image again once the attribute appears.

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
- **`ProjectDetail` is keyed by project id**, so switching projects gives a fresh page and a fresh `[data-pet-habitat]` box. Plan 3: watch for the box being replaced, not just added. Also give the extension its own child element inside the box rather than writing into React's node.

Known small issues, deferred on purpose:
- A task checked off while unlinked never pays its own share, even after it's linked.
- Hand-edited saved data with weight ≤ 0 or negative estimates passes validation.
- Plan 2 review minors: a first completion that earns 0 tokens (pool used up) still says "already paid"; the habitat never brings the still image back if the extension removes `data-pet-attached`; "It hatched" repeats on each return until another project is opened; blocked tasks have no lock icon; TaskForm uses fixed element ids; `estimateMultipliers` is recomputed per card and render.

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

## Plan 3 scope

To be written with `superpowers:writing-plans` from spec section 5:
- Studium publishes each pet's status (`studium-pets-v1`).
- The content script copies it to `chrome.storage` and rebuilds pets from it, replacing the hard-coded `PROJECTS`.
- **Habitat mode:** on a Studium project page, every pet except that project's one hides, and that pet lives inside `[data-pet-habitat]` and sets `data-pet-attached`.
- Mood changes pet speed and sounds.

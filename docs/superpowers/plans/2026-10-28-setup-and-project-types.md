# First-Run Setup, Project Types and Pet Difficulty Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 4-step first-run setup, a type and a difficulty for each project (with per-type wording and per-difficulty mood thresholds), three pet interaction levels with a first sticky-note trick, a nickname, and a blank start with a first-project pop-up for new users.

**Architecture:** Project type and difficulty are new optional fields on `Project` (missing means School and Steady), resolved by helpers in a new `planner/projectKind.ts`. Wording comes from `projectWords(type)` in `ui/format.ts`. Mood reads per-difficulty thresholds from `tuning.ts`. User preferences (setup done, nickname, default type, default difficulty, interaction level) extend the existing `Settings`; the extension receives interaction level and nickname next to the existing screen settings and decides Minimal behavior and sticky notes in `logic.js` (pure) with drawing in `pet.js`.

**Tech Stack:** React 19, TypeScript 5.9, Vite 8, Tailwind v4, Vitest 5; Chrome MV3 extension in plain JS.

**Spec:** `docs/superpowers/specs/2026-10-28-setup-and-project-types-design.md`

## Global Constraints

- Planner and store functions take `now`; no `new Date()` inside them.
- All user-facing wording lives in `web/src/ui/format.ts` (extension wording in `extension/content/logic.js`).
- All tuning numbers live in `web/src/planner/tuning.ts`; the extension keeps its own copy where it needs one, with a test that keeps them equal.
- Tests first. `npm run build` and `npx vitest run --maxWorkers=4` pass at the end of every task.
- Nothing in `extension/` starts with `_`.
- Saved data stays `version: 1`. Old data loads unchanged: missing `type` = `"school"`, missing `difficulty` = `"steady"`.
- Old settings load: `difficulty` easy→gentle, medium→steady, hard→strict; `petInvolvement` notMuch→minimal, very→mild.
- An older extension ignores the new settings; a newer extension treats missing ones as Mild with no nickname.
- Work on a new branch `feature/setup-and-project-types` cut from `feature/pet-lifecycle`.

## Review Focus

1. **Existing user's first load after upgrade:** projects keep School wording and Steady thresholds, moods and tokens are identical to before, setup shows once with their current choices pre-selected, and the tutorial does not restart. (Pinned in Tasks 1, 2, 3 and 7.)
2. **Setup closed mid-way** (reload on step 2): nothing is half-saved; setup shows again from step 1. (Pinned in Task 7.)
3. **Blank start edge cases:** the Overview with zero projects renders without dividing by zero or showing "NaN%", and the first-project pop-up never stacks on setup or a tutorial. (Pinned in Task 4.)
4. **Nickname input:** spaces only, 21+ characters, or a name ending in "s". The heading must stay sensible ("Your Projects", trimmed to 20, "Chris's Projects"). (Pinned in Task 3.)
5. **Sticky notes across tabs:** two open tabs must not each leave a note inside the same 30 minutes. The last-note time lives in `chrome.storage.local`, not in page memory. (Pinned in Task 9.)

---

### Task 1: Project type and difficulty on projects

**Files:**
- Create: `web/src/planner/projectKind.ts`, `web/src/planner/projectKind.test.ts`
- Modify: `web/src/planner/types.ts` (Project), `web/src/store/actions.ts` (ProjectInput, createProject, updateProject), `web/src/store/storage.ts` (validation), `web/src/store/useStudium.tsx` (types only)
- Test: `web/src/store/actions.test.ts`, `web/src/store/storage.test.ts`

**Interfaces:**
- Produces:
  - `export type ProjectType = "school" | "writing" | "art" | "code" | "music" | "other"` and `PROJECT_TYPES: readonly ProjectType[]` in `types.ts`.
  - `export type Difficulty = "gentle" | "steady" | "strict"` and `DIFFICULTY_LEVELS: readonly Difficulty[]` in `types.ts`.
  - `Project.type?: ProjectType` and `Project.difficulty?: Difficulty`.
  - `projectType(p: Project): ProjectType` (missing → `"school"`), `projectDifficulty(p: Project): Difficulty` (missing → `"steady"`) in `projectKind.ts`.
  - `ProjectInput` gains optional `type` and `difficulty`; `createProject` saves them only when given. `updateProject` accepts `type` and `difficulty` changes and ignores values not in the lists.

- [ ] **Step 1: Write the failing tests**
  - `projectKind.test.ts`: `"an old project is School and Steady"`: `projectType(makeProject())` is `"school"`, `projectDifficulty(makeProject())` is `"steady"`. `"uses the saved values"` for `{ type: "writing", difficulty: "strict" }`.
  - `actions.test.ts`: `"a new project keeps its type and difficulty"`: `createProject(seed, { ...input, type: "art", difficulty: "gentle" }, NOW).project` has both. `"updateProject changes type and difficulty and ignores unknown values"`: `{ type: "music" }` applies; `{ difficulty: "brutal" as never }` leaves it unchanged.
  - `storage.test.ts`: `"loads projects saved before types existed unchanged"` (no `type`/`difficulty` keys after load); `"rejects an unknown type or difficulty"`.
- [ ] **Step 2: Run them.** `npx vitest run src/planner/projectKind.test.ts src/store/actions.test.ts src/store/storage.test.ts`. Expected: FAIL (module missing; unknown fields).
- [ ] **Step 3: Implement** the types, helpers, action changes and storage checks (`type` missing or in `PROJECT_TYPES`; `difficulty` missing or in `DIFFICULTY_LEVELS`).
- [ ] **Step 4: Run them.** Same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat: projects have a type and a difficulty`.

### Task 2: Difficulty sets the mood thresholds

**Files:**
- Modify: `web/src/planner/tuning.ts`, `web/src/planner/mood.ts`, `web/src/components/RequirementCard.tsx`
- Test: `web/src/planner/mood.test.ts`, `web/src/components/RequirementCard.test.tsx` (create if missing; otherwise the existing card tests)

**Interfaces:**
- Consumes: `Difficulty`, `projectDifficulty` (Task 1).
- Produces:
  - `DIFFICULTY_RULES: Record<Difficulty, { worriedGap: number; upsetGap: number; neglectDays: number; sickDays: number }>` in `tuning.ts`: gentle `{ -20, -40, 14, 28 }`, steady `{ -10, -25, 7, 14 }`, strict `{ -5, -15, 4, 7 }`. `WORRIED_GAP`, `UPSET_GAP`, `NEGLECT_DAYS` and `SICK_DAYS` stay exported and equal to the steady values.
  - `moodFromGap(gap: number, difficulty: Difficulty = "steady"): Mood`.
  - `neglectDays(project: Project): number` and `sickDays(project: Project): number` in `mood.ts`.
  - `neglectedRequirements` defaults `minDays` to the project's `neglectDays`; `projectHealth` uses `sickDays`.

- [ ] **Step 1: Write the failing tests** in `mood.test.ts`:
  - `"each difficulty has its own Worried and Upset lines"`: `moodFromGap(-15, "gentle")` Happy, `moodFromGap(-15)` Worried, `moodFromGap(-15, "strict")` Upset; `moodFromGap(-30, "gentle")` Worried; `moodFromGap(-6, "strict")` Worried.
  - `"a strict pet gets neglected and sick sooner"`: a strict project with a requirement idle 4 days has one neglected requirement; idle 7 days is sick. The same data as steady: neither at 4 days, neglected (not sick) at 7.
  - `"a gentle pet isn't sick after 14 idle days"`; it is at 28.
  - `"a project with no difficulty behaves exactly as before"`: `projectMood` for an existing seed project is equal before and after (compare with steady explicitly set).
  - `RequirementCard`: `"shows days idle using the project's difficulty"`: a strict project's card shows the idle label at 4 days.
- [ ] **Step 2: Run them.** `npx vitest run src/planner/mood.test.ts src/components/RequirementCard.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.** `projectMood` passes the project's difficulty to `moodFromGap`. `RequirementCard` replaces `NEGLECT_DAYS` with `neglectDays(project)`.
- [ ] **Step 4: Run them**, then the full suite. Expected: PASS.
- [ ] **Step 5: Commit** `feat: pet difficulty sets mood, neglect and sickness thresholds`.

### Task 3: Settings: new preferences, old values mapped

**Files:**
- Modify: `web/src/store/settings.ts`, `web/src/components/Settings.tsx`, `web/src/ui/format.ts`
- Test: `web/src/store/settings.test.ts`, `web/src/components/Settings.test.tsx`, `web/src/ui/format.test.ts`

**Interfaces:**
- Consumes: `Difficulty`, `ProjectType` (Task 1).
- Produces:
  - `Settings` loses its own `Difficulty` type and uses the planner's. New and changed fields: `difficulty: Difficulty` (default `"steady"`), `petInvolvement: "minimal" | "mild" | "moderate"` (default `"mild"`), `nickname: string` (default `""`), `projectType: ProjectType` (default `"school"`), `setupDone: boolean` (default `false`).
  - `parseSettings` maps old values: `easy→gentle`, `medium→steady`, `hard→strict`, `notMuch→minimal`, `very→mild`. `nickname` is trimmed and cut to `NICKNAME_MAX = 20` (in `tuning.ts`).
  - `format.ts`: `DIFFICULTY_LABELS`, `DIFFICULTY_HINTS`, `INVOLVEMENT_LABELS`, `INVOLVEMENT_HINTS` (Moderate's hint includes "More mischief coming in a future update"), `PROJECT_TYPE_LABELS` (School, Writing, Art & design, Code, Music, Something else), and `projectsHeading(nickname: string): string`.
  - Settings screen: "Default difficulty for new projects", "How much pets interact" (3 choices with hints), "Nickname" text field, "Default project type".

- [ ] **Step 1: Write the failing tests**
  - `settings.test.ts`: update the defaults test to `steady`, `mild`, `""`, `"school"`, `setupDone: false`. Add `"maps settings saved before setup"` (`{ difficulty: "hard", petInvolvement: "notMuch" }` → `strict`, `minimal`; `{ difficulty: "easy", petInvolvement: "very" }` → `gentle`, `mild`). Add `"trims and shortens the nickname"` (`"  Abby  "` → `"Abby"`; 25 letters → 20; a number → `""`).
  - `format.test.ts`: `projectsHeading("")` is `"Your Projects"`, `"   "` is `"Your Projects"`, `"Abby"` is `"Abby's Projects"`, `"Chris"` is `"Chris's Projects"`.
  - `Settings.test.tsx`: update the defaults test; `"saves the nickname and the default project type"`.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them**, then the full suite. Expected: PASS.
- [ ] **Step 5: Commit** `feat: settings for nickname, default type and difficulty, three interaction levels`.

### Task 4: Blank start, nickname heading and first-project pop-up

**Files:**
- Modify: `web/src/store/storage.ts`, `web/src/store/seed.ts` (export `emptyData(now: Date): StudiumData`), `web/src/components/Overview.tsx`, `web/src/App.tsx`, `web/src/ui/format.ts`
- Create: `web/src/components/FirstProjectPrompt.tsx`
- Test: `web/src/store/storage.test.ts`, `web/src/components/Overview.test.tsx`, `web/src/App.test.tsx`

**Interfaces:**
- Consumes: `projectsHeading`, `settings.nickname`, `settings.setupDone` (Task 3).
- Produces:
  - `emptyData(now)`: version 1, no projects, requirements, tasks or decor, `defaultBeds: true`, the same starting tokens as the seed.
  - `loadData` with nothing stored returns `emptyData`. Storage unavailable and damaged data still use `buildSeed`.
  - Overview: heading from `projectsHeading`. With no projects, an empty state with a "New project" button (`onNewProject` prop). The total shows `0%`.
  - `FirstProjectPrompt({ onCreate, onClose })`: a dialog that says the user can start by creating their first project, with "Create my first project" and "Not now".
  - App shows it when: page is the Overview, there are no projects, `setupDone` is true, no tour step is showing, and no modal is open. "Not now" hides it until the Overview opens again.

- [ ] **Step 1: Write the failing tests**
  - `storage.test.ts`: change `"starts with the example data…"` to `"starts with no projects and saves that when nothing is stored"`. Keep the unavailable and damaged tests expecting the seed.
  - `Overview.test.tsx`: `"uses the nickname in the heading"`; `"with no projects shows 0% and a New project button"` (no "NaN" anywhere in the document text).
  - `App.test.tsx`:
    - `"a new user who finished setup is asked to create a first project"`: its button opens the New Project form.
    - `"Not now closes it, and it returns when the Overview opens again"`.
    - `"never shows over setup or once a project exists"`.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.** Check every test that rendered App with no stored data and relied on the seed; give those tests the seed explicitly through `renderWithStudium`'s `data` option.
- [ ] **Step 4: Run them**, then the full suite. Expected: PASS.
- [ ] **Step 5: Commit** `feat: new users start blank, with a prompt to create their first project`.

### Task 5: Type and difficulty in the project form

**Files:**
- Modify: `web/src/components/ProjectModal.tsx`, `web/src/ui/format.ts`
- Test: `web/src/components/ProjectModal.test.tsx`

**Interfaces:**
- Consumes: `PROJECT_TYPE_LABELS`, `DIFFICULTY_LABELS`, `DIFFICULTY_HINTS` (Task 3); `ProjectInput.type/difficulty`, `updateProject` (Task 1).
- Produces: the form has a **Type** choice and a **Difficulty** choice (radio groups, like Color). A new project pre-selects `settings.projectType` and `settings.difficulty`. Editing pre-selects the project's own values (`projectType(p)`, `projectDifficulty(p)`) and saves changes.

- [ ] **Step 1: Write the failing tests:**
  - `"a new project starts with the default type and difficulty from settings"`: settings Writing + Strict give a created project with `type: "writing"` and `difficulty: "strict"`.
  - `"editing changes a project's type and difficulty"`.
  - `"editing an old project shows School and Steady"`.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them**, then the full suite. Expected: PASS.
- [ ] **Step 5: Commit** `feat: choose a project's type and difficulty`.

### Task 6: Each project type's own words

**Files:**
- Modify: `web/src/ui/format.ts`, `web/src/components/RequirementsSection.tsx`, `RequirementCard.tsx`, `RequirementForm.tsx`, `TaskForm.tsx`, `TaskRow.tsx`, `Habitat.tsx`, `ProjectModal.tsx`
- Test: `web/src/ui/format.test.ts`, `web/src/components/ProjectDetail.test.tsx`, `web/src/components/Habitat.test.tsx`

**Interfaces:**
- Consumes: `projectType` (Task 1).
- Produces:
  - `export type ProjectWords = { requirement: string; requirements: string; task: string; tasks: string }` (lower case).
  - `projectWords(type: ProjectType): ProjectWords`, using the spec's table: school requirement/task, writing chapter/scene, art piece/step, code feature/task, music track/task, other milestone/task. Plurals add "s".
  - `capitalize(word: string): string`.
  - `hatchHint(n, words = projectWords("school"))` and `eggCompanionLabel(words = …)` use the project's words.
- Every user-visible string in the listed components that names a requirement or task uses the project's words: section headings, buttons ("Add chapter", "Save scene"), placeholders, errors ("Give the chapter a title."), the delete question, "Link to a chapter…", and the aria-labels that contain them. Screens that mix projects (Overview, Today, Suggested next, Shop, tutorial, token messages) keep the plain words.

- [ ] **Step 1: Write the failing tests**
  - `format.test.ts`: `"every type has its words"` (table check), and `hatchHint(2, projectWords("writing"))` is `"Add 2 more chapters to hatch"`, `hatchHint(1, …)` is `"Add 1 more chapter to hatch"`.
  - `ProjectDetail.test.tsx`: `"a Writing project says chapters and scenes"`. The form button is "Add chapter", and adding one shows a card with an "Add scene" button.
  - `ProjectDetail.test.tsx`: `"a School project keeps today's words"`.
  - `Habitat.test.tsx`: `"an Art egg asks for more pieces"`.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.** Existing tests that look up "Add requirement" and similar keep passing, because seed projects are School.
- [ ] **Step 4: Run them**, then the full suite. Expected: PASS.
- [ ] **Step 5: Commit** `feat: project types use their own words for requirements and tasks`.

### Task 7: The 4-step setup

**Files:**
- Create: `web/src/components/Setup.tsx`, `web/src/components/Setup.test.tsx`
- Modify: `web/src/App.tsx`, `web/src/ui/format.ts`

**Interfaces:**
- Consumes: settings fields (Task 3), `PROJECT_TYPE_LABELS`, the label and hint lists (Task 3).
- Produces:
  - `Setup({ theme, onTheme, onFinish })`. `onTheme(t)` switches the app's theme immediately. `onFinish` runs after one `updateSettings` call that saves `projectType`, `nickname`, `difficulty`, `petInvolvement`, `progressStyle` and `setupDone: true` together.
  - The steps:
    1. "What do you make?": 6 choices.
    2. "What should we call you?": an optional nickname.
    3. "Your pets": difficulty and interaction level, each with its hint.
    4. "Your look": Bars and Rings as two stacked previews that copy the Overview's Total Progress (sample projects, round dots, name left and percentage right for bars; nested rings with a legend), plus Light/Dark.
  - Every step shows "Step N of 4", has Back (from step 2) and Continue, and ends with "Start using Studium".
  - Pre-selection comes from the current settings. Before setup, those are the defaults (School, blank, Steady, Mild, Rings, the current theme), or an existing user's saved values.
  - App renders only `Setup`, full-screen, while `!settings.setupDone`. It renders no tour and no first-project prompt until setup is done.

- [ ] **Step 1: Write the failing tests** in `Setup.test.tsx`:
  - `"walks through 4 steps and saves every answer at the end"`: pick Art & design, type "Abby", Strict, Moderate, Bars, Dark, then finish. Settings hold all of them plus `setupDone: true`.
  - `"saves nothing until the last step"`: after step 2, the stored settings are unchanged.
  - `"pre-selects an existing user's settings"`: Bars and Minimal are already checked.
  - `"Back returns to the previous step with its answer kept"`.
  - `"Moderate says more mischief is coming"`.
  - `"choosing Dark switches the theme right away"`: `onTheme` is called with `"dark"` before finishing.
  - In `App.test.tsx`:
    - `"shows setup first for someone who hasn't done it"`;
    - `"an existing user with projects sees setup once, then their Overview, with no tutorial"` (`tutorialDone: true` stays true);
    - `"reloading mid-setup starts setup again"`.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.** Existing App tests that don't test setup need `setupDone: true` in their stored settings; add it in `renderWithStudium`'s default settings, if it has them, or in each App test's setup.
- [ ] **Step 4: Run them**, then the full suite. Expected: PASS.
- [ ] **Step 5: Commit** `feat: first-run setup in four steps`.

### Task 8: The extension learns the interaction level; Minimal pets stay quiet

**Files:**
- Modify: `extension/content/logic.js`, `extension/content/pet.js`, `web/src/store/settings.ts` (comment only)
- Test: `web/src/extension/petLogic.test.ts`, `web/src/extension/petScript.test.ts`

**Interfaces:**
- Consumes: the setting names `petInvolvement` and `nickname` (Task 3).
- Produces:
  - `INVOLVEMENTS = ['minimal', 'mild', 'moderate']`.
  - `prefsFromSettings(raw): { involvement, nickname }`: invalid or missing gives `'mild'` and `''`; an old `'notMuch'` gives `'minimal'` and `'very'` gives `'mild'`; the nickname is trimmed and cut to 20.
  - `cleanPrefs(v)`.
  - All three are exported on `PetLogic`.
  - `pet.js` copies the prefs to `chrome.storage.local.petPrefs` in `copySettingsFromStudium`, loads them in `load()` and follows changes.
  - Minimal, on web pages (not in a habitat box): `act()` keeps the pet idle in place (no walk, hop, fly or self-started nap), there are no "Haven't seen…" idle messages, and `celebrate()` does nothing. Focus naps, check-ins, the menu and dragging are unchanged. In a habitat box, behavior is the same as Mild.

- [ ] **Step 1: Write the failing tests**
  - `petLogic.test.ts`: `"prefsFromSettings reads the interaction level and nickname"`, covering valid values, old values, damaged JSON and missing.
  - `petScript.test.ts`, using its existing harness for the content script:
    - `"a Minimal pet doesn't walk or celebrate on a web page"`;
    - `"a Minimal pet still behaves normally in its habitat"`;
    - `"a Mild pet is unchanged"`.
- [ ] **Step 2: Run them.** `npx vitest run src/extension`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them**, then the full suite. Expected: PASS.
- [ ] **Step 5: Commit** `feat(extension): interaction level reaches the pets; Minimal pets stay quiet`.

### Task 9: Sticky notes for Moderate

**Files:**
- Modify: `extension/content/logic.js`, `extension/content/pet.js`
- Test: `web/src/extension/petLogic.test.ts`, `web/src/extension/petScript.test.ts`

**Interfaces:**
- Consumes: `prefs` (Task 8); the status fields `idleRequirement`, `deadline`, `shortName` and `stage`; `isQuiet(petAway)`.
- Produces:
  - `NOTE_GAP_MS = 30 * 60 * 1000` and `NOTE_DUE_SOON_DAYS = 3`.
  - `noteText(status, nickname, today)`: a string or null.
    - Idle requirement first: `"Abby, portraits misses you: 5 days since you worked on it."` Without a nickname, it starts `"portraits misses you…"`.
    - Then a deadline within 0–3 days: `"Abby, novel is due in 3 days."`, `"…is due tomorrow."` or `"…is due today."`
    - Otherwise null.
  - `chooseNote({ statuses, shown, prefs, petAway, lastNoteAt, now, today, onStudium, noteOpen })`: `{ projectId, text }` or null. It returns null when:
    - involvement isn't moderate;
    - the page is Studium;
    - a note is open;
    - `isQuiet(petAway)`;
    - `now - lastNoteAt < NOTE_GAP_MS`.
    Otherwise it returns the first shown, hatched pet (status order) with a non-null `noteText`.
  - `pet.js`:
    - checks `chooseNote` about once a minute;
    - `lastNoteAt` is read from and written to `chrome.storage.local.petNoteAt` when a note is placed, so tabs share it;
    - the chosen pet walks to the left or right quarter of the window and leaves a note element in the shadow root: a yellow square with the text and a "×" close button labeled "Close note";
    - the note is pinned in the lower third of the window, never over the middle half;
    - closing removes it; it's also removed when the pet goes away for a nap.

- [ ] **Step 1: Write the failing tests**
  - `petLogic.test.ts`:
    - `"noteText prefers an idle requirement, then a near deadline"`, with and without a nickname, and due in 3 days, tomorrow, today, in 4 days (null) and overdue (null);
    - `"chooseNote only for Moderate, off Studium, with no nap, no open note and 30 minutes since the last one"`, one assertion per condition;
    - `"chooseNote skips pets with nothing to say and pets that aren't shown"`.
  - `petScript.test.ts`:
    - `"a Moderate pet leaves a note that can be closed"`;
    - `"no note during a focus nap"`;
    - `"the last-note time is shared through chrome.storage"`: a second content script sees `petNoteAt` and leaves no note.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them**, then the full suite. Expected: PASS.
- [ ] **Step 5: Commit** `feat(extension): Moderate pets leave sticky notes about your work`.

### Task 10: Docs, tour wording and the browser check

**Files:**
- Modify: `HANDOFF.md`, `README.md`, `web/src/ui/tourSteps.ts` (only if a step assumes other projects exist), `web/src/store/settings.ts` (header comment)
- Test: Playwright script in the session scratchpad (not committed), the same approach as the pet-lifecycle check.

- [ ] **Step 1:** Update HANDOFF (status row, decisions, the new settings and project fields) and README. Read through every tour step for a user whose only project is the one just created, and fix any wording that assumes more.
- [ ] **Step 2: Browser check**, with the real extension:
  - a fresh profile shows setup, then the first-project pop-up, then the New Project form, then the tutorial;
  - a Writing project says "Add chapter";
  - Minimal: the pet stays put on a web page and doesn't hop when a task is completed;
  - Mild: unchanged;
  - Moderate: with the 30-minute gap shortened through `chrome.storage.local.petNoteAt` set in the past, a note appears, closes, and doesn't appear during a nap;
  - an existing profile with the five projects sees setup once, then its unchanged Overview.
- [ ] **Step 3:** Run `npm run build` and `npx vitest run --maxWorkers=4`. Expected: both pass.
- [ ] **Step 4: Commit** `docs: setup, project types and difficulty in handoff and readme`.

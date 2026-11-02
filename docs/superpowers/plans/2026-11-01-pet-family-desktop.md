# Pet Family, Part 2 (desktop) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every hatched pet, bought ones included, roams the desktop with the full menu, naps, check-ins and Week 3's mischief. "Open project" opens the project page scrolled to that pet's habitat.

**Architecture:** Studium sends one status per hatched pet, each with a `petId`. The first pet's `petId` is the project id, so every saved key (positions, `petAway`, celebrations seen, `pet-state.json`) keeps working. The pet code (`extension/content/logic.js`, `pet.js`) and the desktop main process key pets by `petId` everywhere. They keep `projectId` only where a *project* is meant: focus sessions, Studium links, the project's name and color. The Studium window can now hold several habitat boxes, so `petHabitat` becomes a list of habitat ids.

**Tech Stack:** Plain JS pet code (`extension/content/`) tested by Vitest in `web/src/extension/`. Electron main (`desktop/src/main/`) tested by Vitest in `desktop/test/` and Playwright in `desktop/e2e/`. React web app (`web/`).

**Spec:** `docs/superpowers/specs/2026-11-01-pet-family-design.md` (goal 6, Constraints). Part 1 plan: `docs/superpowers/plans/2026-11-01-pet-family-studium.md`.

## Global Constraints

- Branch `feature/pet-family-desktop` from `feature/pet-family` (Part 1, PR open). Commit per task; push after the final review.
- **The first pet's id stays the project id.** State saved before this round must keep working:
  - `petAway` entries keyed by project id without a `projectId` field;
  - a `petCheckIn` without `petId`;
  - positions;
  - a message carrying only `projectId` (treated as that project's first pet).
- One nap at a time across all pets stays the rule.
- Focus sessions always carry the **project** id. Studium drops sessions for unknown projects (`recordFocusSessions`).
- Extra pets count toward "Pets on screen at once" (`petScreen.limit`).
- Studium links: `#project=<projectId>` (unchanged) and `#project=<projectId>&pet=<petId>` (new; scrolls to that habitat). `#complete=<taskId>` is unchanged.
- The retired browser extension (`extension/background.js`) must keep working with the changed messages, but needn't be tested by hand.
- Desktop version goes to `0.7.0`.

## Review Focus

1. **State saved by 0.6.0** must still work after the update: a nap keyed by project id with no `projectId` in the entry, a check-in without `petId`, and a request with only `projectId`. The nap still ends, records its focus session under the project, and the check-in still shows. Pinned in Task 2.
2. **A bought pet's nap** records its focus session under its **project** id, never its pet id (Studium would drop it). Pinned in Task 2.
3. **A hatched pet not named yet** shows its suggested name ("Frog") on the desktop label, menus and tray, never an id. Pinned in Task 1.
4. **The Studium window showing a project with two pets:** both pets are in their own boxes and both are left out of the overlay. Switching to another project lets both back onto the desktop. Pinned in Tasks 2 and 3.
5. **A pet that disappears while away** (its project deleted): its nap ends on the next alarm/overdue check without crashing, and the tray's wake entry uses a fallback name. Pinned in Task 2.

---

### Task 1: One status per hatched pet

**Files:**
- Modify: `web/src/store/petStatus.ts`
- Test: `web/src/store/petStatus.test.ts`

**Interfaces:**
- Consumes (Part 1, `web/src/planner/pets.ts`): `petsOf`, `petMood`, `suggestedPetName`, `PetRef`.
- Produces: `PetStatus` gains `petId: string`. One status per **hatched** pet, in project order, then pet order. For a bought pet:
  - `petId` = its id;
  - `shortName` = its name, or `suggestedPetName` while unnamed (this is the label pets show);
  - `name`, `color`, `deadline` = its project's;
  - `petKind` = its kind; `stage` = its stage;
  - `mood`/`recovering`/`idleRequirement` from `petMood`;
  - `furniture` from `decor[petId]` for its kind;
  - `suggestion`, `napTasks` and `celebration` from its scope: the project's for a sharing pet; only tasks/completions of its `caresFor` requirement for a pet that looks after one.

  The first pet's status is unchanged apart from `petId` = project id.

- [ ] **Step 1: Branch.** `git switch -c feature/pet-family-desktop feature/pet-family`

- [ ] **Step 2: Write failing tests** (`petStatus.test.ts`). Replace Part 1's "aren't sent to the desktop yet" test with:
  - A project with a hatched pet `x1` and an egg `x2` gives statuses `[{ petId: "p1", projectId: "p1" }, { petId: "x1", projectId: "p1" }]` (by `toMatchObject`). The egg is left out.
  - An unnamed hatched frog's `shortName` is `"Frog"`; a named one's is its name (Review Focus 3).
  - A pet looking after `r2`:
    - its `suggestion` and every `napTasks` entry are `r2` tasks;
    - its `celebration` is the latest `r2` completion (null if none);
    - its `mood` equals `petMood(...)`'s.
  - A sharing pet gets the same `suggestion`, `napTasks`, `celebration` and `mood` as the first pet.
  - `furniture` reads `decor.x1`: a log placed there gives a frog `[{ use: "lounge", slot }]`.

- [ ] **Step 3: Run** `cd web && npx vitest run src/store/petStatus.test.ts`. Expected: the new tests fail.

- [ ] **Step 4: Implement.**
  - `suggestionsByProject` and `napTasksByProject` keep working per project. Add `suggestionFor(projectId, requirementId | null)` and `napTasksFor(...)` built from the same walk, filtering by `task.requirementId`. `napTasksFor` keeps up to `NAP_SUGGESTED_MAX` suggested tasks *after* filtering.
  - `celebrationsByProject` gets a requirement-scoped twin keyed by requirement id (same walk, keyed by `e.requirementId`).
  - `furnitureFor(habitatId, kind, data)` replaces the project-based one.

- [ ] **Step 5: Run** `npx vitest run` and `npx tsc --noEmit` in `web/`. Expected: all pass.

- [ ] **Step 6: Commit.** `git commit -m "feat(pets): one pet status per hatched pet, keyed by pet id"`

---

### Task 2: The pet rules key pets by pet id (`logic.js`)

**Files:**
- Modify: `extension/content/logic.js`
- Test: `web/src/extension/petLogic.test.ts`, `petInteractions.test.ts`, `petLimit.test.ts`, `mischief.test.ts`, and any other `web/src/extension/*.test.ts` whose assertions name `projectId` as a pet key (update them to `petId`)

**Interfaces:**
- Consumes: statuses with `petId` (Task 1).
- Produces (all exported on `PetLogic` as today):
  - `cleanStatus`: adds `petId` (`p.petId` if text, else `p.projectId`). `parseStatuses` drops duplicates by `petId`.
  - `parseRequest`:
    - nap/wake/sleep/openProject requests carry `petId`. It accepts `msg.petId`, or `msg.projectId` when `petId` is missing (old callers), and always returns `{ type, petId, ... }`.
    - `{ type: 'end', petId }` comes from alarms (alarm name stays `away:<id>`).
  - `petAway[petId]` entries gain `projectId` (from the status at the start). `cleanAway` keeps it if text, else leaves it out.
  - `focusOutbox` sessions' `projectId` = `entry.projectId ?? <the petAway key>` (Review Focus 1, 2).
  - `petCheckIn` = `{ petId, projectId, taskId, taskTitle, minutes, at, finished? }`. `parseCheckIn` fills a missing `petId` from `projectId`.
  - The check-in "done" link: `complete=<taskId>`, else `projectLink(projectId, petId)`.
  - `projectLink(projectId: string, petId: string): string`: `project=<enc projectId>`, plus `&pet=<enc petId>` when they differ.
  - `petMenuItems(petId, petAway, statuses)`, `wakeMenuEntries` (ids `wake:<petId>`; title uses the status's `shortName`, else `"your pet"` for a pet with no status; Review Focus 5).
  - `newCelebrations` returns `seen` keyed by `petId` and `celebrate: [{ petId, kind }]`.
  - `chooseNote` returns `{ petId, projectId, text, signature, color }`.
  - `petsOnScreen` returns a `Set` of pet ids.
  - `shownPets({ surface, pets, petAway, screen, boxIds: string[], liveHabitats: string[] })`:
    - overlay: leaves out every pet in `liveHabitats`;
    - with `boxIds` non-empty: shows exactly the pets with those ids;
    - habitat surface with no boxes: shows none.
  - `chooseOpenProject` returns `{ projectId, petId } | null`.
- `endOverdue`/`end` for a pet whose status is gone still ends the nap and records the session under `entry.projectId ?? key` (Review Focus 5).

- [ ] **Step 1: Write failing tests** (in `petLogic.test.ts` / `petInteractions.test.ts`, in their style):
  - `parseStatuses` gives two statuses for one project with `petId`s `p1` and `x1`; a status without `petId` gets `petId` = `projectId`.
  - `parseRequest({ type: 'nap', projectId: 'p1', taskId: null })` → `{ type: 'nap', petId: 'p1', taskId: null }`; `{ type: 'nap', petId: 'x1', taskId: null }` → `petId: 'x1'`.
  - Napping `x1` (project `p1`) then `end` → the outbox session has `projectId: 'p1'`, and the check-in is `{ petId: 'x1', projectId: 'p1' }`.
  - An old `petAway` `{ p1: { kind: 'nap', … no projectId } }` ending → session `projectId: 'p1'`. An old `petCheckIn` without `petId` parses with `petId: 'p1'`.
  - `x1` napping blocks a nap for `p1` (one nap at a time).
  - Check-in "done" with no task opens `project=p1&pet=x1`; for the first pet, `project=p1`.
  - `projectLink('p 1', 'x1')` → `project=p%201&pet=x1`; `projectLink('p1', 'p1')` → `project=p1`.
  - `shownPets` overlay with `liveHabitats: ['p1', 'x1']` leaves out both; habitat surface with `boxIds: ['p1', 'x1']` shows both.
  - `wakeMenuEntries({ ghost: entry }, statuses)` → `[{ id: 'wake:ghost', title: 'Wake your pet' }]`.
  - `chooseOpenProject` with a sick bought pet → `{ projectId: 'p1', petId: 'x1' }`.

  Then update existing assertions that read `projectId` as the pet key to `petId`.

- [ ] **Step 2: Run** `cd web && npx vitest run src/extension`. Expected: the new tests fail.

- [ ] **Step 3: Implement** in `logic.js`. Rename the internal pet-key parameters to `petId`. Keep `projectId` only for the project.

- [ ] **Step 4: Run** `npx vitest run src/extension`. Expected: logic tests pass. Script tests (`pet*Script.test.ts`) may still fail until Task 3. List them in the commit message.

- [ ] **Step 5: Commit.** `git commit -m "feat(pets): pet rules key pets by pet id; focus sessions keep the project"`

---

### Task 3: `pet.js` with several pets per project and several habitat boxes

**Files:**
- Modify: `extension/content/pet.js`, `extension/background.js`
- Test: `web/src/extension/petHabitatScript.test.ts`, `petOverlayScript.test.ts`, `petNapChoiceScript.test.ts`, `petNotesScript.test.ts`, `petDesktopNotesScript.test.ts`, `petScript.test.ts` (update and add)

**Interfaces:**
- Consumes: Task 2's `petId` API.
- Produces:
  - A pet's `id` is `status.petId`. Every message `pet.js` sends uses `petId` (nap, sleep, wake, openProject).
  - Notes, nap-asks and check-ins are keyed by `petId`.
  - The Studium-window habitat report becomes `{ type: 'habitat', ids: string[] }`, listing every `[data-pet-habitat]` box on the page in DOM order.
  - `petHabitat` (desktop state) is read as a list: an array of strings. An old single string becomes `[string]`; anything else becomes `[]`.
- Habitat mode handles **every** `[data-pet-habitat]` box on the page:
  - each pet enters the box whose `data-pet-habitat` equals its `petId`;
  - each box gets its own `data-pet-attached`/`data-pet-away`;
  - a box that leaves the DOM is let go.

  The clip path covers the union of the visible boxes (the bounding rectangle of all boxes, passed to `habitatClip`).
- `extension/background.js`: `openProject` opens `projectLink(status.projectId, petId)`, using the status found by `petId` (fall back to `project=<petId>`). Wake menu ids use `petId`.

- [ ] **Step 1: Write failing tests**
  - `petHabitatScript.test.ts`: a page with two boxes `p1` and `x1` and statuses for both. Both boxes get `data-pet-attached`. The report sent is `{ type: 'habitat', ids: ['p1', 'x1'] }`. Removing the `x1` box reports `['p1']` and the `x1` pet leaves its box.
  - `petOverlayScript.test.ts`: with `petHabitat: ['p1', 'x1']` the overlay shows neither. With the old `petHabitat: 'p1'` it hides `p1` only (Review Focus 4).
  - `petNapChoiceScript.test.ts`: napping the bought pet sends `{ type: 'nap', petId: 'x1', taskId }`.
  - Its menu's Open project sends `{ type: 'openProject', petId: 'x1' }`.

- [ ] **Step 2: Run** `cd web && npx vitest run src/extension`. Expected: the new tests fail.

- [ ] **Step 3: Implement** as above.

- [ ] **Step 4: Run** `npx vitest run` in `web/`. Expected: all pass, including Task 2's script tests.

- [ ] **Step 5: Commit.** `git commit -m "feat(pets): bought pets on the page and in every habitat box"`

---

### Task 4: The desktop main process speaks pet ids

**Files:**
- Modify: `desktop/src/main/habitat.js`, `petChannel.js`, `bridge.js`, `tray.js`, `away.js`, `mischief.js`
- Test: `desktop/test/habitat.test.js`, `petChannel.test.js`, `bridge.test.js`, `tray.test.js`, `away.test.js`, `mischief.test.js`; `desktop/e2e/habitat.spec.js` (add one case)

**Interfaces:**
- Consumes: Task 2 (`parseRequest` with `petId`, `projectLink`, `chooseOpenProject` → `{ projectId, petId }`); Task 3's habitat report `{ type: 'habitat', ids }`.
- Produces:
  - `createHabitatTracker(onChange)`: `report(ids: string[])` (non-string entries dropped; a string is treated as `[string]`). `get()` returns the list while the window is visible and not minimized, else `[]`. `onChange` fires only when the list changes (compare joined).
  - `handlePetMessage`: a `habitat` message from `studium` reports `msg.ids`. `openProject` opens `projectLink(status.projectId, request.petId)`, where the status is found in the stored statuses by `petId`. When the status is missing it falls back to `project=<petId>`. `handlePetMessage` takes a `statuses()` getter in its deps.
  - `bridge.js`: Studium's wake event payload is a habitat id, sent as `{ type: 'wake', petId: payload }`.
  - `tray.js`: `wake:<petId>` → `{ type: 'wake', petId }`.
  - `away.js`: alarm `away:<id>` → `{ type: 'end', petId: id }`.
  - `mischief.js`: opens `projectLink(choice.projectId, choice.petId)`.

- [ ] **Step 1: Write failing tests**
  - habitat: `report(['p1', 'x1'])` with the window visible → `get()` is `['p1', 'x1']` and `onChange` fired once. Reporting the same list again doesn't fire. Minimized → `[]`.
  - petChannel:
    - `{ type: 'habitat', ids: ['p1', 'x1'] }` from studium reports that list;
    - `openProject` for `x1` (status project `p1`) opens `project=p1&pet=x1`;
    - an unknown pet opens `project=<id>`.
  - bridge / tray / away: each request uses `petId`.
  - mischief: a sick bought pet opens `project=p1&pet=x1`.
  - e2e `habitat.spec.js`: a project with a bought, hatched pet. Opening its page puts both pets in their boxes, and the overlay shows neither.

- [ ] **Step 2: Run** `cd desktop && npx vitest run`. Expected: the new tests fail.

- [ ] **Step 3: Implement** as above. Wire `statuses()` in `main.js` from the store's `petStatuses`.

- [ ] **Step 4: Run** `npx vitest run`, then `npm run e2e` (check `package.json` for the e2e script name; unset `ELECTRON_RUN_AS_NODE`). Expected: all pass.

- [ ] **Step 5: Commit.** `git commit -m "feat(desktop): pet ids in the main process; Studium shows every habitat's pet"`

---

### Task 5: Studium scrolls to a pet's habitat

**Files:**
- Modify: `web/src/ui/hashLinks.ts`, `web/src/App.tsx`
- Test: `web/src/ui/hashLinks.test.ts`, `web/src/App.test.tsx`

**Interfaces:**
- Produces: `HashLink` = `{ kind: "project"; id: string; pet?: string } | { kind: "complete"; id: string }`. `parseHashLink("#project=p1&pet=x1")` → `{ kind: "project", id: "p1", pet: "x1" }`.
- App: after opening the project for a link with `pet`, it scrolls that habitat into view on the next frame (`document.querySelector('[data-pet-habitat="<pet>"]')?.scrollIntoView({ block: "center" })`; the id is escaped with `CSS.escape` where available). An unknown pet just opens the project.

- [ ] **Step 1: Write failing tests**
  - `parseHashLink`:
    - `#project=p1&pet=x1` gives `pet: "x1"`;
    - `#project=p%201&pet=x%201` decodes both;
    - `#project=p1` has no `pet`;
    - `#project=p1&pet=` has no `pet`.
  - App: seed data with a bought pet `x1` in webDev. Setting `location.hash = "#project=webDev&pet=x1"` opens webDev and calls `scrollIntoView` on the `x1` box (stub `Element.prototype.scrollIntoView` with `vi.fn()` and check it was called on that element).

- [ ] **Step 2: Run** `cd web && npx vitest run src/ui/hashLinks.test.ts src/App.test.tsx`. Expected: the new tests fail.

- [ ] **Step 3: Implement** as above.

- [ ] **Step 4: Run** `npx vitest run`, `npx tsc --noEmit` and `npm run build` in `web/`. Expected: all pass.

- [ ] **Step 5: Commit.** `git commit -m "feat(pets): Open project scrolls to the pet's habitat"`

---

### Task 6: Version, docs, check by hand

**Files:**
- Modify: `desktop/package.json` (+ lock) version `0.7.0`, `HANDOFF.md`, `README.md`, the spec's status line

- [ ] **Step 1: Bump the version** to `0.7.0` (`npm version 0.7.0 --no-git-tag-version` in `desktop/`).

- [ ] **Step 2: Docs.**
  - README: bought pets roam the desktop too, with the full menu, and Open project scrolls to their habitat. Remove Part 1's "they don't roam the desktop yet".
  - HANDOFF: Part 2 done, with the `petId` rule (where `projectId` is still meant), `petHabitat` as a list, and the `&pet=` link. Next: Week 4.
  - Spec status: Part 2 built.

- [ ] **Step 3: Check by hand.** Build the installer (`npm run dist`), install 0.7.0, then:
  1. Existing pets keep their spots and naps.
  2. A bought, hatched pet roams with its own name.
  3. Nap it with a task, and the session shows in that project's focus time.
  4. Open project scrolls to its habitat.
  5. With the project page open, both pets are in their boxes and neither is on the desktop.
  6. A pet looking after a requirement suggests that requirement's tasks.

- [ ] **Step 4: Commit.** `git commit -m "docs: pet family Part 2 done; version 0.7.0"`. Push after the final whole-branch review.

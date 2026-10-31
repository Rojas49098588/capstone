# Requirement Blocking and Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Requirements can be blocked by other requirements (or by all others), blockers read clearly
("Waiting on 3", grouped by requirement), requirements can be duplicated, new users start with 100
tokens, projects can have any color, and project types explain themselves.

**Architecture:** All blocking rules live in `web/src/planner/blocking.ts` as pure functions over
`{ tasks, requirements }`. One loop check covers task and requirement blockers together. Every place
that asks "can this task be checked off?" goes through `isBlocked(task, data)`. Store actions clean
whatever the forms send, as `cleanBlockers` does today.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind v4, Vitest + Testing Library (jsdom). Run tests
with `npm test` in `web/`, type check with `npx tsc -b --noEmit` in `web/`.

**Spec:** `docs/superpowers/specs/2026-10-30-blocking-and-polish-design.md`

## Global Constraints

- Branch `feature/blocking-and-polish` (already created, the spec is committed on it).
- Saved data keeps `version: 1`; every new field is optional, and data saved before this change must
  load and behave exactly as before (old balances, old task blockers).
- New user-facing text uses the project's words (`wordsFor(project)` / `projectWords(type)`), never a
  hard-coded "requirement"/"task", except where a screen mixes projects.
- Wording shown to users lives in `web/src/ui/format.ts`.
- `STARTING_TOKENS = 100` for new data; data without the new field counts as `650`.
- Whenever a checkbox is disabled because of blocking, the reason is on screen.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. A requirement with no tasks used as a blocker keeps its dependents locked (not quietly finished).
   Pinned in Task 2 (`openRequirementBlockers` test "an empty blocker requirement stays unfinished").
2. Unchecking a task in Prototype 9 relocks Prototype 10's open tasks but leaves done ones done.
   Pinned in Task 3 (`completeTask` / `reopenTask` test).
3. Moving a task to another requirement can't create a deadlock. Pinned in Task 3 (`updateTask`
   test "refuses a requirement change that would loop").
4. Old saved data with no `blockedBy` on requirements and no `startingTokens` loads, keeps its balance
   and validates. Pinned in Task 1 and Task 2 (storage tests).
5. Deleting a requirement that others wait on unblocks them instead of leaving them stuck on a missing
   id. Pinned in Task 3 (`deleteRequirement` test).

---

### Task 1: Starting tokens are saved with the data

**Files:**
- Modify: `web/src/planner/tuning.ts` (`STARTING_TOKENS`), `web/src/planner/types.ts` (`StudiumData`),
  `web/src/planner/history.ts` (`tokenBalance`), `web/src/store/seed.ts` (`emptyData`),
  `web/src/store/storage.ts` (`isValidData`), callers in `web/src/App.tsx`, `components/Shop.tsx`,
  `components/DecorShop.tsx`, `store/actions.ts` (`purchase`)
- Test: `web/src/planner/history.test.ts`, `web/src/store/storage.test.ts`, `web/src/store/seed.test.ts`

**Interfaces:**
- Produces: `STARTING_TOKENS = 100`, `LEGACY_STARTING_TOKENS = 650` (tuning.ts);
  `StudiumData.startingTokens?: number`;
  `tokenBalance(data: Pick<StudiumData, "events" | "startingTokens">): number`.

- [ ] **Step 1: Write the failing tests**

```ts
// history.test.ts
it("starts new data at 100 and older data at 650", () => {
  expect(tokenBalance({ events: [], startingTokens: 100 })).toBe(100);
  expect(tokenBalance({ events: [] })).toBe(650);
  expect(tokenBalance({ events: [{ type: "purchase", at: NOW.toISOString(), productId: "berry-bites", price: 35 }], startingTokens: 100 })).toBe(65);
});
// seed.test.ts
it("gives new users 100 tokens", () => {
  expect(emptyData(NOW).startingTokens).toBe(100);
  expect(buildSeed(NOW).startingTokens).toBeUndefined(); // example data keeps 650
});
// storage.test.ts
it("accepts data with or without startingTokens, and rejects a non-number", () => { /* valid seed; seed + startingTokens: 100; seed + startingTokens: "100" → false */ });
```

Update existing `tokenBalance(events)` calls in tests to `tokenBalance({ events })`.

- [ ] **Step 2: Run** `npm test -- history seed storage` in `web/`. Expected: FAIL (old signature, no field).
- [ ] **Step 3: Implement.** Change the constants and `tokenBalance` signature
  (`data.startingTokens ?? LEGACY_STARTING_TOKENS`), set `startingTokens: STARTING_TOKENS` in
  `emptyData`, validate it in `isValidData` (`undefined` or a finite number), and pass `s.data` /
  `data` at the four callers. Fix the seed.ts comment ("stays 650").
- [ ] **Step 4: Run** `npm test` and `npx tsc -b --noEmit` in `web/`. Expected: all pass.
- [ ] **Step 5: Commit** `feat: new users start with 100 tokens; existing balances unchanged`

---

### Task 2: Blocking rules for requirements

**Files:**
- Modify: `web/src/planner/types.ts` (`Requirement`), `web/src/planner/blocking.ts`,
  `web/src/store/storage.ts` (`isValidData`), and every caller of `isBlocked` / `openBlockers` /
  `blockerOptions` / `wouldCreateCycle`: `App.tsx:150`, `components/Overview.tsx:180`,
  `components/TaskRow.tsx:22`, `components/TaskForm.tsx:30`, `planner/suggest.ts:22`,
  `store/petStatus.ts:62`, `store/actions.ts` (`cleanBlockers`, `completeTask`)
- Test: `web/src/planner/blocking.test.ts`, `web/src/store/storage.test.ts`

**Interfaces:**
- Produces (types.ts): on `Requirement`,
  `blockedBy?: string[]` (requirement ids, same project; missing = none) and
  `blockedByAll?: true` (waits on every other requirement in the project).
- Produces (blocking.ts):
  - `type BlockData = Pick<StudiumData, "tasks" | "requirements">`
  - `type Blocker = { kind: "task"; task: Task } | { kind: "requirement"; requirement: Requirement }`
  - `requirementBlockerIds(req: Requirement, requirements: Requirement[]): string[]`: with
    `blockedByAll`, every other requirement in the project; otherwise `blockedBy` ids that exist in
    the same project.
  - `openRequirementBlockers(req: Requirement, data: BlockData): Requirement[]`: those not finished
    (`isRequirementDone` from `planner/progress.ts`: at least one task, all done).
  - `waitingOn(task: Task, data: BlockData): Blocker[]`: the task's open blocker tasks (as today's
    `openBlockers`), then the open requirement blockers of its requirement. Unlinked tasks only
    have task blockers.
  - `isBlocked(task: Task, data: BlockData): boolean` = `waitingOn(...).length > 0` (new signature).
  - `wouldTaskBlockerLoop(taskId: string, blockerId: string, data: BlockData): boolean` (replaces
    `wouldCreateCycle`).
  - `blockerOptions(taskId: string, data: BlockData): Task[]` (new signature; same project, no loops).
  - `requirementBlockerOptions(reqId: string, data: BlockData): Requirement[]`: same project, not
    itself, not one that uses `blockedByAll`, and not making a loop.
  - `canBlockByAll(reqId: string, data: BlockData): boolean`: no other requirement in the project
    uses `blockedByAll`, and waiting on all others makes no loop.
  - `wouldRequirementChangeLoop(taskId: string, requirementId: string | null, data: BlockData): boolean`.
  - `openBlockers` and `wouldCreateCycle` are removed (replaced by the above).

The loop check is one graph over the whole project. Nodes and edges ("A waits on B"):

```
task:X      → task:Y        for each Y in X.blockedBy
task:X      → unlock:R      where R = X.requirementId (not for unlinked tasks)
unlock:R    → finished:R2   for each R2 in requirementBlockerIds(R)
finished:R  → task:Y        for each task Y in R
```

Adding an edge A → B makes a loop exactly when B already reaches A. Each `would…` function is a
reachability search for that one new edge (`canBlockByAll` checks every new edge it would add).
The graph is structural: done tasks still count, which is the safe choice.

- [ ] **Step 1: Write the failing tests** in `blocking.test.ts` (rewrite the existing ones to the
  new signatures; build requirements with a small `req(id, extra?)` helper next to the task helper).
  Use Prototype 9 (`P9`, tasks `c9a`, `c9b`) and Prototype 10 (`P10`, `blockedBy: ["P9"]`, task `c10`):

```ts
it("locks a requirement's tasks until its blocker is finished", () => {
  expect(isBlocked(c10, data)).toBe(true);
  expect(waitingOn(c10, data)).toEqual([{ kind: "requirement", requirement: P9 }]);
  const done = withTasks(data, { c9a: { done: true }, c9b: { done: true } });
  expect(isBlocked(c10, done)).toBe(false);
});
it("an empty blocker requirement stays unfinished", () => { /* P8 with no tasks blocks P9's tasks */ });
it("blockedByAll waits on every other requirement, including ones added later", () => { /* Final with blockedByAll; add P11 → Final waits on it too */ });
it("combines task and requirement blockers in one list, tasks first", () => { /* c10 also blockedBy an open task */ });
it("ignores requirement blockers that no longer exist or are in another project", () => {});
it("finds loops that mix task and requirement blockers", () => {
  // P10 waits on P9; a P9 task waiting on c10 would deadlock
  expect(wouldTaskBlockerLoop("c9a", "c10", data)).toBe(true);
  expect(blockerOptions("c9a", data).map((t) => t.id)).not.toContain("c10");
  expect(wouldTaskBlockerLoop("c10", "c9a", data)).toBe(false);
});
it("doesn't offer a requirement blocker that would loop", () => {
  expect(requirementBlockerOptions("P9", data).map((r) => r.id)).not.toContain("P10");
});
it("allows only one blockedByAll per project, and never as a blocker", () => {
  // Final has blockedByAll: canBlockByAll("P9") is false; Final isn't in requirementBlockerOptions("P9")
});
it("detects a requirement change that would loop", () => {
  // c9a blocked by c10 is fine while c9a is unlinked; moving c9a into P9 would loop
});
```

  In `storage.test.ts`: data whose requirements have no `blockedBy` is valid;
  `blockedBy: ["x"]` and `blockedByAll: true` are valid; `blockedBy: "x"` and `blockedByAll: false`
  are rejected.
- [ ] **Step 2: Run** `npm test -- blocking storage`. Expected: FAIL (missing exports / signatures).
- [ ] **Step 3: Implement** the functions above in `blocking.ts`, the two optional fields in
  `types.ts`, and their validation in `isValidData`. Keep `downstreamOpenCount` as is.
- [ ] **Step 4: Update the callers** to pass `s.data` / `data` (TaskRow passes `s.data` and uses
  `waitingOn`; for now it can show the names joined with ", " as today; Task 4 replaces that line).
  In `actions.ts`, `cleanBlockers` uses `wouldTaskBlockerLoop` with `{ tasks: working, requirements: data.requirements }`
  (it now needs `data.requirements`), and `completeTask` uses `isBlocked(task, data)`.
- [ ] **Step 5: Run** `npm test` and `npx tsc -b --noEmit`. Expected: all pass.
- [ ] **Step 6: Commit** `feat: requirements can block requirements (rules and loop checks)`

---

### Task 3: Store actions for requirement blockers

**Files:**
- Modify: `web/src/store/actions.ts` (`RequirementInput`, `createRequirement`, `updateRequirement`,
  `deleteRequirement`, `updateTask`), `web/src/store/useStudium.tsx` (types follow)
- Test: `web/src/store/actions.test.ts`

**Interfaces:**
- Consumes: Task 2's `requirementBlockerOptions`, `canBlockByAll`, `wouldRequirementChangeLoop`,
  `isBlocked`.
- Produces: `RequirementInput` and `updateRequirement`'s `changes` accept
  `blockedBy?: string[]` and `blockedByAll?: boolean`. Saved requirements have `blockedByAll: true`
  or no such key (never `false`), and `blockedBy` is `[]` when `blockedByAll` is set.

- [ ] **Step 1: Write the failing tests** in `actions.test.ts`:

```ts
it("saves a requirement's blockers, dropping unknown, other-project and looping ones", () => {});
it("sets blockedByAll only when allowed, and clears it with false", () => {});
it("won't let Prototype 10's tasks be completed until Prototype 9 is finished", () => {
  // completeTask on c10 → payout null; finish c9a, c9b → completeTask(c10) pays
});
it("relocks after reopening a blocker's task but keeps done tasks done", () => {
  // finish P9, complete c10, add c10b; reopenTask(c9a) → c10 still done, completeTask(c10b) → null
});
it("refuses a requirement change that would loop, and keeps the old requirement", () => {});
it("drops a task's own blockers that would loop after its requirement changes", () => {});
it("removes a deleted requirement from other requirements' blockers", () => {
  // both delete modes; afterwards P10's task can be completed
});
```

- [ ] **Step 2: Run** `npm test -- actions`. Expected: FAIL.
- [ ] **Step 3: Implement.** Add
  `cleanRequirementBlockers(reqId: string, data: StudiumData, wanted: string[], all: boolean): Pick<Requirement, "blockedBy" | "blockedByAll">`
  (keep wanted ids in order while each stays in `requirementBlockerOptions` with the earlier ones
  applied, as `cleanBlockers` does for tasks). Use it in `createRequirement` (only when the input
  has blockers) and `updateRequirement` (when `blockedBy` or `blockedByAll` is in `changes`).
  `deleteRequirement` strips the id from every `blockedBy`. In `updateTask`, apply a requirement
  change only if `wouldRequirementChangeLoop` is false, then clean the task's blockers against the
  data with that change applied.
- [ ] **Step 4: Run** `npm test` and `npx tsc -b --noEmit`. Expected: all pass.
- [ ] **Step 5: Commit** `feat: save and clean requirement blockers`

---

### Task 4: "Waiting on" and the requirement form

**Files:**
- Create: `web/src/components/WaitingOn.tsx`, `web/src/components/WaitingOn.test.tsx`
- Modify: `web/src/ui/format.ts`, `web/src/components/TaskRow.tsx`,
  `web/src/components/RequirementForm.tsx`, `web/src/components/RequirementCard.tsx`,
  `web/src/components/RequirementsSection.tsx`
- Test: `TaskRow.test.tsx`, `RequirementCard.test.tsx`, `WaitingOn.test.tsx`

**Interfaces:**
- Consumes: `waitingOn`, `openRequirementBlockers`, `requirementBlockerOptions`, `canBlockByAll`.
- Produces:
  - format.ts: `blockerName(b: Blocker, projectTasks: Task[], requirements: Requirement[]): string`:
    a requirement's title; a task's title, plus ` (<its requirement's title>)` when another task in
    the project has the same title (unlinked: ` (Unlinked)`).
    `waitingLabel(names: string[]): string`: `"Waiting on <name>"` for one, `"Waiting on <n>"` for more.
    `BLOCKED_BY_ALL_LABEL(words: ProjectWords)` = `` `All other ${words.requirements}` ``.
  - `<WaitingOn names={string[]} />`: nothing for 0; plain text for 1; for 2+, a button showing
    `waitingLabel(names)` with `aria-expanded`, whose list (`role="list"`, one item per name) opens on
    mouse enter, focus or click and closes on mouse leave, blur, Escape, a second click, or a click
    elsewhere.
  - `RequirementFormValues` gains `blockedBy: string[]; blockedByAll: boolean`; `RequirementForm`
    gains props `blockerChoices: Requirement[]` and `canWaitOnAll: boolean`.

- [ ] **Step 1: Write the failing tests:**

```tsx
// WaitingOn.test.tsx
it("names a single blocker", () => { /* "Waiting on Prototype 9" */ });
it("shows a count and lists the blockers on hover", async () => { /* 3 names → "Waiting on 3"; hover → 3 list items; unhover → gone */ });
it("opens and closes with a tap", async () => {});
// TaskRow.test.tsx
it("locks a task whose requirement is waiting and says why", () => {
  // checkbox disabled; text "Waiting on Prototype 9"
});
it("adds the requirement to a repeated task name", () => { /* "Waiting on Git commit (Prototype 9)" */ });
// RequirementCard.test.tsx
it("shows what a requirement is waiting on", () => {});
it("edits a requirement's Blocked by, including All other requirements", async () => {
  // check "Prototype 9" → saved blockedBy ["P9"]; check "All other requirements" → blockedByAll true
});
```

- [ ] **Step 2: Run** `npm test -- WaitingOn TaskRow RequirementCard`. Expected: FAIL.
- [ ] **Step 3: Implement.** TaskRow builds names with `blockerName` from `waitingOn(task, s.data)`
  and renders `<WaitingOn>` in place of today's "Waiting on:" span. RequirementForm adds a
  "Blocked by" fieldset (same look as TaskForm's) listing `blockerChoices` as checkboxes, plus a
  `BLOCKED_BY_ALL_LABEL` checkbox shown when `canWaitOnAll` (checking it disables the list).
  RequirementCard passes `requirementBlockerOptions` / `canBlockByAll` when editing and shows
  `<WaitingOn>` for `openRequirementBlockers` under the title. RequirementsSection, for a new
  requirement, passes all project requirements except ones with `blockedByAll`, and
  `canWaitOnAll` = none has it.
- [ ] **Step 4: Run** `npm test` and `npx tsc -b --noEmit`. Expected: all pass.
- [ ] **Step 5: Commit** `feat: Waiting on N, and Blocked by on requirements`

---

### Task 5: Task "Blocked by" grouped by requirement

**Files:**
- Modify: `web/src/components/TaskForm.tsx`
- Test: `web/src/components/TaskForm.test.tsx`

**Interfaces:**
- Consumes: `blockerOptions(taskId, { tasks: projectTasks, requirements })`.

- [ ] **Step 1: Write the failing test:**

```tsx
it("groups Blocked by choices under their requirement", () => {
  // two "Git commit" tasks in P9 and P10, one unlinked task
  // getByRole("group", { name: "Prototype 9" }) contains checkbox "Git commit"; same for "Prototype 10";
  // an "Unlinked" group holds the unlinked task; groups follow the requirements' order
});
```

- [ ] **Step 2: Run** `npm test -- TaskForm`. Expected: FAIL.
- [ ] **Step 3: Implement:** one nested `<fieldset>` per requirement with options (legend = its
  title), then "Unlinked" (`capitalize` of the plain word "unlinked"); empty groups are skipped.
- [ ] **Step 4: Run** `npm test`. Expected: all pass.
- [ ] **Step 5: Commit** `feat: group a task's Blocked by choices by requirement`

---

### Task 6: Duplicate a requirement

**Files:**
- Modify: `web/src/store/actions.ts`, `web/src/store/useStudium.tsx`,
  `web/src/components/RequirementCard.tsx`, `web/src/components/RequirementsSection.tsx`
- Test: `web/src/store/actions.test.ts`, `web/src/components/RequirementCard.test.tsx`

**Interfaces:**
- Produces:
  - `nextRequirementTitle(title: string): string`: trailing number + 1, keeping zero padding
    (`"Prototype 9"` → `"Prototype 10"`, `"Week 09"` → `"Week 10"`); otherwise `title + " (copy)"`.
  - `duplicateRequirement(data: StudiumData, id: string, now: Date): { data: StudiumData; requirement: Requirement | null; hatched: boolean }`.
  - `useStudium`'s `duplicateRequirement(id)` returns `{ requirement, hatched }` like `createRequirement`.
  - `RequirementCard` gains prop `onHatch: (message: string) => void` (RequirementsSection passes its own).

- [ ] **Step 1: Write the failing tests:**

```ts
it("names the copy with the next number", () => {
  expect(nextRequirementTitle("Prototype 9")).toBe("Prototype 10");
  expect(nextRequirementTitle("Week 09")).toBe("Week 10");
  expect(nextRequirementTitle("Final report")).toBe("Final report (copy)");
});
it("copies a requirement with fresh tasks, right after the original, blocked by it", () => {
  // P9 (weight 4, start 2026-10-26, due 2026-11-01) with c9a done + actualMin, c9b blocked by c9a and by an outside task X
  // copy: title "Prototype 10", weight 4, blockedBy ["P9"], no blockedByAll, index right after P9
  // dates 2026-11-02 → 2026-11-08 (shifted by due − start + 1 = 7 days)
  // two new tasks: same titles/estimates/priority, done false, actualMin null, new ids;
  // copy of c9b blocked by copy of c9a and by X; events have requirement_created + task_created for each
});
it("shifts by 7 days when a date is missing, and leaves unset dates unset", () => {});
it("counts toward hatching", () => {});
// RequirementCard.test.tsx
it("duplicates from the card", async () => { /* click "Duplicate Prototype 9" → card "Prototype 10" appears */ });
```

- [ ] **Step 2: Run** `npm test -- actions RequirementCard`. Expected: FAIL.
- [ ] **Step 3: Implement** in `actions.ts` (use `addDays`, `localDateKey`, `startOfLocalDay` from
  `planner/time.ts`; finish with `hatchIfReady` as `createRequirement` does). Add a "Duplicate"
  button (`aria-label="Duplicate <title>"`) beside Edit/Delete; it calls `onHatch(hatchingMessage(...))`
  when the copy hatches the egg.
- [ ] **Step 4: Run** `npm test` and `npx tsc -b --noEmit`. Expected: all pass.
- [ ] **Step 5: Commit** `feat: duplicate a requirement as the next in its series`

---

### Task 7: Custom project color, kept readable

**Files:**
- Create: `web/src/ui/color.ts`, `web/src/ui/color.test.ts`
- Modify: `web/src/components/ProjectModal.tsx`, places that put text on or in a project color
  (find them with `grep -rn "\.color" web/src/components web/src/App.tsx`; known: `TaskRow.tsx`
  checkmark, `Habitat.tsx:91`), `extension/content/logic.js`, `extension/content/pet.js` (`.name`)
- Test: `web/src/components/ProjectModal.test.tsx`, `web/src/extension/petLogic.test.ts`

**Interfaces:**
- Produces: `isLightColor(hex: string): boolean` (WCAG relative luminance > 0.5) and
  `textOn(hex: string): "#ffffff" | "#1a1816"` in `ui/color.ts`; the same `textOn` as
  `PetLogic.textOn` in `logic.js`.

- [ ] **Step 1: Write the failing tests:**

```ts
// color.test.ts
it("tells light colors from dark ones", () => {
  expect(isLightColor("#ffeb3b")).toBe(true);
  expect(isLightColor("#2d3a8c")).toBe(false);
  expect(textOn("#ffeb3b")).toBe("#1a1816");
  expect(textOn("#2d3a8c")).toBe("#ffffff");
});
// petLogic.test.ts
it("picks the pet name label's text color", () => { /* same two cases via L.textOn */ });
// ProjectModal.test.tsx
it("saves a custom color", () => {
  // fireEvent.change(getByLabelText("Custom color"), { target: { value: "#ff99cc" } }); save → project.color "#ff99cc"
  // reopening the edit form shows the custom swatch as the checked one
});
```

- [ ] **Step 2: Run** `npm test -- color petLogic ProjectModal`. Expected: FAIL.
- [ ] **Step 3: Implement.** After the six swatches, a seventh swatch wrapping
  `<input type="color" aria-label="Custom color">` showing the current color when it isn't one of
  `PROJECT_COLORS` (checked-state outline as the others). Text on a project color uses `textOn`;
  text drawn in a project color falls back to `var(--color-foreground)` when the color is too light
  (light mode) or too dark (dark mode). In `pet.js`, set `--ct` next to `--c` from `L.textOn` and
  use `color: var(--ct, #fff)` in `.name`.
- [ ] **Step 4: Run** `npm test` and `npx tsc -b --noEmit`. Expected: all pass.
- [ ] **Step 5: Commit** `feat: any project color, with readable text on it`

---

### Task 8: Project type hints, docs

**Files:**
- Modify: `web/src/ui/format.ts`, `web/src/components/ProjectModal.tsx`, `web/src/components/Setup.tsx`,
  `README.md` ("Where to change things" table), `HANDOFF.md` (status)
- Test: `ProjectModal.test.tsx`, `Setup.test.tsx`

**Interfaces:**
- Produces: `PROJECT_TYPE_HINTS: Record<ProjectType, string>` in format.ts, exact copy:

```ts
school: "Requirements and tasks, like an assignment sheet.",
writing: "Requirements are chapters and tasks are scenes.",
art: "Requirements are pieces and tasks are steps.",
code: "Requirements are features; tasks stay tasks.",
music: "Requirements are tracks; tasks stay tasks.",
other: "Requirements are milestones; tasks stay tasks.",
```

- [ ] **Step 1: Write the failing tests:** picking "Writing" in the New Project form shows
  "Requirements are chapters and tasks are scenes."; Setup's first step shows the hint for the
  picked type; a test that every `PROJECT_TYPES` entry has a hint.
- [ ] **Step 2: Run** `npm test -- ProjectModal Setup format`. Expected: FAIL.
- [ ] **Step 3: Implement:** the hint line under Type (same style as the Difficulty hint) and under
  Setup's type choices, above `SETUP_COPY.makeHint`. README: rows for requirement blocking
  (`planner/blocking.ts`), starting tokens (`STARTING_TOKENS` in `planner/tuning.ts`), type hints
  (`PROJECT_TYPE_HINTS`). HANDOFF: a short status line for this round.
- [ ] **Step 4: Run** `npm test`, `npx tsc -b --noEmit` and `npm run build` in `web/`; then
  `npm test` in `desktop/` (it loads `logic.js`). Expected: all pass.
- [ ] **Step 5: Commit** `feat: explain each project type; docs for this round`

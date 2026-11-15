# Companion app, Plan 1: Pending tasks and task due dates (desktop and web)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Studium's tasks an optional due date and a "pending" state, with a Pending section on the desktop and web app, so the phone app (Plan 2) has something to write to.

**Architecture:** Two new optional fields on `Task` (`dueDate`, `pending`), handled in the shared planner and store code (`web/src/planner`, `web/src/store/actions.ts`) that the phone app will reuse. A pending task is an unlinked task (`requirementId: null`), so the existing rules already give it no tokens, no mood effect and no suggestions; the new code only marks it, lists it, and lets the user finish its details. The desktop app loads the web app, so web changes reach it.

**Tech Stack:** TypeScript, React, Vitest + Testing Library (`web/`), Firestore emulator tests (`npm run test:emulator`).

**Spec:** [docs/superpowers/specs/2026-11-15-companion-app-design.md](../specs/2026-11-15-companion-app-design.md), sections "Changes to the desktop and web app" and "Older versions". Plan 2 (the phone app) is written after this one ships.

## Global Constraints

- Work on a branch `feature/task-due-dates-and-pending` off `main`. Never commit to `main`.
- Both new `Task` fields are **optional**: missing = not pending, no due date. Saves without them must load unchanged.
- A pending task must still pass the **old** load check (Studium 0.11.0): `requirementId: null`, `estimateMin` a number, `blockedBy: []`, `priority: false`, `done: false`, `actualMin: null`.
- "A task's due date can't be later than its requirement's due date." The requirement's date falls back to the project deadline; an unlinked task's limit is the project deadline.
- Task due dates are **for reminders only**: no change to mood, plan suggestions, tokens or pet growth.
- While pending, a task earns no tokens, doesn't count toward any mood, and is never suggested for today's plan. The user can still put it on today's plan.
- Dates are local `"YYYY-MM-DD"` strings (`isDateKey`, `localDateKey` in `web/src/planner/time.ts`).
- Commit trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Commit only with the owner's go-ahead; no push, deploy or merge without them.
- Before the desktop installer is built: bump `desktop/package.json` version (to **0.12.0**).

## Review Focus

1. A requirement's due date (or the project deadline) moved **earlier** than a task's own date → the task's effective due date is the earlier limit, without rewriting the task. (Task 1, `taskDueDate` test.)
2. A task with its own due date is **moved to another requirement or to Unlinked** → its own date is re-clamped to the new limit. (Task 1, `updateTask` test.)
3. A pending task **ticked off before its details are added** → 0 tokens, no error, and finishing its details afterwards pays nothing. (Task 2 tests.)
4. A pending task that's **on today's plan and then deleted** → gone from today's plan too. (Task 2 test.)
5. An **empty date field** (`""`) or a malformed date from a form → stored as no due date, not as `""`. (Task 1 test.)

---

### Task 1: Optional due dates on tasks (model, rules, load check)

**Files:**
- Modify: `web/src/planner/types.ts` (the `Task` type)
- Create: `web/src/planner/dueDates.ts`, `web/src/planner/dueDates.test.ts`
- Modify: `web/src/store/actions.ts` (`TaskInput`, `createTask`, `updateTask`)
- Modify: `web/src/store/storage.ts` (task loop in `isValidData`)
- Test: `web/src/store/actions.test.ts`, `web/src/store/storage.test.ts`

**Interfaces:**
- Produces:
  - `Task.dueDate?: string | null` — the task's own date; missing/null = none.
  - `taskDueLimit(task: Pick<Task, "projectId" | "requirementId">, data: Pick<StudiumData, "projects" | "requirements">): string | null` — the requirement's `dueDate`, else the project's `deadline`; null if the project is missing.
  - `taskDueDate(task: Task, data: Pick<StudiumData, "projects" | "requirements">): string | null` — the earlier of the task's own date and its limit; the limit when it has none.
  - `TaskInput.dueDate?: string | null`; `updateTask` accepts `dueDate` in `changes`.

- [ ] **Step 1: Write the failing tests** in `dueDates.test.ts`, using `makeData`, `makeProject`, `makeRequirement`, `makeTask`, `dayKey` from `planner/testData.ts`:

```ts
it("a task without its own date uses its requirement's, then the project's deadline", () => {
  const data = makeData({ projects: [makeProject({ id: "p1", deadline: dayKey(30) })],
    requirements: [makeRequirement({ id: "r1", projectId: "p1", dueDate: dayKey(10) }), makeRequirement({ id: "r2", projectId: "p1", dueDate: null })] });
  expect(taskDueDate(makeTask({ projectId: "p1", requirementId: "r1" }), data)).toBe(dayKey(10));
  expect(taskDueDate(makeTask({ projectId: "p1", requirementId: "r2" }), data)).toBe(dayKey(30));
  expect(taskDueDate(makeTask({ projectId: "p1", requirementId: null }), data)).toBe(dayKey(30));
});
it("a task's own date wins when earlier, and is capped when its requirement's moves earlier", () => {
  const data = makeData({ projects: [makeProject({ id: "p1" })], requirements: [makeRequirement({ id: "r1", projectId: "p1", dueDate: dayKey(10) })] });
  expect(taskDueDate(makeTask({ projectId: "p1", requirementId: "r1", dueDate: dayKey(4) }), data)).toBe(dayKey(4));
  expect(taskDueDate(makeTask({ projectId: "p1", requirementId: "r1", dueDate: dayKey(12) }), data)).toBe(dayKey(10));
});
```

In `actions.test.ts`:

```ts
it("createTask keeps a due date, caps it at the requirement's, and drops empty or bad ones", () => {
  // requirement r1 due dayKey(10)
  expect(createTask(data, { ...input, dueDate: dayKey(5) }, NOW).task.dueDate).toBe(dayKey(5));
  expect(createTask(data, { ...input, dueDate: dayKey(20) }, NOW).task.dueDate).toBe(dayKey(10));
  expect(createTask(data, { ...input, dueDate: "" }, NOW).task.dueDate).toBeUndefined();
  expect(createTask(data, { ...input, dueDate: "next week" }, NOW).task.dueDate).toBeUndefined();
});
it("updateTask sets and clears a due date, and re-caps it when the task moves", () => {
  // task on r1 (due dayKey(10)) with dueDate dayKey(8); r2 due dayKey(6)
  expect(find(updateTask(data, id, { dueDate: null }, NOW), id).dueDate).toBeUndefined();
  expect(find(updateTask(data, id, { requirementId: "r2" }, NOW), id).dueDate).toBe(dayKey(6));
  expect(find(updateTask(data, id, { title: "Renamed" }, NOW), id).dueDate).toBe(dayKey(8));
});
```

In `storage.test.ts` (`isValidData`):

```ts
it("accepts tasks with or without a due date, and rejects a malformed one", () => {
  expect(isValidData(withTask({ dueDate: dayKey(3) }))).toBe(true);
  expect(isValidData(withTask({ dueDate: null }))).toBe(true);
  expect(isValidData(withTask({}))).toBe(true);
  expect(isValidData(withTask({ dueDate: "soon" }))).toBe(false);
});
```

- [ ] **Step 2: Run them to make sure they fail**

Run (in `web/`): `npx vitest run src/planner/dueDates.test.ts src/store/actions.test.ts src/store/storage.test.ts`
Expected: FAIL (`taskDueDate` not found; `dueDate` not on `TaskInput`).

- [ ] **Step 3: Implement**
  - `types.ts`: add `dueDate?: string | null; // "YYYY-MM-DD"; missing/null = its requirement's date (planner/dueDates.ts). Reminders only.` to `Task`.
  - `dueDates.ts`: `taskDueLimit`, `taskDueDate` as in Interfaces. Compare date keys as strings (they sort correctly).
  - `actions.ts`: a private `cleanTaskDueDate(data, projectId, requirementId, value)` → `cleanDate(value)` capped at `taskDueLimit`; returns `undefined` for none so the field is **left off** the task (never `""`, and `null` only isn't needed). `createTask` sets it only when present. `updateTask`: accept `"dueDate"` in `changes` (null clears: remove the field); when `requirementId` changes, re-cap the existing date against the new limit. Keep the `task_edited` event's `changes` as now (it records the cleaned change).
  - `storage.ts` task loop: `if (t.dueDate !== undefined && !(t.dueDate === null || isDateKey(t.dueDate))) return false;`

- [ ] **Step 4: Run the tests to make sure they pass**, then the whole suite and the type check

Run: `npx vitest run src/planner/dueDates.test.ts src/store/actions.test.ts src/store/storage.test.ts` → PASS
Run: `npm test && npm run typecheck` → all pass

- [ ] **Step 5: Commit** — `feat(tasks): optional due dates, capped at the requirement's`

---

### Task 2: Pending tasks (model and actions)

**Files:**
- Modify: `web/src/planner/types.ts` (`Task`)
- Modify: `web/src/store/actions.ts`, `web/src/store/useStudium.tsx`
- Modify: `web/src/store/storage.ts` (task loop)
- Test: `web/src/store/actions.test.ts`, `web/src/store/storage.test.ts`, `web/src/planner/suggest.test.ts`

**Interfaces:**
- Consumes: `taskDueLimit` / due-date cleaning from Task 1.
- Produces:
  - `Task.pending?: true` — added on the phone; still needs its requirement and estimate.
  - `PendingTaskInput = { projectId: string; title: string; addToToday: boolean }`
  - `createPendingTask(data: StudiumData, input: PendingTaskInput, now: Date): { data: StudiumData; task: Task }` — Plan 2's phone quick add calls this.
  - `TaskDetails = { requirementId: string; estimateMin: number; dueDate?: string | null }`
  - `finishTaskDetails(data: StudiumData, id: string, details: TaskDetails, now: Date): StudiumData`
  - `isPending(task: Task): boolean` (in `actions.ts` or `planner/dueDates.ts`'s neighbour; export it from `store/actions.ts`).
  - `useStudium` gains `createPendingTask(input)` and `finishTaskDetails(id, details)`.

- [ ] **Step 1: Write the failing tests** (`actions.test.ts`):

```ts
it("createPendingTask makes an unlinked, pending task that the old load check accepts", () => {
  const { data: d, task } = createPendingTask(data, { projectId: "p1", title: "  Email TA  ", addToToday: false }, NOW);
  expect(task).toMatchObject({ title: "Email TA", requirementId: null, estimateMin: 0, blockedBy: [], priority: false, done: false, actualMin: null, pending: true });
  expect(d.today.taskIds).not.toContain(task.id);
  expect(d.events.at(-1)).toMatchObject({ type: "task_created", taskId: task.id });
  const { pending: _, ...asOldVersionSeesIt } = task;
  expect(isValidData({ ...d, tasks: [...data.tasks, asOldVersionSeesIt] })).toBe(true);
});
it("createPendingTask can put it on today's plan", () => {
  const { data: d, task } = createPendingTask(data, { projectId: "p1", title: "Email TA", addToToday: true }, NOW);
  expect(d.today.taskIds).toContain(task.id);
});
it("createPendingTask refuses an unknown project or an empty title", () => {
  expect(() => createPendingTask(data, { projectId: "nope", title: "x", addToToday: false }, NOW)).toThrow();
  expect(() => createPendingTask(data, { projectId: "p1", title: "   ", addToToday: false }, NOW)).toThrow();
});
it("finishTaskDetails links it, sets the estimate and due date, and it stops being pending", () => {
  const t = find(finishTaskDetails(withPending, id, { requirementId: "r1", estimateMin: 45, dueDate: dayKey(3) }, NOW), id);
  expect(t).toMatchObject({ requirementId: "r1", estimateMin: 45, dueDate: dayKey(3) });
  expect(t.pending).toBeUndefined();
});
it("finishTaskDetails ignores a requirement from another project and leaves it pending", () => {
  expect(find(finishTaskDetails(withPending, id, { requirementId: "other-project-req", estimateMin: 45 }, NOW), id).pending).toBe(true);
});
it("a pending task ticked off earns nothing, and finishing its details later pays nothing", () => {
  const done = completeTask(withPending, id, null, NOW);
  expect(done.payout?.tokens ?? 0).toBe(0);
  const linked = finishTaskDetails(done.data, id, { requirementId: "r1", estimateMin: 30 }, NOW);
  expect(tokenBalance(linked)).toBe(tokenBalance(done.data));
});
it("deleting a pending task on today's plan takes it off the plan", () => {
  const { data: d, task } = createPendingTask(data, { projectId: "p1", title: "Email TA", addToToday: true }, NOW);
  expect(deleteTask(d, task.id, NOW).today.taskIds).not.toContain(task.id);
});
```

`suggest.test.ts`: a pending task is never in `suggestions(...)` (whatever the existing suggest entry point is called; it already filters `requirementId !== null` — this test pins it).

`storage.test.ts`: `pending: true` and missing are valid; `pending: false` or `"yes"` is not.

- [ ] **Step 2: Run them to make sure they fail**

Run: `npx vitest run src/store/actions.test.ts src/store/storage.test.ts src/planner/suggest.test.ts`
Expected: FAIL (`createPendingTask` not exported).

- [ ] **Step 3: Implement**
  - `types.ts`: `pending?: true; // added on the phone, still needs its requirement and estimate (store/actions.ts finishTaskDetails). Missing = not pending.`
  - `createPendingTask`: build the task with exactly the fields in the first test (`estimateMin: 0`), append it, add a `task_created` event, and when `addToToday` use the existing `addToToday(data, id, now)`.
  - `finishTaskDetails`: refuse (return `data` unchanged) unless the requirement belongs to the task's project. Set `requirementId` with the same blocker-loop check `updateTask` uses, clean `estimateMin` with `cleanMinutes`, cap `dueDate` (Task 1), and remove `pending`, all as **one** `task_edited` event (share a private helper with `updateTask` rather than calling it and then editing again).
  - `storage.ts` task loop: `if (t.pending !== undefined && t.pending !== true) return false;`
  - `useStudium.tsx`: wrappers next to `createTask` / `updateTask`, same `change((d, at) => …)` pattern.
  - `updateTask` setting a non-null `requirementId` on a pending task does **not** clear `pending` by itself (only `finishTaskDetails` does), so the Pending list stays the one place to finish it.

- [ ] **Step 4: Run the tests**, then `npm test && npm run typecheck` → all pass

- [ ] **Step 5: Commit** — `feat(tasks): pending tasks, for the phone's quick add`

---

### Task 3: Due dates in the task form and lists

**Files:**
- Modify: `web/src/components/TaskForm.tsx`, `web/src/components/TaskRow.tsx`, `web/src/components/RequirementCard.tsx`, `web/src/components/Overview.tsx`
- Test: `web/src/components/TaskForm.test.tsx` (create if missing), `web/src/components/Overview.test.tsx` or the existing test that renders the Today list

**Interfaces:**
- Consumes: `TaskInput.dueDate`, `updateTask` `dueDate`, `taskDueLimit`, `Task.dueDate` (Task 1).
- Produces: `TaskFormValues` gains `dueDate: string | null`. `TaskForm` gains a prop `dueLimit?: (requirementId: string | null) => string | null` so the date input's `max` follows the chosen requirement.

- [ ] **Step 1: Write the failing tests**
  - TaskForm: an optional date field labelled **"Due date (optional)"**; its `max` is the limit for the selected requirement and changes when the requirement changes; submitting with it empty gives `dueDate: null`; with a date gives that date. Help text under it: **"For reminders. Can't be after the requirement's due date."** (use the project's word for requirement via `words`).
  - TaskRow: a task with its own due date shows **"due <date>"** in the row's details, formatted with the app's existing short-date formatter (`ui/format.ts`); without one, nothing new shows.
  - Overview Today list: a task with its own due date shows the same "due <date>".

- [ ] **Step 2: Run them to make sure they fail** — `npx vitest run src/components` → the new tests FAIL

- [ ] **Step 3: Implement** the field (`<input type="date">` with `INPUT`/`LABEL` styles), pass `dueLimit` from `RequirementCard` (create) and `TaskRow` (edit) using `taskDueLimit`, send `dueDate` through `createTask` / `updateTask`, and add the "due …" text.

- [ ] **Step 4: Run** `npm test && npm run typecheck` → all pass

- [ ] **Step 5: Commit** — `feat(tasks): set and see a task's own due date`

---

### Task 4: The Pending section

**Files:**
- Create: `web/src/components/PendingTasks.tsx`, `web/src/components/PendingTasks.test.tsx`
- Modify: `web/src/components/Overview.tsx` (render it), `web/src/components/RequirementsSection.tsx` (Unlinked list), Today list in `Overview.tsx`

**Interfaces:**
- Consumes: `isPending`, `finishTaskDetails`, `deleteTask` via `useStudium`; `taskDueLimit`; `EstimatePicker`; `TaskFormValues` shape for consistency.
- Produces: `<PendingTasks onSelect={(projectId) => void} />`.

- [ ] **Step 1: Write the failing tests** (`renderWithStudium` from `src/test/render.tsx`)
  - With no pending tasks, the section **isn't rendered**.
  - With pending tasks, a section headed **"Pending"** with the line **"Added on your phone. Add the details to start earning tokens for them."** lists each one with its project's short name and title.
  - **"Add details"** opens an inline form: requirement (the task's project's requirements only; required), estimate (`EstimatePicker`), due date (optional, `max` = the chosen requirement's limit). Saving calls `finishTaskDetails`; the task leaves the Pending list and appears under its requirement.
  - A project with **no requirements** shows **"Add a requirement to <project> first."** instead of the form, with a link that calls `onSelect(projectId)`.
  - **Delete** removes the task (no confirm needed: it has no work recorded; if it's done, keep the existing delete behaviour).
  - A pending task in the **Today** list and in a project's **Unlinked** list shows a small **"Pending"** tag.

- [ ] **Step 2: Run them to make sure they fail** — `npx vitest run src/components/PendingTasks.test.tsx` → FAIL

- [ ] **Step 3: Implement** `PendingTasks.tsx` and render it in `Overview.tsx` **above** "What matters next", styled like the other Overview cards. Add the tag in `Overview.tsx` (Today) and `RequirementsSection.tsx` (Unlinked).

- [ ] **Step 4: Run** `npm test && npm run typecheck && npm run build` → all pass

- [ ] **Step 5: Commit** — `feat(tasks): a Pending section to finish tasks added on the phone`

---

### Task 5: Sync keeps the new fields, then version and docs

**Files:**
- Modify: `web/src/sync/firestoreRemote.emulator.test.ts`, `web/src/sync/syncEngine.test.ts`
- Modify: `desktop/package.json` (version), `HANDOFF.md`, `docs/ROADMAP.md`

**Interfaces:**
- Consumes: `createPendingTask`, `Task.dueDate`, `Task.pending`.

- [ ] **Step 1: Write the failing-or-pinning tests**
  - `syncEngine.test.ts` (fake remote): device A creates a pending task with a due date; device B, signed in to the same account, receives it with `pending: true` and `dueDate` intact; B finishes its details; A sees it linked and not pending.
  - `syncEngine.test.ts`: an **old-version edit** — B's copy of the task loses nothing when B renames it with the current `updateTask` (pins the `...t` spread that keeps unknown fields).
  - `firestoreRemote.emulator.test.ts`: a task record with `pending: true` and `dueDate` written by `write()` reads back through the listener unchanged.

- [ ] **Step 2: Run** `npx vitest run src/sync/syncEngine.test.ts` and `npm run test:emulator`. If they already pass, that's fine: they pin behaviour the phone relies on. If one fails, fix `records.ts` / `firestoreRemote.ts` so task records keep every field.

- [ ] **Step 3: Version and docs**
  - `desktop/package.json`: version **0.12.0**.
  - `HANDOFF.md`: a short section on pending tasks and task due dates (fields, rules, where the Pending section is, that Plan 2's phone app writes pending tasks).
  - `docs/ROADMAP.md`: add the companion app with Plan 1 done and Plan 2 next.
  - Firestore rules: **no change needed** (task fields aren't checked by the rules). Confirm by running `firebase/rules.test.js` (`cd firebase && npm test`) → 11 pass.

- [ ] **Step 4: Full check** — in `web/`: `npm test && npm run typecheck && npm run build`; in `desktop/`: `npm test` → all pass.

- [ ] **Step 5: Commit** — `test(sync): pending tasks and due dates sync between devices; 0.12.0`

**After the plan (owner's go-ahead each):** push and open a PR; after merge, deploy hosting (`npx firebase deploy --only hosting --project studium-9a00e` from `firebase/`) and run the installer build on `main`.

# Reordering tasks, a condensed requirements view, and sublabels: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tasks can be reordered (drag, Move up and Move down) in a requirement, in Unlinked and in Today. Requirements collapse to one line and have a ≡ menu with one view at a time. Requirements can have an optional sublabel.

**Architecture:**
- Ordering is pure logic in a new `web/src/planner/order.ts`. It's used by new store actions (`moveTask`, `moveTodayTask`) and by the three lists.
- The views are pure logic in a new `web/src/planner/requirementView.ts`. What each device remembers (view and collapsed requirements) lives in a new `web/src/ui/viewPrefs.ts`, in localStorage and outside the synced data.
- UI: a small reusable `ReorderControls` (grip, ↑, ↓) plus a hand-written pointer drag, used by `RequirementCard`, the Unlinked section and the Overview's Today list. `RequirementsSection` gets the ≡ menu, and `RequirementCard` gets collapse and the sublabel.

**Tech Stack:** React 19, TypeScript, Vitest with Testing Library (jsdom), Tailwind classes from `web/src/ui/styles.ts`. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-18-tasks-and-requirements-view-design.md` (approved 2026-11-18).

## Global Constraints

- Branch `feature/planner-reorder-view`. Run commands from `web/`. The tests are `npx vitest run <file>`, the full suite is `npm test`, and the types check with `npm run typecheck`.
- **Order never changes planning.** Suggestions, tokens, mood and progress must not read `order`.
- **Old saves load unchanged.** A missing `order` or `sublabel` is normal. A bad one (a non-number order, a non-text sublabel) is dropped in `normalizeData`, and `isValidData` must **not** reject the data over it.
- **★ (priority)** stays a marker, and the planner uses it as before. Only lists that someone has reordered stop putting ★ first.
- **Sublabel:** optional, trimmed, at most **30** characters, and empty means none. `SUBLABEL_MAX = 30` goes in `planner/tuning.ts`.
- **Soon:** `SOON_DAYS = 3` in `planner/tuning.ts`. A requirement counts when `(dueDate ?? project.deadline) <= localDateKey(addDays(now, 3))` and it isn't `isRequirementDone`. Overdue requirements count.
- Reordering is keyboard-usable, and focus stays on the moved task's button.
- No extension, phone or desktop-main changes.
- Commit trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Copy, exactly:
  - views: `Show all`, `Today's to-do`, `Hide completed`, `Soon`;
  - menu: `Collapse all` / `Expand all`;
  - empty lines: `Nothing due in the next 3 days.`, `Nothing on today's list for this project.`, `Everything here is finished.`;
  - hidden line: `{n} more hidden by {view label}`, with a `Show all` button.

## Review Focus

1. **Reopening a task in a reordered list.** It goes back among the unfinished tasks at its old order number, with no crash or duplicate. Test in Task 1.
2. **Moving a task to another requirement through the task form.** It lands at the bottom of the new list's unfinished tasks, even when that list has been reordered. Test in Task 2.
3. **Reordering Today when the saved list is yesterday's.** `moveTodayTask` treats the list as empty and changes nothing. Test in Task 2.
4. **Damaged or out-of-date device prefs.** Bad JSON, an unknown view, or ids of deleted requirements fall back to the defaults or are ignored, with no crash. Test in Task 5.
5. **A synced or old save with `order: "x"` or `sublabel: 5`.** It loads, the bad field is dropped, and nothing else is lost. Test in Task 1.

---

### Task 1: Data fields, sorting, and loading

**Files:**
- Modify: `web/src/planner/types.ts` (`Task`, `Requirement`)
- Modify: `web/src/planner/tuning.ts` (add `SUBLABEL_MAX = 30`, `SOON_DAYS = 3`)
- Create: `web/src/planner/order.ts`
- Modify: `web/src/store/storage.ts` (`normalizeData`)
- Test: `web/src/planner/order.test.ts`, `web/src/store/storage.test.ts`

**Interfaces:**
- Produces:
  - `Task.order?: number` and `Requirement.sublabel?: string`;
  - `sortListTasks(tasks: Task[]): Task[]`;
  - `isReordered(tasks: Task[]): boolean`;
  - `listOf(task: Pick<Task, "projectId" | "requirementId">, tasks: Task[]): Task[]`, which returns the tasks with the same projectId and requirementId (null means Unlinked), in array order.

`sortListTasks` works like this:
- Unfinished tasks come first, then done tasks in their array order (today's behavior).
- If no unfinished task has an `order` (`isReordered` is false), the unfinished tasks are ★ first, then array order. That's today's sort.
- Otherwise the unfinished tasks sort by `order` (missing = after all numbered ones), then `createdAt`, then `id`.

- [ ] **Step 1: Write the failing tests** in `order.test.ts`:
  - `"keeps today's look for a list nobody reordered"`: tasks a, b★, c (no orders) give `[b, a, c]`. With c done, `[b, a, c]`.
  - `"sorts a reordered list by order and ignores ★"`: a{order 1}, b★{order 2}, c{order 0} give `[c, a, b]`.
  - `"puts tasks without an order after numbered ones, by createdAt then id"`.
  - `"a reopened task returns to its old place"`: a{0}, b{1, done}, c{2}; then b reopened gives `[a, b, c]` (Review Focus 1).
  - `"listOf separates requirements and Unlinked"`.

  In `storage.test.ts`, `"drops a bad order or sublabel on load and keeps the rest"`: data whose task has `order: "x"` and whose requirement has `sublabel: 5`. `isValidData` is true, and after `normalizeData` both fields are gone and every task and requirement is still there (Review Focus 5). Also `"keeps a good order and sublabel"`.

- [ ] **Step 2: Run** `npx vitest run src/planner/order.test.ts src/store/storage.test.ts`. Expected: FAIL (module `./order` not found, and the normalize assertions fail).

- [ ] **Step 3: Implement.** Add the type fields, the tuning constants, `order.ts`, and the cleaning in `normalizeData`. Keep `order` only when it's a finite number. Keep `sublabel` only when it's a non-empty string, trimmed and cut to `SUBLABEL_MAX`. Return the same object when nothing changed, so saves aren't rewritten for no reason.

- [ ] **Step 4: Run** the same command, then `npm run typecheck`. Expected: PASS, no type errors.

- [ ] **Step 5: Commit** `feat(planner): task order and requirement sublabel fields, list sorting`.

### Task 2: Store actions

**Files:**
- Modify: `web/src/store/actions.ts`, `web/src/store/useStudium.tsx`
- Test: `web/src/store/actions.test.ts`

**Interfaces:**
- Consumes: `sortListTasks`, `listOf`, `isReordered` (Task 1).
- Produces:
  - `moveTask(data: StudiumData, taskId: string, toIndex: number): StudiumData`;
  - `moveTodayTask(data: StudiumData, taskId: string, toIndex: number, now: Date): StudiumData`;
  - `RequirementInput.sublabel?: string`, and `updateRequirement` changes accept `sublabel?: string` (`""` clears it);
  - context functions `s.moveTask(id, toIndex)` and `s.moveTodayTask(id, toIndex)`.

The rules:
- `moveTask`: `toIndex` is an index among the list's **unfinished** tasks, as `sortListTasks` shows them, clamped. After the move, every unfinished task in that list gets `order = its index`, and only tasks whose order changed are replaced. It records **no event**, like `togglePriority`, because order isn't planning data. A done or unknown task returns `data` unchanged.
- `moveTodayTask`: works on `currentToday(data, now).taskIds`. It moves among the ids of existing unfinished tasks. The result is the reordered unfinished ids followed by the done ids in their old relative order. A done task, or one not in today's list, changes nothing. Yesterday's list is treated as empty, so nothing changes (Review Focus 3).
- `createTask` and `createPendingTask`: if the new task's list `isReordered`, give it `order = max(order) + 1`. Otherwise leave it without one.
- `editTask`, when `requirementId` changes: if the new list `isReordered`, set `order = max + 1`. Otherwise delete `order` from the task. The `task_edited` event's `changes` must not include `order`.
- Sublabel: `createRequirement` and `updateRequirement` trim it and cut it to `SUBLABEL_MAX`. An empty sublabel leaves the field off; on update, an empty one **removes** it. `duplicateRequirement` already copies every field through `...rest`; add a test.

- [ ] **Step 1: Write the failing tests** in `actions.test.ts`:
  - `"moveTask numbers the whole list once, starred tasks keep their place on screen"`: a, b★, c, no orders. Moving c to index 0 gives the orders c=0, b=1, a=2, and `sortListTasks` gives `[c, b, a]`. No new event.
  - `"moveTask ignores done tasks and other lists"`.
  - `"a new task goes to the bottom of a reordered list"`.
  - `"a task moved to another requirement goes to the bottom of that list"` (Review Focus 2): the target is reordered, and the moved task's order is the largest. Moving it to a list nobody reordered removes its order.
  - `"moveTodayTask reorders today and keeps done tasks after"`: ids [a, d(done), b, c]; moving c to 0 gives `[c, a, b, d]`.
  - `"moveTodayTask changes nothing on yesterday's list"`.
  - `"sublabel is trimmed, capped at 30, cleared by empty, and copied by Duplicate"`.

- [ ] **Step 2: Run** `npx vitest run src/store/actions.test.ts`. Expected: FAIL (`moveTask` not exported).

- [ ] **Step 3: Implement** the actions and the `useStudium` wiring, following how `togglePriority` and `addToToday` are wired.

- [ ] **Step 4: Run** `npx vitest run src/store` and `npm run typecheck`. Expected: PASS.

- [ ] **Step 5: Commit** `feat(store): move tasks within a list and within Today; sublabels`.

### Task 3: Reordering in the three lists

**Files:**
- Create: `web/src/components/ReorderControls.tsx` (the grip, plus ↑ and ↓ buttons) and `web/src/ui/reorder.ts` (`dropIndex`)
- Modify: `web/src/components/RequirementCard.tsx` (use `sortListTasks` instead of its own sort), `web/src/components/RequirementsSection.tsx` (Unlinked), `web/src/components/Overview.tsx` (Today: unfinished in `taskIds` order, then done; controls on unfinished rows only)
- Test: `web/src/ui/reorder.test.ts`, `web/src/components/RequirementCard.test.tsx`, `web/src/components/Overview.test.tsx`

**Interfaces:**
- Consumes: `s.moveTask`, `s.moveTodayTask`, `sortListTasks`.
- Produces:
  - `dropIndex(pointerY: number, rowMids: number[], fromIndex: number): number`, which gives the target index among the rows (rowMids are the vertical midpoints of the unfinished rows, in order);
  - `<ReorderControls title={string} index={number} count={number} onMove={(toIndex: number) => void} onGripPointerDown={(e) => void} />`.

How it works:
- The buttons are labelled `Move {title} up` and `Move {title} down`. They're disabled at the ends.
- The grip `⋮⋮` has `aria-hidden` and `title="Drag to reorder"`.
- The drag uses pointer events: capture on the grip, and on pointerup measure the rows with `getBoundingClientRect`, then call `onMove(dropIndex(...))`. While dragging, show a 2px line in the project color at the drop spot. Esc or pointercancel cancels.
- Done rows get no controls.
- Rows are keyed by task id, so React keeps the clicked button mounted and focus stays on it. If that button became disabled (moved to an end), focus moves to the other arrow.

- [ ] **Step 1: Write the failing tests:**
  - `reorder.test.ts`:
    - `dropIndex(5, [10, 30, 50], 2)` is 0;
    - `dropIndex(45, [10, 30, 50], 0)` is 1, because dropping before the row whose midpoint is below the pointer accounts for removing the dragged row;
    - `dropIndex(99, [10, 30, 50], 0)` is 2.
  - `RequirementCard.test.tsx`, `"Move up reorders the tasks, saves it, and keeps focus"`: click `Move APK up`. The task text order on screen changes, `savedData(storage)` has orders, and `document.activeElement` is the `Move APK up` button (or `Move APK down` if APK is now first).
  - `RequirementCard.test.tsx`, `"done tasks have no move buttons"`.
  - `RequirementCard.test.tsx`, `"dragging the grip drops a task in a new place"`: stub `getBoundingClientRect` on the rows, then fire pointerdown on the grip, pointermove, and pointerup.
  - `Overview.test.tsx`, `"Today can be reordered and done tasks sit at the bottom"`.

- [ ] **Step 2: Run** `npx vitest run src/ui/reorder.test.ts src/components/RequirementCard.test.tsx src/components/Overview.test.tsx`. Expected: FAIL.

- [ ] **Step 3: Implement** `dropIndex`, `ReorderControls`, and their use in the three lists. In the Overview's dark panel, the controls use the panel's `text-white/50` colors.

- [ ] **Step 4: Run** the same tests plus `npx vitest run src/components`. Expected: PASS, including the existing RequirementCard, Overview and TaskRow tests.

- [ ] **Step 5: Commit** `feat(planner): reorder tasks by drag or Move up/down in requirements, Unlinked and Today`.

### Task 4: Sublabel in the form and on the card

**Files:**
- Modify: `web/src/components/RequirementForm.tsx` (`RequirementFormValues.sublabel: string`), `RequirementsSection.tsx` and `RequirementCard.tsx` (pass it through, and show the tag)
- Test: `web/src/components/RequirementCard.test.tsx`

**Interfaces:**
- Consumes: `updateRequirement`/`createRequirement` with `sublabel` (Task 2).
- Produces: `<SublabelTag text={string} />`, exported from `RequirementCard.tsx` for Task 6's collapsed line. It renders a small muted tag: `text-[10px] font-mono uppercase tracking-widest border px-1.5`, like the existing Pending tag.

The form field:
- labelled `Sublabel (optional)`, with `aria-label="Sublabel"`;
- `maxLength={30}`;
- placed under the title.

- [ ] **Step 1: Write the failing test** `"sets, shows, edits and clears a sublabel"`:
  - edit Prototype 11, type `Accessibility`, and save; the tag `Accessibility` shows and `savedData` has `sublabel: "Accessibility"`;
  - edit again and clear it; the tag is gone and the field is removed from the saved requirement.

- [ ] **Step 2: Run** `npx vitest run src/components/RequirementCard.test.tsx`. Expected: FAIL (no Sublabel field).

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Run** the same test and `npm run typecheck`. Expected: PASS.

- [ ] **Step 5: Commit** `feat(planner): optional sublabel on requirements`.

### Task 5: View logic and device prefs

**Files:**
- Create: `web/src/planner/requirementView.ts`, `web/src/ui/viewPrefs.ts`
- Test: `web/src/planner/requirementView.test.ts`, `web/src/ui/viewPrefs.test.ts`

**Interfaces:**
- Produces:
  - `type RequirementView = "all" | "today" | "hideCompleted" | "soon"`;
  - `VIEW_LABELS: Record<RequirementView, string>`, holding the four copy strings;
  - `isSoon(req: Requirement, project: Project, tasks: Task[], now: Date): boolean`;
  - `viewOf(projectId: string, data: StudiumData, view: RequirementView, now: Date): { requirements: Requirement[]; tasksShown: (requirementId: string | null) => (t: Task) => boolean; hiddenCount: number; showUnlinked: boolean }`.

  In `viewOf`, `requirements` keeps the data's order. `hiddenCount` is the number of the project's requirements that aren't shown. What each view keeps:

  | View | Requirements shown | Tasks shown | Unlinked shown |
  |---|---|---|---|
  | all | every one | all | yes |
  | today | those with a task in `todayTaskIds(data, now)` | today's only | only if it has a task on today's list |
  | hideCompleted | those that aren't `isRequirementDone` | unfinished only | yes, with done tasks hidden |
  | soon | `isSoon` ones | all | no |

  - `type ViewPrefs = { view: RequirementView; collapsed: string[] }`;
  - `loadViewPrefs(storage: Storage | null, projectId: string): ViewPrefs`;
  - `saveViewPrefs(storage: Storage | null, projectId: string, prefs: ViewPrefs): void`.

  The key is `studium.requirementView.<projectId>`. The defaults are `{ view: "all", collapsed: [] }`. Bad JSON, an unknown view, or a non-string id fall back to the defaults or drop the bad id. Storage errors are swallowed.

- [ ] **Step 1: Write the failing tests:**
  - `requirementView.test.ts`. Use `NOW` from testData (2026-10-14).
    - `isSoon` with:
      - due 10-17: true (today + 3);
      - due 10-18: false;
      - due 10-01 and unfinished: true (overdue);
      - due 10-01 with all tasks done: false;
      - no due date, project deadline 10-16: true;
      - a requirement with zero tasks due 10-15: true.
    - `viewOf`:
      - today: only requirements with today's tasks, and yesterday's list counts as empty;
      - hideCompleted: a zero-task requirement stays;
      - `hiddenCount` is correct in every view.
  - `viewPrefs.test.ts`:
    - saving and loading round-trip per project;
    - `"{bad"` gives the defaults;
    - `{view:"weird"}` gives `view: "all"`;
    - `collapsed: ["a", 5]` gives `["a"]` (Review Focus 4);
    - a null storage gives the defaults.

- [ ] **Step 2: Run** `npx vitest run src/planner/requirementView.test.ts src/ui/viewPrefs.test.ts`. Expected: FAIL (modules missing).

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Run** the same tests. Expected: PASS.

- [ ] **Step 5: Commit** `feat(planner): requirement views (today, hide completed, soon) and per-device view prefs`.

### Task 6: Collapse and the ≡ menu

**Files:**
- Modify: `web/src/components/RequirementCard.tsx`, adding these props:
  - `collapsed?: boolean`;
  - `onToggleCollapsed?: () => void`;
  - `taskFilter?: (t: Task) => boolean`;
  - `reorderable?: boolean`, default true.
- Modify: `web/src/components/RequirementsSection.tsx` (≡ menu, state from `loadViewPrefs`/`saveViewPrefs` using `browserStorage()`, empty and hidden lines)
- Test: `web/src/components/RequirementsSection.test.tsx` (new)

**Interfaces:**
- Consumes: `viewOf`, `VIEW_LABELS`, `loadViewPrefs`, `saveViewPrefs` (Task 5), and `SublabelTag` (Task 4).

**Collapse toggle**
- The toggle is a button before the title, `▾` when open and `▸` when collapsed.
- Its label is `Collapse {title}` or `Expand {title}`, with `aria-expanded`.
- **Collapsed**, the card renders only one line:
  - the toggle;
  - the title;
  - the `SublabelTag`;
  - `Due {formatDate(dueDate ?? project.deadline)}`;
  - `<WaitingOn>`.

  The progress bar, tasks, buttons and forms are hidden.
- A card that's being edited can't be collapsed: the toggle is disabled while `mode === "edit"`.

**≡ menu**
- The button sits at the top right, next to `+ Add {requirement}`.
- Its text is `≡`, or `≡ {label}` when the view isn't all. Its `aria-label` is `Requirements view`, with `aria-haspopup="menu"` and `aria-expanded`.
- It opens on click. Arrow keys move between items, and Esc closes the menu and returns focus to the button. A click outside closes it.
- **Items:**
  - `Collapse all`, or `Expand all` when every **shown** requirement is collapsed. Collapse all adds every shown id; Expand all removes them.
  - A separator.
  - The four views as `menuitemradio` with `aria-checked`. Choosing one sets the view and closes the menu.

**What each view shows**
- Cards get `taskFilter` from `tasksShown`.
- `reorderable` is false in the `today` view, because a filtered list would make a move ambiguous. Today is reordered on the Overview.
- The Unlinked section shows when `showUnlinked` is true.
- **Empty lines** (when the view shows zero requirements and the project has some):
  - soon: `Nothing due in the next 3 days.`
  - today: `Nothing on today's list for this project.`
  - hideCompleted: `Everything here is finished.`
- **Hidden line:** when `hiddenCount > 0` and the view isn't all, show `{n} more hidden by {label}` and a `Show all` button.
- A new requirement starts open (it isn't in `collapsed`).
- Prefs are saved on every change.

- [ ] **Step 1: Write the failing tests** in `RequirementsSection.test.tsx`, rendered with `renderWithStudium`:
  - `"collapses a requirement to one line with its sublabel, due date and Waiting on"`: the progress bar and tasks are gone, `Due …`, the sublabel and `Waiting on Prototype 9` are shown, and expanding brings it back.
  - `"Collapse all then Expand all from the ≡ menu"`: the menu item text flips.
  - `"one view at a time; Soon hides later requirements and says how many"`: pick Soon. The button reads `≡ Soon`, `1 more hidden by Soon` shows, and `Show all` restores.
  - `"Today's to-do shows only today's tasks"`.
  - `"empty Soon says Nothing due in the next 3 days."`
  - `"the view and collapsed requirements are remembered on this device"`: unmount, render again with the same storage, and they're still set.
  - `"the menu works from the keyboard and Esc returns focus"`.

- [ ] **Step 2: Run** `npx vitest run src/components/RequirementsSection.test.tsx`. Expected: FAIL.

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Run** `npm test` and `npm run typecheck`. Expected: the whole suite passes.

- [ ] **Step 5: Commit** `feat(planner): collapse requirements and a ≡ view menu (today, hide completed, soon)`.

### Task 7: Check in the app, and the docs

**Files:**
- Modify: `HANDOFF.md` (a section "Reordering, the requirements view, and sublabels": order is lazy and per list; views and collapse are per device and per project; Today's list is last-write-wins), `docs/ROADMAP.md` (mark this done in the schedule; follow-up: a setting for Soon's days, ≡ opening on hover)

- [ ] **Step 1:** Run the dev desktop app on a scratch user-data copy:

  ```
  env -u ELECTRON_RUN_AS_NODE npx electron . "--user-data=<scratch>"
  ```

  Reorder by drag and by the arrows, collapse, switch views and add a sublabel. Then take a screenshot and look at it.
- [ ] **Step 2:** Update the docs.
- [ ] **Step 3:** Run `npm test`. Expected: PASS.
- [ ] **Step 4: Commit** `docs: reordering, the requirements view and sublabels`.

# Requirement blocking, clearer "Blocked by", and three small changes

Date: 2026-10-30. Status: draft, builder-checked.
Applies to Studium (`web/`), so it is in both the browser version and the desktop app, plus one small
change to the pet code (see 5).

## Why

The user's appDev project has one requirement per weekly prototype (Prototype 9, Prototype 10, …).
Each prototype has its own tasks, including several tasks with the same name ("Git commit": each
prototype needs a set number of commits a week). Two things go wrong today:

- Nothing stops checking off Prototype 10's tasks before Prototype 9 is finished. The user wants the
  order enforced, so a commit is never counted toward the wrong week.
- In a task's "Blocked by" list, tasks show by title only, so the list has several identical
  "Git commit" rows and no way to tell which prototype each belongs to.

The other three changes came up at the same time: the starting balance is too generous, six project
colors are too few, and the project-type choice doesn't say what the types change.

## Changes

Words below say "requirement" and "task". Each project type shows its own words for these (`projectWords` in
`web/src/ui/format.ts`, e.g. chapters and scenes for Writing); every new piece of text uses them.

### 1. A requirement can be blocked by other requirements (the user's items 4 and 6)

- A requirement gets a "Blocked by" list of other requirements **in the same project**, set once on
  the requirement (in the requirement form, as tasks have today).
- A requirement is **finished** when it has at least one task and every one of its tasks is done.
  (My call: a requirement with no tasks doesn't count as finished, so an empty Prototype 9 doesn't
  quietly unlock Prototype 10.)
- While any requirement it is blocked by isn't finished, **none of its tasks can be checked off.**
  The user can still add, edit, delete, prioritize and plan those tasks; only completing is locked.
  Their checkboxes are disabled, as blocked tasks' are today, with the waiting line from 3
  ("Waiting on Prototype 9").
- **"Blocked by all other requirements"**: one option in the same list that means "wait until every
  other requirement in this project is finished". It follows the project as it changes (a requirement
  added later counts too), rather than ticking each one. Meant for things like a final submission.
  (The user agreed to this reading; it was my guess at what they meant.)
- Requirements can be **reopened**: if a task in Prototype 9 is unchecked, Prototype 10 is blocked
  again. Tasks already done in Prototype 10 stay done (and keep their tokens); only new completions
  are locked.
- No loops: a requirement can't (directly or through a chain) be blocked by itself. The form doesn't
  offer choices that would make a loop, as `blockerOptions` does for tasks. Two requirements that both
  use "all other requirements" would wait on each other forever, so that option is not offered to a
  requirement while another requirement in the project already uses it, and a requirement that uses
  it can't be picked as anyone's blocker. (My call.)
- **No loops through both levels either** (my call). Example: Prototype 10 is blocked by Prototype 9,
  and a task in Prototype 9 is blocked by a task in Prototype 10: neither can ever be checked off.
  So a choice is not offered (in the task form's or the requirement form's "Blocked by") if it would
  make something wait on itself through any mix of task blockers and requirement blockers, including
  "all other requirements". The same check runs in the store actions (as `cleanBlockers` does today)
  for the edits the forms can't filter: changing a task's requirement drops any of that task's own
  blockers that would now make a loop. Task-to-task blocking otherwise works as today; this only
  removes choices that could never be finished. Existing data can't already be in this state, since
  requirement blockers are new.
- Everything that already treats a blocked task as not workable treats a task in a blocked
  requirement the same way: completing it (`completeTask` in `store/actions.ts`), the checkboxes
  (Overview, TaskRow, App), "What should I work on?" / suggestions (`planner/suggest.ts`) and the
  pet's next task (`store/petStatus.ts`). Today these all go through `isBlocked` in
  `planner/blocking.ts`; the builder decides whether to widen that one function or add a second.
- Deleting a requirement removes it from other requirements' "Blocked by" lists (as deleting a task
  does today).
- Task-to-task blocking stays as it is.

### 2. "Blocked by" for tasks, grouped by requirement (item 7)

In the task form, the "Blocked by" choices are grouped under their requirement's name (and an
"Unlinked" group for tasks with no requirement), so it reads "Prototype 9 → Git commit". The user
asked for "a tab to sort by feature/requirement"; grouping is my reading of that, with no other sort
order needed. Wherever a blocker task is named elsewhere (TaskRow's waiting line), a task whose title
isn't unique in the project also shows its requirement (e.g. "Git commit (Prototype 9)"). (My call.)

### 3. "Waiting on 3" (item 5)

When a task or a requirement is waiting on more than one thing, it shows "Waiting on 3" instead of a
long list. For a task, the count is one combined list: its own open blocker tasks plus the unfinished
requirements its requirement waits on (with "all other requirements", each unfinished one counts).
A requirement's own card shows the same line for its unfinished blocker requirements. (My call.) Hovering shows the list in a small pop-up; on a touch screen tapping opens it, and it
closes on a second tap or a tap elsewhere. It's also reachable by keyboard (focus shows it). With one
blocker it names it directly ("Waiting on Prototype 9").

### 4. Starting tokens: 100 for new users

- `STARTING_TOKENS` drops from 650 to 100, **for people starting fresh only.**
- Today the balance is computed as starting tokens + earnings − purchases (`tokenBalance` in
  `planner/history.ts`), so simply changing the number would take 550 tokens from everyone with data
  and could make balances negative. The user chose: existing data keeps its balance.
- So the starting amount is saved with the data: new data (`emptyData`) records 100; data saved
  before this change has no such field and counts as 650. How it's stored is left to the builder (a
  field on `StudiumData` is the obvious route; the data keeps `version: 1`, and old data must still
  load).
- The example data (`buildSeed`) keeps its current balance (my call: it's for demos and tests).

### 5. More project colors (item 2)

The six swatches in the project form (`PROJECT_COLORS`) stay as quick picks. A seventh "Custom"
swatch opens a color picker with the full range (a color wheel or the system picker:
`<input type="color">` is acceptable, my call). The chosen color is used everywhere the project color
is used today: rings, bars, sticky notes, the pet's notes on the desktop. The pet code
(`extension/content/pet.js`, which the desktop app will reuse) draws white text on the project color
for the pet's name label and notes; that text switches to a dark color when the project color is
light. This is the one change outside `web/` (my call: small, and needed so a light custom color
stays readable). The Custom swatch shows the
current custom color once one is picked. Studium has a dark mode; very light or very dark picks
aren't blocked, but where the color is used as text the builder makes sure it stays readable (e.g.
falls back to the normal text color, or uses the color only for borders and fills).

### 6. A short explanation of each project type (item 3)

Under the Type choice (in the New Project / edit form and in first-run Setup), one line explains the
selected type, changing as the user picks, like the Difficulty hint does now. The line says what the
type changes, using `projectWords`, e.g. "Writing: requirements are chapters and tasks are scenes."
Exact wording is the builder's, kept to one short line each.

## Not doing

- Blocking across projects.
- Partial unlocking (e.g. "after 3 of Prototype 9's commits").
- Changing task-to-task blocking, earning rules or shop prices.
- Copying a requirement with its tasks (a "duplicate Prototype 9 as Prototype 10" button). The user
  didn't ask for it here; worth raising later.

## Anti-goals

- Never lose or change existing data: old saved data loads, old balances stay, existing task
  blockers keep working.
- Locked tasks must never feel broken: whenever a checkbox is disabled, the reason is on screen.

## Testing

Vitest in the existing style: the new blocking rules (finished, blocked, "all other requirements",
loops, reopening, deleting), the starting balance for new versus old data, loading old data, and
component tests for the grouped "Blocked by", "Waiting on N", the custom color and the type hint.

## Left to the builder

- The data shape of a requirement's blockers and the "all other requirements" option.
- Where the requirement "Blocked by" control sits in the requirement form, and how the pop-up looks.
- The color picker's look.
- Branch: a new branch from `feature/desktop-app` (my call, since that branch has the latest code).

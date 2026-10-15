# Studium Planner Logic — Design

_Date: 2026-10-14. Status: approved in conversation, awaiting written-spec review._

## Goal

Turn Studium from a checklist into a planner that rewards real, planned progress toward finishing projects and is hard to game by checking off easy tasks. The browser pets become the only pets: their mood reflects whether each project is on track, and on a project page the project's pet lives in that page's habitat.

## The eight rules (from the request)

1. Each requirement has a fixed weight, split among its tasks.
2. Tasks not linked to a requirement are worth nothing. Every task should belong to a requirement.
3. Finishing requirements is rewarded more than starting them.
4. Tasks are valued by what they unblock ("forced progression").
5. Pet mood depends on actual progress against the plan, not on activity.
6. Diminishing returns on the number of tasks finished in a day, as a backstop.
7. Neglected requirements are tracked: working on a stale one earns a bonus, and long neglect makes the pet react (and eventually get sick).
8. Rough estimates are asked for on each task and the actual time is recorded. Over time this adjusts how a requirement's weight is split.

## Decisions made during brainstorming

| Topic | Decision |
|---|---|
| What value turns into | It moves project progress, and tokens are paid in proportion to it. Mood is separate. |
| The plan | Each requirement has an optional due date (falling back to the project deadline). Planned progress rises steadily from creation to due date. |
| Blocking | Task-level "blocked by" links within a project, across requirements. Chains count. |
| Actual time | Asked for when a task is checked off, with quick choices and the estimate pre-selected. Can be skipped. |
| Learning | Changes how a requirement's weight is split among its tasks and adjusts open-task estimates. Requirement weights never change automatically. |
| Pets | Studium's drawn companions are removed. Browser pets are the only pets. On a project page only that project's pet shows, living inside the habitat box. |
| Storage | Event log plus scores calculated from it, saved in localStorage. No backend yet. |
| Today's Goals | Replaced by picking existing tasks for today, shown in Priority Focus. |
| Recovery | Long neglect makes the pet Sick. Medicine from the shop cures it and starts a 3-day Recovering period. |
| Pet choice | An egg picker in the New Project form with vague descriptions. The pet hatches straight away for now. |

## 1. Data model

All data is saved in the browser under one localStorage key, `studium-data-v1`, as JSON with a `version` field.

```ts
type PetKind = "cat" | "dog" | "frog" | "pigeon" | "turtle";

type Project = {
  id: string;
  name: string;
  shortName: string;
  color: string;
  deadline: string;        // "YYYY-MM-DD", local time
  description: string;
  petKind: PetKind;
  hatchedAt: string;       // ISO time; set at creation for now (lifecycle later)
  createdAt: string;       // ISO time
};

type Requirement = {
  id: string;
  projectId: string;
  title: string;
  weight: number;          // whole number 1–10
  startDate: string | null; // "YYYY-MM-DD"; null means the day it was created
  dueDate: string | null;  // "YYYY-MM-DD"; null means the project deadline
  createdAt: string;
};

type Task = {
  id: string;
  projectId: string;
  requirementId: string | null; // null = unlinked, worth 0
  title: string;
  estimateMin: number;
  blockedBy: string[];          // task ids in the same project
  priority: boolean;            // manual pin in Suggested next
  done: boolean;
  actualMin: number | null;     // set when completed, if the user answered
  createdAt: string;
};

type StudiumEvent =
  | { type: "task_created"; at: string; taskId: string }
  | { type: "task_completed"; at: string; taskId: string; actualMin: number | null; tokens: number; breakdown: TokenBreakdown }
  | { type: "task_reopened"; at: string; taskId: string }
  | { type: "task_edited"; at: string; taskId: string; changes: Partial<Task> }
  | { type: "requirement_created"; at: string; requirementId: string }
  | { type: "requirement_edited"; at: string; requirementId: string; changes: Partial<Requirement> }
  | { type: "purchase"; at: string; productId: string; price: number }
  | { type: "medicine_given"; at: string; projectId: string };

type StudiumData = {
  version: 1;
  projects: Project[];
  requirements: Requirement[];
  tasks: Task[];
  events: StudiumEvent[];     // only ever appended to
  today: { date: string; taskIds: string[] }; // "Today's plan"; resets when the date changes
};
```

- IDs use `crypto.randomUUID()`, replacing `Date.now()` ids.
- **Token balance** = 650 + sum of `tokens` on `task_completed` events − sum of `price` on `purchase` events.
- **Inventory** is calculated, not saved: count of `purchase` events per product, minus one Medicine per `medicine_given` event.
- **Paying once:** a `task_completed` event pays tokens only if no earlier `task_completed` event exists for that task. Later completions record `tokens: 0`.
- The payout and its breakdown are stored in the event, so recalculating with new rules never changes the balance.
- `task_created` and `requirement_created` timestamps feed the plan and neglect clocks.

### Seed data

The five example projects (webDev, appDev, Animation, seniorCap, petExt) each get 3–4 requirements with weights and due dates. Their existing tasks are linked to those requirements and given estimates and a few `blockedBy` links, so every rule has something to show on first load. Pet kinds match the extension today: webDev pigeon, appDev dog, Animation frog, seniorCap cat, petExt turtle. Completed seed tasks get back-dated `task_completed` events, with `tokens: 0` so the starting balance stays 650. Seed requirements get back-dated `createdAt` values (and seed completions are spread over past days) so the example projects start with a mix of moods: at least one on track, one behind, and one requirement idle long enough to be neglected. The seed is built relative to the current date at first load, so it looks the same whenever it's first opened.

## 2. Value rules

All constants live in `web/src/planner/tuning.ts`.

| Constant | Default | Meaning |
|---|---|---|
| `POOL_PER_WEIGHT` | 100 | value per weight point |
| `TASK_SHARE` | 0.70 | part of the pool shared among tasks |
| `FINISH_SHARE` | 0.30 | part paid when the requirement's last task is done |
| `UNBLOCK_BONUS_PER_TASK` | 0.15 | per task unblocked, counting chains |
| `UNBLOCK_BONUS_MAX` | 0.60 | |
| `NEGLECT_BONUS_START_DAYS` | 5 | bonus starts counting after this many idle days |
| `NEGLECT_BONUS_PER_DAY` | 0.05 | per idle day beyond `NEGLECT_BONUS_START_DAYS` |
| `NEGLECT_BONUS_MAX` | 0.50 | |
| `DAILY_FULL_PAY_COUNT` | 5 | completions per local day at full pay |
| `DAILY_DECAY` | 0.80 | multiplier per completion beyond that |
| `DAILY_FLOOR` | 0.25 | |
| `TOKENS_PER_VALUE` | 0.30 | |

**Requirement pool.** `pool = weight × POOL_PER_WEIGHT`. Unlinked tasks have value 0.

**Task effort.** A done task's effort is `actualMin ?? estimateMin`. An open task's effort is `estimateMin × multiplier(project)` (section 3). A requirement with no tasks has 0 progress.

**Task base value.** `pool × TASK_SHARE × effort / totalEffort(requirement)`, using the effort figures at the moment of completion.

**Unblock bonus.** Count the open tasks that depend on this task, directly or through a chain of `blockedBy` links (each task counted once). Bonus = `min(UNBLOCK_BONUS_MAX, count × UNBLOCK_BONUS_PER_TASK)`.

**Neglect bonus.** `idleDays` is defined in section 3. Bonus = `min(NEGLECT_BONUS_MAX, max(0, idleDays − NEGLECT_BONUS_START_DAYS) × NEGLECT_BONUS_PER_DAY)`. Example: 7 idle days gives +10%; 5 or fewer gives nothing; 15 or more hits the +50% cap. While the project is Recovering, the neglect bonus for its neglected requirements is doubled; the max is doubled too.

**Finish bonus.** When a completion leaves the requirement with every task done, it also pays `pool × FINISH_SHARE`. Like task payouts, this is paid once per requirement, the first time it becomes fully done.

**Daily curve.** Count the completions already paid today (local calendar day, all projects). The k-th payout of the day (1-based) gets `k ≤ DAILY_FULL_PAY_COUNT ? 1 : max(DAILY_FLOOR, DAILY_DECAY ^ (k − DAILY_FULL_PAY_COUNT))`.

**Sick penalty.** If the task's project is Sick at the moment of completion, the payout is halved (`SICK_TOKEN_MULTIPLIER = 0.5`).

**Tokens for a completion.**
```
tokens = round( (baseValue × (1 + unblockBonus + neglectBonus) + finishBonus)
                × dailyCurve × sickMultiplier × TOKENS_PER_VALUE )
```
The breakdown (base, unblock %, neglect %, finish, daily curve, sick) is stored in the event and shown to the user.

**Progress.** A requirement's progress is `effort of done tasks / total effort`, with no bonuses. A project's progress is the weight-weighted average of its requirements' progress. Unlinked tasks don't count. Total progress on the overview is the weight-weighted average across all projects.

**Blocking.** A task can't be completed while any `blockedBy` task is open. The blocked-by picker leaves out the task itself and any task that would create a loop.

## 3. Plan, mood, neglect, learning

### Plan

For a requirement with start `s` = start of the local day `startDate` (or `createdAt` when `startDate` is null) and due `d` = end of the local day `dueDate ?? project.deadline`:

`planned(t) = clamp((t − s) / (d − s), 0, 1)`. Before `s` it is 0. If `d ≤ s`, planned is 1 once `t ≥ s`.

The start date lets you plan requirements in sequence: one that hasn't started yet isn't expected to have any progress, and can't be neglected (below).

`gap = Σ weight × (actual − planned) / Σ weight` over the project's requirements, in percentage points.

### Mood

| Condition | Mood |
|---|---|
| every requirement 100% done | Proud |
| gap ≥ +10 | Delighted |
| −10 < gap < +10 | Happy |
| −25 < gap ≤ −10 | Worried |
| gap ≤ −25 | Upset |

Then, in order:
1. If any requirement is **neglected**, lower the mood one level (Delighted → Happy → Worried → Upset; Upset and Proud stay).
2. If the project is **Sick**, the mood is Sick.
3. If the project is **Recovering**, the mood is capped at Worried.

### Neglect

- **Idle days** for a requirement: whole days since the latest of: its start (`s` above), or the last `task_completed` event for one of its tasks. Before the start it is 0.
- A requirement is **neglected** when idle ≥ 7 days (`NEGLECT_DAYS`), it isn't fully done, and its planned progress is above 0.
- A project is **Sick** when any requirement has been idle ≥ 14 days (`SICK_DAYS`) under the same conditions, and the project isn't Recovering.

### Sick and Medicine

- **Medicine** is a shop product (category **Care**, price 80). Buying it adds it to the inventory.
- A sick pet's habitat shows **Give medicine** (enabled when the inventory holds one). Giving it records `medicine_given` and uses one up.
- **Recovering** lasts 3 days (`RECOVERY_DAYS`) from `medicine_given`. During it: the project isn't Sick, there's no sick penalty, mood is capped at Worried, and the neglect bonus is doubled for requirements that were neglected when the medicine was given.
- Recovery ends early once each of those requirements has had a task completed after the medicine. Then there's no cap.
- If recovery runs out and a requirement is still idle 14+ days, the project is Sick again.
- Medicine doesn't change idle days.
- Medicine can't be given to a pet that isn't sick.

### Learning (estimate multiplier)

- Samples: completed tasks with both `estimateMin` and `actualMin`, newest first, at most 20 per project.
- `overall = (Σ actual + 5 × 1.0 × avgEstimate) / (Σ estimate + 5 × avgEstimate)` over all projects' samples. This leans toward 1.0 with few samples, as if 5 samples matched their estimates exactly.
- `project = (n × projectRatio + 5 × overall) / (n + 5)`, where `projectRatio = Σ actual / Σ estimate` over the project's `n` samples.
- Both are clamped to [0.5, 3].
- Shown as: "Your appDev tasks take about 1.4× your estimates". Hidden until the project has at least 3 samples.

## 4. Screens

### Project page

- **Requirements** section (replaces Project Tasks and Today's Goals). One card per requirement: title, weight, due date, progress bar with a planned-progress tick, idle days (highlighted when neglected). Its tasks are listed inside: checkbox, title, estimate, lock with "waiting on: …" when blocked, priority flag, "add to today".
- **Unlinked** group at the bottom, each task with a "link to a requirement" control.
- **Add requirement**: title, weight (1–10), optional start date, optional due date.
- **Add task**: title, requirement (defaults to the card it's added from), estimate (quick buttons 15m, 30m, 1h, 2h, 4h, 8h, or a number), blocked by (multi-select).
- **Edit / delete** for requirements and tasks. Deleting a requirement asks whether to delete its tasks or move them to Unlinked.
- **Completing a task** opens a small "About how long did it take?" prompt with the same quick buttons, the estimate pre-selected, and a skip option. Then a message shows the tokens earned and the breakdown.
- Un-checking a done task records `task_reopened`. No tokens change.
- **Habitat** (bottom, replaces Tamagotchi Habitat):
  - A box element `<div data-pet-habitat="<projectId>">` that the extension fills.
  - If the extension hasn't marked it as filled (`data-pet-attached`) within 1 s, a still image of the animal is shown instead (art copied to `web/public/pets/`).
  - Beside it: **Mood** (label plus "N points ahead of/behind plan"), **Attention** ("All requirements active" or "<requirement>: N days idle"), **Estimate accuracy** (multiplier sentence), and **Give medicine** when Sick.
  - The first view after creation shows "It hatched: a <kind>!".

### Overview

- Total progress and rings use weighted progress.
- **Priority Focus** has two parts:
  - **Today**: tasks picked for today, across projects, can be checked off there. Clears when the date changes.
  - **Suggested next**: open, unblocked, linked tasks not already in Today, ranked by expected tokens right now (base value with unblock and neglect bonuses). Pinned (flagged) tasks first. Each has "add to today". Shows the top 6.
- Project cards show mood and "N points ahead/behind".

### Shop

- New **Care** category with Medicine.
- Balance is calculated from events.

### New Project form

- Name, short label, deadline, description, color (as now), plus a required **egg picker**:
  - Five placeholder eggs (same SVG egg shape, different speckle pattern and tint, tints chosen not to hint at the animal).
  - Shuffled each time the form opens.
  - Selecting or focusing an egg shows its description below. Arrow keys move between eggs.
  - Descriptions live in one list (`web/src/pets/eggs.ts`):
    - cat: "Something in here likes warm spots and long naps."
    - dog: "It's already wiggling. It can't wait to meet you."
    - turtle: "Heavy and calm. In no hurry at all."
    - frog: "Cool and a little damp. It twitched when you blinked."
    - pigeon: "It keeps leaning toward the window, as if it wants to be up high."
- On create the pet hatches straight away (`hatchedAt = createdAt`).
- Projects can also be edited and deleted (deadline, name, color; pet kind can't be changed).

## 5. Extension link

### Studium → extension

- After every change, Studium writes `studium-pets-v1` to localStorage:
  ```ts
  type PetStatus = {
    projectId: string; shortName: string; name: string; color: string;
    petKind: PetKind; mood: "Proud" | "Delighted" | "Happy" | "Worried" | "Upset" | "Sick";
    recovering: boolean; idleRequirement: { title: string; days: number } | null;
  };
  // { updatedAt: string, pets: PetStatus[] }
  ```
  and dispatches `window.dispatchEvent(new Event("studium:pets-updated"))`.
- Studium also rewrites it on load and once an hour while open, because mood changes with time even without edits.
- The content script, when running on the Studium origin (`HOMEPAGE_URL`), reads `studium-pets-v1` on load and on that event, and saves it to `chrome.storage.local` as `petStatuses`. Every tab listens for changes and rebuilds its pets.
- The hard-coded `PROJECTS` list in `pet.js` is removed. Before Studium has ever been opened, the extension shows no pets and the toolbar tooltip says to open the homepage. Saved x positions stay keyed by project id.

### Habitat mode

- On the Studium page, the content script watches for `[data-pet-habitat]` (MutationObserver).
- When present: all pets except the matching project's are hidden, and that pet's world becomes the habitat box (read with `getBoundingClientRect` each frame): its floor, walls and ceiling. It walks, naps, hops, flies, and can be dragged and thrown, all inside the box. The script sets `data-pet-attached` on the box.
- When the habitat is removed, the pets go back to normal and the habitat pet returns to its saved floor position.

### Mood behavior

| Mood | Speed | Sounds | Other |
|---|---|---|---|
| Proud / Delighted | ×1.2 | twice as often | occasional extra hop |
| Happy | ×1 | normal | |
| Worried | ×0.7 | half as often | |
| Upset | ×0.5 | says "…" | pauses longer; cat nap chance ×1.5 |
| Sick | ×0.3 | none; sometimes "achoo" | faint green tint, no naps or flying |

When `idleRequirement` is set, the pet sometimes shows "Haven't seen <title> in N days" (at most once every 2 minutes per pet).

## 6. Code layout

```
web/src/
  planner/          pure functions, no React
    tuning.ts       all constants above
    types.ts
    value.ts        pools, effort split, bonuses, daily curve, payout
    progress.ts     requirement/project progress, plan, gap
    mood.ts         mood, neglect, sick/recovering
    learning.ts     estimate multipliers
    blocking.ts     dependency chains, loop check
    suggest.ts      Suggested next ranking
    *.test.ts
  store/
    storage.ts      load/validate/save, seed, backup of damaged data
    seed.ts
    actions.ts      functions that apply a user action and append events
    useStudium.ts   React hook exposing data + actions
    petStatus.ts    builds and publishes studium-pets-v1
  pets/
    eggs.ts         egg descriptions and looks
  components/       Overview, ProjectDetail, RequirementCard, TaskRow,
                    CompletionPrompt, Habitat, Shop, ProjectModal, EggPicker
  App.tsx           shell and navigation only
```

Every planner function takes `now: Date` as an argument instead of reading the clock.

## 7. Error handling

- On load, saved data is validated (shape, ids referenced exist, version). If it fails, the raw text is kept under `studium-data-backup-<timestamp>`, the seed is loaded, and a dismissible notice explains what happened.
- If localStorage can't be read or written, Studium runs from memory for that visit and shows a "changes won't be saved" notice.
- Unknown event types are kept but ignored when calculating, so newer data doesn't break an older build.

## 8. Testing

- **Unit tests (Vitest)** for every `planner/` module: effort split and learning effect, finish bonus paid once, unblock chains with shared descendants, loop detection, neglect bonus thresholds, daily curve (5th, 6th, floor), paying once after reopen, multiplier shrinkage and clamping, every mood threshold, neglect lowering mood, Sick at 14 days, medicine → Recovering cap → early end → sick again after 3 days, sick payout halving.
- **Storage tests**: valid round trip, damaged data falls back to the seed with a backup, missing storage.
- **Browser check (Playwright, scratch script)**: on a project page only that project's pet is shown and stays inside the habitat, including after a throw; leaving the page restores all pets; a mood change in Studium reaches pets in another tab; the egg picker shows descriptions and its order is shuffled.
- `npm run build` (type check plus build) and `npm test` must pass.

## 9. Order of work

1. `planner/` with tests.
2. `store/` (data, seed, saving, events) with tests.
3. Project page (requirements, tasks, completion prompt, habitat readouts).
4. Overview (Priority Focus Today and Suggested), shop (Care, balance), project modal with egg picker.
5. Extension: read pet statuses, habitat mode, mood behavior, remove `PROJECTS`.

Each step leaves the app building and usable.

## Out of scope

Backend or accounts, syncing between devices, the pet lifecycle (hatching later, growing), using food, clothes or toys, and real animation frames.

# Planner Core Implementation Plan (Plan 1 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Studium's planner rules (value, tokens, progress, plan, mood, neglect, sickness, learning, suggestions) and its data layer (example data, saving, user actions) as plain, fully unit-tested TypeScript, with no UI changes.

**Architecture:** `web/src/planner/` holds pure functions that take the saved data and the current time and return numbers or labels; every tunable number lives in `planner/tuning.ts`. `web/src/store/` holds the example data, localStorage loading/saving with validation, and "actions" — pure functions that apply a user action to the data and append to the event history. Plan 2 wires these into the screens; Plan 3 connects the extension.

**Tech Stack:** TypeScript 5.9 (strict), Vitest, Vite 8, React 19 (untouched in this plan).

**Spec:** `docs/superpowers/specs/2026-10-14-studium-planner-design.md`

## Global Constraints

- Every function in `planner/` and `store/` that depends on time takes `now: Date` as an argument. Never call `Date.now()` or `new Date()` without arguments in these folders (ids from `crypto.randomUUID()` are fine).
- Dates stored as `"YYYY-MM-DD"` are local dates. Convert them only with `startOfLocalDay` / `endOfLocalDay` from `planner/time.ts`; never `new Date("YYYY-MM-DD")` (that is UTC midnight).
- All tunable numbers are imported from `planner/tuning.ts`; no magic numbers in rule code.
- No React imports in `planner/` or `store/`.
- localStorage key `studium-data-v1`; damaged-data backups use the prefix `studium-data-backup-`.
- Starting tokens 650. Medicine costs 80 and has product id `medicine`.
- Requirement weight is a whole number from 1 to 10.
- `web/src/App.tsx` and the rest of the UI are not changed in this plan; `npm run build` must keep passing after every task.
- Run all commands from `web/` (`cd web` first). Commits end with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Requirements with no tasks, or tasks with zero/garbage estimates** — progress and value must be 0, never `NaN`. Pinned in Task 5 (`requirementProgress` with no tasks) and Task 9 (`createTask` with `NaN` estimate).
2. **A `blockedBy` id that points at a deleted task** — the task must not be stuck blocked forever. Pinned in Task 3 (`isBlocked` ignores unknown ids) and Task 9 (`deleteTask` strips references).
3. **Checking a task off, un-checking and re-checking it repeatedly** — tokens are paid once, and zero-token re-completions don't use up the day's full-pay completions. Pinned in Task 9.
4. **Time of day and requirements that haven't started** — idle days are never negative and a requirement whose start date is in the future is never neglected; the example data has the same moods whether it is built at noon or 23:30. Pinned in Task 6 and Task 11.
5. **Old, hand-edited or damaged saved data** (bad JSON, references to missing projects, unknown event types) — Studium must load (falling back to the example data and keeping a backup when needed) instead of crashing. Pinned in Task 10.

---

## File Structure

```
web/
  package.json                 + vitest, "test" script
  src/planner/
    types.ts                   data types (Project, Requirement, Task, events, Mood)
    tuning.ts                  every tunable number
    time.ts                    local-date helpers
    testData.ts                fixture builders used only by tests
    history.ts                 facts derived from the event list (balance, inventory, last completion…)
    blocking.ts                blocked-by checks, unblock counts, loop detection
    learning.ts                estimate multipliers
    progress.ts                effort, requirement/project progress, plan, schedule gap
    mood.ts                    neglect, sick/recovering, mood
    value.ts                   task value, bonuses, daily curve, completion payout, expected tokens
    suggest.ts                 "Suggested next" ranking
    *.test.ts                  one test file per module
  src/store/
    products.ts                shop catalog (incl. Medicine)
    actions.ts                 user actions as pure data → data functions
    storage.ts                 validate, load, save, backups
    seed.ts                    example data built relative to "now"
    *.test.ts
README.md                      short "Planner core" section
```

---

### Task 1: Test setup, types, tuning, time helpers, fixtures

**Files:**
- Modify: `web/package.json`
- Create: `web/src/planner/types.ts`, `web/src/planner/tuning.ts`, `web/src/planner/time.ts`, `web/src/planner/testData.ts`
- Test: `web/src/planner/time.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - Types `PetKind`, `PET_KINDS`, `Project`, `Requirement`, `Task`, `TokenBreakdown`, `ZERO_BREAKDOWN`, `StudiumEvent`, `CompletedEvent`, `StudiumData`, `Mood`.
  - All constants in `tuning.ts` (names below).
  - `DAY_MS`, `localDateKey(d: Date): string`, `startOfLocalDay(key: string): Date`, `endOfLocalDay(key: string): Date`, `wholeDaysBetween(from: Date, to: Date): number`, `addDays(d: Date, n: number): Date`.
  - Test fixtures: `NOW`, `daysAgo(n)`, `dayKey(offset)`, `makeProject`, `makeRequirement`, `makeTask`, `completed`, `makeData`.

- [ ] **Step 1: Install Vitest and add the test script**

Run: `npm install -D vitest`

Then edit `web/package.json` `"scripts"` to:

```json
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
```

- [ ] **Step 2: Write `web/src/planner/types.ts`**

```ts
export type PetKind = "cat" | "dog" | "frog" | "pigeon" | "turtle";
export const PET_KINDS: readonly PetKind[] = ["cat", "dog", "frog", "pigeon", "turtle"];

export type Project = {
  id: string;
  name: string;
  shortName: string;
  color: string;
  deadline: string; // "YYYY-MM-DD", local
  description: string;
  petKind: PetKind;
  hatchedAt: string; // ISO time
  createdAt: string; // ISO time
};

export type Requirement = {
  id: string;
  projectId: string;
  title: string;
  weight: number; // whole number 1–10
  startDate: string | null; // "YYYY-MM-DD"; null = the day it was created
  dueDate: string | null; // "YYYY-MM-DD"; null = the project deadline
  createdAt: string;
};

export type Task = {
  id: string;
  projectId: string;
  requirementId: string | null; // null = unlinked, worth 0
  title: string;
  estimateMin: number;
  blockedBy: string[];
  priority: boolean;
  done: boolean;
  actualMin: number | null;
  createdAt: string;
};

export type TokenBreakdown = {
  base: number;
  unblockBonus: number;
  neglectBonus: number;
  finish: number;
  dailyCurve: number;
  sickMultiplier: number;
};

export const ZERO_BREAKDOWN: TokenBreakdown = {
  base: 0,
  unblockBonus: 0,
  neglectBonus: 0,
  finish: 0,
  dailyCurve: 1,
  sickMultiplier: 1,
};

export type StudiumEvent =
  | { type: "task_created"; at: string; taskId: string }
  | {
      type: "task_completed";
      at: string;
      taskId: string;
      actualMin: number | null;
      tokens: number;
      breakdown: TokenBreakdown;
    }
  | { type: "task_reopened"; at: string; taskId: string }
  | { type: "task_edited"; at: string; taskId: string; changes: Partial<Task> }
  | { type: "requirement_created"; at: string; requirementId: string }
  | { type: "requirement_edited"; at: string; requirementId: string; changes: Partial<Requirement> }
  | { type: "purchase"; at: string; productId: string; price: number }
  | { type: "medicine_given"; at: string; projectId: string };

export type CompletedEvent = Extract<StudiumEvent, { type: "task_completed" }>;

export type StudiumData = {
  version: 1;
  projects: Project[];
  requirements: Requirement[];
  tasks: Task[];
  events: StudiumEvent[]; // only ever appended to
  today: { date: string; taskIds: string[] };
};

export type Mood = "Proud" | "Delighted" | "Happy" | "Worried" | "Upset" | "Sick";
```

- [ ] **Step 3: Write `web/src/planner/tuning.ts`**

```ts
// Every tunable number in the planner. See the spec, sections 2 and 3.

export const STARTING_TOKENS = 650;

// Value
export const POOL_PER_WEIGHT = 100; // value per requirement weight point
export const TASK_SHARE = 0.7; // part of the pool shared among a requirement's tasks
export const FINISH_SHARE = 0.3; // part paid when the requirement's last task is done
export const UNBLOCK_BONUS_PER_TASK = 0.15;
export const UNBLOCK_BONUS_MAX = 0.6;
export const NEGLECT_BONUS_START_DAYS = 5; // bonus counts idle days beyond this
export const NEGLECT_BONUS_PER_DAY = 0.05;
export const NEGLECT_BONUS_MAX = 0.5;
export const RECOVERY_NEGLECT_FACTOR = 2; // neglect bonus (and its max) while Recovering
export const DAILY_FULL_PAY_COUNT = 5; // paid completions per local day at full pay
export const DAILY_DECAY = 0.8;
export const DAILY_FLOOR = 0.25;
export const TOKENS_PER_VALUE = 0.3;
export const SICK_TOKEN_MULTIPLIER = 0.5;

// Neglect and sickness
export const NEGLECT_DAYS = 7;
export const SICK_DAYS = 14;
export const RECOVERY_DAYS = 3;

// Mood thresholds, in percentage points of schedule gap
export const DELIGHTED_GAP = 10; // gap >= this
export const WORRIED_GAP = -10; // gap <= this is Worried or worse
export const UPSET_GAP = -25; // gap <= this is Upset

// Learning
export const LEARNING_MAX_SAMPLES = 20;
export const LEARNING_PRIOR_SAMPLES = 5;
export const LEARNING_MIN_SAMPLES_SHOWN = 3;
export const MULTIPLIER_MIN = 0.5;
export const MULTIPLIER_MAX = 3;

// Misc
export const SUGGESTED_COUNT = 6;
export const MEDICINE_PRODUCT_ID = "medicine";
export const MEDICINE_PRICE = 80;
export const DEFAULT_ESTIMATE_MIN = 60;
```

- [ ] **Step 4: Write the failing test `web/src/planner/time.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { addDays, endOfLocalDay, localDateKey, startOfLocalDay, wholeDaysBetween } from "./time";

describe("time helpers", () => {
  it("formats a local date key, even late in the evening", () => {
    expect(localDateKey(new Date(2026, 9, 14, 23, 30))).toBe("2026-10-14");
    expect(localDateKey(new Date(2026, 0, 5, 0, 0))).toBe("2026-01-05");
  });

  it("parses a date key as local midnight and local end of day", () => {
    const start = startOfLocalDay("2026-12-01");
    expect([start.getFullYear(), start.getMonth(), start.getDate(), start.getHours()]).toEqual([2026, 11, 1, 0]);
    const end = endOfLocalDay("2026-12-01");
    expect([end.getDate(), end.getHours(), end.getMinutes()]).toEqual([1, 23, 59]);
  });

  it("counts whole days and never goes negative", () => {
    const a = new Date(2026, 9, 1, 12);
    expect(wholeDaysBetween(a, new Date(2026, 9, 8, 11))).toBe(6);
    expect(wholeDaysBetween(a, new Date(2026, 9, 8, 12))).toBe(7);
    expect(wholeDaysBetween(new Date(2026, 9, 8), a)).toBe(0);
  });

  it("adds calendar days", () => {
    expect(localDateKey(addDays(new Date(2026, 9, 30, 12), 3))).toBe("2026-11-02");
  });
});
```

- [ ] **Step 5: Run it to verify it fails**

Run: `npx vitest run src/planner/time.test.ts`
Expected: FAIL — `Failed to resolve import "./time"`.

- [ ] **Step 6: Write `web/src/planner/time.ts`**

```ts
export const DAY_MS = 86_400_000;

/** "YYYY-MM-DD" for the local calendar day of `d`. */
export function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Local midnight at the start of a "YYYY-MM-DD" day. */
export function startOfLocalDay(key: string): Date {
  return new Date(`${key}T00:00:00`);
}

/** The last millisecond of a "YYYY-MM-DD" local day. */
export function endOfLocalDay(key: string): Date {
  return new Date(`${key}T23:59:59.999`);
}

/** Whole days from `from` to `to`, rounded down, never negative. */
export function wholeDaysBetween(from: Date, to: Date): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / DAY_MS));
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
```

- [ ] **Step 7: Write the fixtures `web/src/planner/testData.ts`** (used by later tests only)

```ts
// Builders for tests. NOW is a fixed local noon so plan percentages are exact.
import { DAY_MS, addDays, localDateKey } from "./time";
import {
  ZERO_BREAKDOWN,
  type Project,
  type Requirement,
  type StudiumData,
  type StudiumEvent,
  type Task,
  type TokenBreakdown,
} from "./types";

export const NOW = new Date(2026, 9, 14, 12, 0, 0);

export function daysAgo(n: number, from: Date = NOW): string {
  return new Date(from.getTime() - n * DAY_MS).toISOString();
}

export function dayKey(offsetDays: number, from: Date = NOW): string {
  return localDateKey(addDays(from, offsetDays));
}

export function makeProject(o: Partial<Project> = {}): Project {
  return {
    id: "p1",
    name: "Project",
    shortName: "proj",
    color: "#2d3a8c",
    deadline: dayKey(30),
    description: "",
    petKind: "cat",
    hatchedAt: daysAgo(30),
    createdAt: daysAgo(30),
    ...o,
  };
}

export function makeRequirement(o: Partial<Requirement> = {}): Requirement {
  return {
    id: "r1",
    projectId: "p1",
    title: "Requirement",
    weight: 5,
    startDate: null,
    dueDate: null,
    createdAt: daysAgo(10),
    ...o,
  };
}

export function makeTask(o: Partial<Task> = {}): Task {
  return {
    id: "t1",
    projectId: "p1",
    requirementId: "r1",
    title: "Task",
    estimateMin: 60,
    blockedBy: [],
    priority: false,
    done: false,
    actualMin: null,
    createdAt: daysAgo(10),
    ...o,
  };
}

export function completed(
  taskId: string,
  at: string,
  o: { actualMin?: number | null; tokens?: number; breakdown?: TokenBreakdown } = {},
): StudiumEvent {
  return {
    type: "task_completed",
    at,
    taskId,
    actualMin: o.actualMin ?? null,
    tokens: o.tokens ?? 0,
    breakdown: o.breakdown ?? { ...ZERO_BREAKDOWN },
  };
}

export function makeData(o: Partial<StudiumData> = {}): StudiumData {
  return {
    version: 1,
    projects: [makeProject()],
    requirements: [],
    tasks: [],
    events: [],
    today: { date: localDateKey(NOW), taskIds: [] },
    ...o,
  };
}
```

- [ ] **Step 8: Run tests and the build**

Run: `npx vitest run src/planner/time.test.ts`
Expected: PASS (4 tests).
Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json src/planner
git commit -m "feat(planner): add types, tuning constants, time helpers and test setup" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Facts from the event history

**Files:**
- Create: `web/src/planner/history.ts`
- Test: `web/src/planner/history.test.ts`

**Interfaces:**
- Consumes: `types.ts`, `tuning.ts` (`STARTING_TOKENS`, `MEDICINE_PRODUCT_ID`), `time.ts` (`localDateKey`).
- Produces:
  - `hasBeenCompleted(events: StudiumEvent[], taskId: string): boolean`
  - `lastCompletionAt(events: StudiumEvent[], taskIds: Iterable<string>, asOf: Date): Date | null`
  - `tokenBalance(events: StudiumEvent[]): number`
  - `inventory(events: StudiumEvent[]): Record<string, number>`
  - `paidCompletionsOnDay(events: StudiumEvent[], dayKey: string): number`
  - `lastMedicineGiven(events: StudiumEvent[], projectId: string, asOf: Date): Date | null`
  - `finishBonusPaid(events: StudiumEvent[], taskIds: Iterable<string>): boolean`

- [ ] **Step 1: Write the failing test `web/src/planner/history.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import {
  finishBonusPaid,
  hasBeenCompleted,
  inventory,
  lastCompletionAt,
  lastMedicineGiven,
  paidCompletionsOnDay,
  tokenBalance,
} from "./history";
import { NOW, completed, daysAgo, dayKey } from "./testData";
import { ZERO_BREAKDOWN, type StudiumEvent } from "./types";

describe("history", () => {
  it("knows whether a task was ever completed", () => {
    const events = [completed("t1", daysAgo(1))];
    expect(hasBeenCompleted(events, "t1")).toBe(true);
    expect(hasBeenCompleted(events, "t2")).toBe(false);
  });

  it("finds the latest completion among some tasks, ignoring events after asOf", () => {
    const events = [completed("t1", daysAgo(5)), completed("t2", daysAgo(2)), completed("t1", daysAgo(-1))];
    expect(lastCompletionAt(events, ["t1", "t2"], NOW)?.toISOString()).toBe(daysAgo(2));
    expect(lastCompletionAt(events, ["t1"], NOW)?.toISOString()).toBe(daysAgo(5));
    expect(lastCompletionAt(events, ["t3"], NOW)).toBeNull();
  });

  it("computes the token balance from completions and purchases", () => {
    const events: StudiumEvent[] = [
      completed("t1", daysAgo(1), { tokens: 30 }),
      { type: "purchase", at: daysAgo(1), productId: "medicine", price: 80 },
      completed("t2", daysAgo(0), { tokens: 12 }),
    ];
    expect(tokenBalance(events)).toBe(650 + 30 - 80 + 12);
  });

  it("counts inventory and uses up medicine when given", () => {
    const events: StudiumEvent[] = [
      { type: "purchase", at: daysAgo(3), productId: "medicine", price: 80 },
      { type: "purchase", at: daysAgo(3), productId: "medicine", price: 80 },
      { type: "purchase", at: daysAgo(2), productId: "focus-ball", price: 75 },
      { type: "medicine_given", at: daysAgo(1), projectId: "p1" },
    ];
    expect(inventory(events)).toEqual({ medicine: 1, "focus-ball": 1 });
  });

  it("counts only paid completions on the given local day", () => {
    const events = [
      completed("a", daysAgo(0.1), { tokens: 10 }),
      completed("b", daysAgo(0.2), { tokens: 0 }), // re-completion, not paid
      completed("c", daysAgo(1), { tokens: 10 }), // yesterday
    ];
    expect(paidCompletionsOnDay(events, dayKey(0))).toBe(1);
  });

  it("finds the last medicine given to a project", () => {
    const events: StudiumEvent[] = [
      { type: "medicine_given", at: daysAgo(5), projectId: "p1" },
      { type: "medicine_given", at: daysAgo(1), projectId: "p2" },
    ];
    expect(lastMedicineGiven(events, "p1", NOW)?.toISOString()).toBe(daysAgo(5));
    expect(lastMedicineGiven(events, "p2", new Date(NOW.getTime() - 3 * 86_400_000))).toBeNull();
  });

  it("knows whether a requirement's finish bonus was already paid", () => {
    const paid = completed("t1", daysAgo(1), { tokens: 50, breakdown: { ...ZERO_BREAKDOWN, finish: 150 } });
    expect(finishBonusPaid([paid], ["t1", "t2"])).toBe(true);
    expect(finishBonusPaid([completed("t1", daysAgo(1))], ["t1"])).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/planner/history.test.ts`
Expected: FAIL — `Failed to resolve import "./history"`.

- [ ] **Step 3: Write `web/src/planner/history.ts`**

```ts
// Facts derived from the event history. The history is the source of truth for
// tokens, inventory, "last moved" and whether something was already paid.
import { localDateKey } from "./time";
import { MEDICINE_PRODUCT_ID, STARTING_TOKENS } from "./tuning";
import type { CompletedEvent, StudiumEvent } from "./types";

const isCompleted = (e: StudiumEvent): e is CompletedEvent => e.type === "task_completed";

export function hasBeenCompleted(events: StudiumEvent[], taskId: string): boolean {
  return events.some((e) => isCompleted(e) && e.taskId === taskId);
}

export function lastCompletionAt(events: StudiumEvent[], taskIds: Iterable<string>, asOf: Date): Date | null {
  const ids = new Set(taskIds);
  let latest = -Infinity;
  for (const e of events) {
    if (!isCompleted(e) || !ids.has(e.taskId)) continue;
    const t = Date.parse(e.at);
    if (t <= asOf.getTime() && t > latest) latest = t;
  }
  return latest === -Infinity ? null : new Date(latest);
}

export function tokenBalance(events: StudiumEvent[]): number {
  let balance = STARTING_TOKENS;
  for (const e of events) {
    if (e.type === "task_completed") balance += e.tokens;
    else if (e.type === "purchase") balance -= e.price;
  }
  return balance;
}

export function inventory(events: StudiumEvent[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const e of events) {
    if (e.type === "purchase") {
      counts[e.productId] = (counts[e.productId] ?? 0) + 1;
    } else if (e.type === "medicine_given") {
      counts[MEDICINE_PRODUCT_ID] = Math.max(0, (counts[MEDICINE_PRODUCT_ID] ?? 0) - 1);
    }
  }
  return counts;
}

/** Completions that actually paid tokens on a local day; these drive the daily curve. */
export function paidCompletionsOnDay(events: StudiumEvent[], dayKey: string): number {
  return events.filter((e) => isCompleted(e) && e.tokens > 0 && localDateKey(new Date(e.at)) === dayKey).length;
}

export function lastMedicineGiven(events: StudiumEvent[], projectId: string, asOf: Date): Date | null {
  let latest = -Infinity;
  for (const e of events) {
    if (e.type !== "medicine_given" || e.projectId !== projectId) continue;
    const t = Date.parse(e.at);
    if (t <= asOf.getTime() && t > latest) latest = t;
  }
  return latest === -Infinity ? null : new Date(latest);
}

export function finishBonusPaid(events: StudiumEvent[], taskIds: Iterable<string>): boolean {
  const ids = new Set(taskIds);
  return events.some((e) => isCompleted(e) && ids.has(e.taskId) && e.breakdown.finish > 0);
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/planner/history.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/planner/history.ts src/planner/history.test.ts
git commit -m "feat(planner): derive balance, inventory and completion facts from history" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Blocking

**Files:**
- Create: `web/src/planner/blocking.ts`
- Test: `web/src/planner/blocking.test.ts`

**Interfaces:**
- Consumes: `types.ts`.
- Produces:
  - `isBlocked(task: Task, tasks: Task[]): boolean`
  - `openBlockers(task: Task, tasks: Task[]): Task[]`
  - `downstreamOpenCount(taskId: string, tasks: Task[]): number`
  - `wouldCreateCycle(taskId: string, blockerId: string, tasks: Task[]): boolean`
  - `blockerOptions(taskId: string, tasks: Task[]): Task[]`

- [ ] **Step 1: Write the failing test `web/src/planner/blocking.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { blockerOptions, downstreamOpenCount, isBlocked, openBlockers, wouldCreateCycle } from "./blocking";
import { makeTask } from "./testData";

const A = makeTask({ id: "A" });
const B = makeTask({ id: "B", blockedBy: ["A"] });
const C = makeTask({ id: "C", blockedBy: ["B"] });

describe("blocking", () => {
  it("is blocked only by open blockers it can find", () => {
    expect(isBlocked(B, [A, B])).toBe(true);
    expect(isBlocked(B, [{ ...A, done: true }, B])).toBe(false);
    // A blocker that was deleted must not block forever.
    expect(isBlocked(makeTask({ id: "X", blockedBy: ["gone"] }), [A])).toBe(false);
    expect(openBlockers(B, [A, B]).map((t) => t.id)).toEqual(["A"]);
  });

  it("counts open tasks downstream through chains", () => {
    expect(downstreamOpenCount("A", [A, B, C])).toBe(2);
    expect(downstreamOpenCount("C", [A, B, C])).toBe(0);
  });

  it("counts a shared descendant once", () => {
    const D = makeTask({ id: "D", blockedBy: ["A"] });
    const E = makeTask({ id: "E", blockedBy: ["B", "D"] });
    expect(downstreamOpenCount("A", [A, B, D, E])).toBe(3);
  });

  it("walks through done dependents but does not count them", () => {
    expect(downstreamOpenCount("A", [A, { ...B, done: true }, C])).toBe(1);
  });

  it("detects loops", () => {
    expect(wouldCreateCycle("A", "C", [A, B, C])).toBe(true); // C already depends on A
    expect(wouldCreateCycle("A", "A", [A])).toBe(true);
    expect(wouldCreateCycle("C", "A", [A, B, C])).toBe(false);
  });

  it("offers only same-project blockers that don't make loops", () => {
    const other = makeTask({ id: "O", projectId: "p2" });
    expect(blockerOptions("A", [A, B, C, other]).map((t) => t.id)).toEqual([]);
    expect(blockerOptions("C", [A, B, C, other]).map((t) => t.id)).toEqual(["A", "B"]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/planner/blocking.test.ts`
Expected: FAIL — `Failed to resolve import "./blocking"`.

- [ ] **Step 3: Write `web/src/planner/blocking.ts`**

```ts
import type { Task } from "./types";

/** Open tasks this task is waiting on. Ids that no longer exist are ignored. */
export function openBlockers(task: Task, tasks: Task[]): Task[] {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  return task.blockedBy.map((id) => byId.get(id)).filter((t): t is Task => t !== undefined && !t.done);
}

export function isBlocked(task: Task, tasks: Task[]): boolean {
  return openBlockers(task, tasks).length > 0;
}

/** How many open tasks wait on this one, directly or through a chain. Each counted once. */
export function downstreamOpenCount(taskId: string, tasks: Task[]): number {
  const dependents = new Map<string, string[]>();
  for (const t of tasks) {
    for (const b of t.blockedBy) {
      const list = dependents.get(b) ?? [];
      list.push(t.id);
      dependents.set(b, list);
    }
  }
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const seen = new Set<string>([taskId]);
  const queue = [taskId];
  let count = 0;
  while (queue.length > 0) {
    const id = queue.shift() as string;
    for (const dep of dependents.get(id) ?? []) {
      if (seen.has(dep)) continue;
      seen.add(dep);
      queue.push(dep);
      if (byId.get(dep)?.done === false) count += 1;
    }
  }
  return count;
}

/** True if `taskId` waits on `targetId`, directly or through a chain. */
function dependsOn(taskId: string, targetId: string, tasks: Task[]): boolean {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const seen = new Set<string>();
  const stack = [...(byId.get(taskId)?.blockedBy ?? [])];
  while (stack.length > 0) {
    const id = stack.pop() as string;
    if (id === targetId) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    stack.push(...(byId.get(id)?.blockedBy ?? []));
  }
  return false;
}

/** Would making `taskId` wait on `blockerId` create a loop? */
export function wouldCreateCycle(taskId: string, blockerId: string, tasks: Task[]): boolean {
  return blockerId === taskId || dependsOn(blockerId, taskId, tasks);
}

/** Tasks that `taskId` may be marked "blocked by": same project, not itself, no loops. */
export function blockerOptions(taskId: string, tasks: Task[]): Task[] {
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return [];
  return tasks.filter((t) => t.projectId === task.projectId && !wouldCreateCycle(taskId, t.id, tasks));
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/planner/blocking.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/planner/blocking.ts src/planner/blocking.test.ts
git commit -m "feat(planner): add blocked-by checks, unblock counts and loop detection" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Learning (estimate multipliers)

**Files:**
- Create: `web/src/planner/learning.ts`
- Test: `web/src/planner/learning.test.ts`

**Interfaces:**
- Consumes: `types.ts`, `tuning.ts` (`LEARNING_MAX_SAMPLES`, `LEARNING_PRIOR_SAMPLES`, `MULTIPLIER_MIN`, `MULTIPLIER_MAX`).
- Produces:
  - `type Multipliers = { overall: number; byProject: Record<string, { multiplier: number; samples: number }> }`
  - `estimateMultipliers(data: Pick<StudiumData, "tasks" | "events">): Multipliers`
  - `multiplierFor(m: Multipliers, projectId: string): number`
  - `samplesFor(m: Multipliers, projectId: string): number`

- [ ] **Step 1: Write the failing test `web/src/planner/learning.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { estimateMultipliers, multiplierFor, samplesFor } from "./learning";
import { completed, daysAgo, makeTask } from "./testData";
import type { Task } from "./types";

function doneTasks(n: number, estimate: number, actual: number, projectId = "p1", ageOffset = 0) {
  const tasks: Task[] = [];
  const events = [];
  for (let i = 0; i < n; i++) {
    const id = `${projectId}-${ageOffset + i}`;
    tasks.push(makeTask({ id, projectId, estimateMin: estimate, done: true, actualMin: actual }));
    events.push(completed(id, daysAgo(ageOffset + i + 1)));
  }
  return { tasks, events };
}

describe("estimateMultipliers", () => {
  it("is 1.0 with no samples", () => {
    const m = estimateMultipliers({ tasks: [], events: [] });
    expect(m.overall).toBe(1);
    expect(multiplierFor(m, "p1")).toBe(1);
    expect(samplesFor(m, "p1")).toBe(0);
  });

  it("leans toward 1.0 with one sample", () => {
    const m = estimateMultipliers(doneTasks(1, 60, 120));
    expect(m.overall).toBeCloseTo(420 / 360, 4); // (120 + 5*60) / (60 + 5*60)
    expect(multiplierFor(m, "p1")).toBeCloseTo((2 + 5 * (420 / 360)) / 6, 4);
  });

  it("approaches the real ratio with many samples", () => {
    const m = estimateMultipliers(doneTasks(20, 60, 120));
    expect(m.overall).toBeCloseTo(1.8, 4);
    expect(multiplierFor(m, "p1")).toBeCloseTo(1.96, 4);
  });

  it("is clamped to [0.5, 3]", () => {
    expect(multiplierFor(estimateMultipliers(doneTasks(20, 60, 600)), "p1")).toBe(3);
    expect(multiplierFor(estimateMultipliers(doneTasks(20, 60, 6)), "p1")).toBe(0.5);
  });

  it("uses only the newest 20 samples per project", () => {
    const recent = doneTasks(20, 60, 60, "p1", 0); // ratio 1, newest
    const old = doneTasks(5, 60, 300, "p1", 100); // ratio 5, older
    const m = estimateMultipliers({ tasks: [...recent.tasks, ...old.tasks], events: [...recent.events, ...old.events] });
    expect(multiplierFor(m, "p1")).toBeCloseTo(1, 4);
  });

  it("ignores open tasks and tasks without an actual time", () => {
    const tasks = [makeTask({ id: "a", done: false, actualMin: 500 }), makeTask({ id: "b", done: true, actualMin: null })];
    expect(estimateMultipliers({ tasks, events: [] }).overall).toBe(1);
  });

  it("falls back to the overall multiplier for a project with no samples", () => {
    const m = estimateMultipliers(doneTasks(20, 60, 120, "p1"));
    expect(multiplierFor(m, "p2")).toBe(m.overall);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/planner/learning.test.ts`
Expected: FAIL — `Failed to resolve import "./learning"`.

- [ ] **Step 3: Write `web/src/planner/learning.ts`**

```ts
// How far off your estimates usually are. Used to make open tasks' effort realistic.
import { LEARNING_MAX_SAMPLES, LEARNING_PRIOR_SAMPLES, MULTIPLIER_MAX, MULTIPLIER_MIN } from "./tuning";
import type { StudiumData, Task } from "./types";

export type Multipliers = {
  overall: number;
  byProject: Record<string, { multiplier: number; samples: number }>;
};

const clampMultiplier = (x: number) => Math.min(MULTIPLIER_MAX, Math.max(MULTIPLIER_MIN, x));

export function estimateMultipliers(data: Pick<StudiumData, "tasks" | "events">): Multipliers {
  const lastDone = new Map<string, number>();
  for (const e of data.events) {
    if (e.type === "task_completed") lastDone.set(e.taskId, Math.max(lastDone.get(e.taskId) ?? 0, Date.parse(e.at)));
  }

  const byProjectSamples = new Map<string, Task[]>();
  for (const t of data.tasks) {
    if (!t.done || t.actualMin === null || !(t.estimateMin > 0)) continue;
    const list = byProjectSamples.get(t.projectId) ?? [];
    list.push(t);
    byProjectSamples.set(t.projectId, list);
  }
  for (const [projectId, list] of byProjectSamples) {
    list.sort((a, b) => (lastDone.get(b.id) ?? 0) - (lastDone.get(a.id) ?? 0));
    byProjectSamples.set(projectId, list.slice(0, LEARNING_MAX_SAMPLES));
  }

  const all = [...byProjectSamples.values()].flat();
  const sumEstimate = all.reduce((s, t) => s + t.estimateMin, 0);
  const sumActual = all.reduce((s, t) => s + (t.actualMin ?? 0), 0);
  const k = LEARNING_PRIOR_SAMPLES;
  // Pretend there are k extra average-sized tasks that matched their estimates exactly.
  const avgEstimate = all.length > 0 ? sumEstimate / all.length : 1;
  const overall = all.length > 0 ? clampMultiplier((sumActual + k * avgEstimate) / (sumEstimate + k * avgEstimate)) : 1;

  const byProject: Multipliers["byProject"] = {};
  for (const [projectId, list] of byProjectSamples) {
    const n = list.length;
    const ratio = list.reduce((s, t) => s + (t.actualMin ?? 0), 0) / list.reduce((s, t) => s + t.estimateMin, 0);
    byProject[projectId] = { multiplier: clampMultiplier((n * ratio + k * overall) / (n + k)), samples: n };
  }
  return { overall, byProject };
}

export function multiplierFor(m: Multipliers, projectId: string): number {
  return m.byProject[projectId]?.multiplier ?? m.overall;
}

export function samplesFor(m: Multipliers, projectId: string): number {
  return m.byProject[projectId]?.samples ?? 0;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/planner/learning.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/planner/learning.ts src/planner/learning.test.ts
git commit -m "feat(planner): learn estimate multipliers from actual time" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Progress and plan

**Files:**
- Create: `web/src/planner/progress.ts`
- Test: `web/src/planner/progress.test.ts`

**Interfaces:**
- Consumes: `types.ts`, `time.ts` (`startOfLocalDay`, `endOfLocalDay`), `learning.ts` (`Multipliers`, `multiplierFor`).
- Produces:
  - `taskEffort(task: Task, multiplier: number): number`
  - `tasksOfRequirement(requirementId: string, tasks: Task[]): Task[]`
  - `requirementProgress(requirementId: string, tasks: Task[], multiplier: number): number` (0..1)
  - `isRequirementDone(requirementId: string, tasks: Task[]): boolean`
  - `requirementStart(req: Requirement): Date`
  - `requirementDue(req: Requirement, project: Project): Date`
  - `plannedProgress(req: Requirement, project: Project, now: Date): number` (0..1)
  - `projectProgress(projectId: string, data: StudiumData, multipliers: Multipliers): number` (0..1)
  - `scheduleGap(projectId: string, data: StudiumData, multipliers: Multipliers, now: Date): number` (percentage points)
  - `totalProgress(data: StudiumData, multipliers: Multipliers): number` (0..1)

- [ ] **Step 1: Write the failing test `web/src/planner/progress.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { estimateMultipliers } from "./learning";
import {
  isRequirementDone,
  plannedProgress,
  projectProgress,
  requirementProgress,
  scheduleGap,
  taskEffort,
  totalProgress,
} from "./progress";
import { NOW, dayKey, daysAgo, makeData, makeProject, makeRequirement, makeTask } from "./testData";

const ONE = { overall: 1, byProject: {} };

describe("effort and requirement progress", () => {
  it("uses actual time for done tasks and estimate × multiplier for open ones", () => {
    expect(taskEffort(makeTask({ done: true, estimateMin: 60, actualMin: 90 }), 2)).toBe(90);
    expect(taskEffort(makeTask({ done: true, estimateMin: 60, actualMin: null }), 2)).toBe(60);
    expect(taskEffort(makeTask({ done: false, estimateMin: 60 }), 1.5)).toBe(90);
  });

  it("splits progress by effort", () => {
    const tasks = [
      makeTask({ id: "a", estimateMin: 60, done: true, actualMin: 90 }),
      makeTask({ id: "b", estimateMin: 120 }),
    ];
    expect(requirementProgress("r1", tasks, 1)).toBeCloseTo(90 / 210, 6);
    expect(requirementProgress("r1", tasks, 2)).toBeCloseTo(90 / 330, 6);
  });

  it("is 0, not NaN, for a requirement with no tasks", () => {
    expect(requirementProgress("r1", [], 1)).toBe(0);
    expect(isRequirementDone("r1", [])).toBe(false);
  });

  it("is done only when it has tasks and all are done", () => {
    expect(isRequirementDone("r1", [makeTask({ done: true })])).toBe(true);
    expect(isRequirementDone("r1", [makeTask({ done: true }), makeTask({ id: "t2" })])).toBe(false);
  });
});

describe("plan", () => {
  const project = makeProject({ deadline: dayKey(30) });

  it("rises from the start date to the end of the due date", () => {
    // Start of day -10 to end of day +9 is 20 days; noon on day 0 is 10.5 days in.
    const req = makeRequirement({ startDate: dayKey(-10), dueDate: dayKey(9) });
    expect(plannedProgress(req, project, NOW)).toBeCloseTo(0.525, 3);
  });

  it("is 0 before the start date and 1 after the due date", () => {
    expect(plannedProgress(makeRequirement({ startDate: dayKey(2), dueDate: dayKey(9) }), project, NOW)).toBe(0);
    expect(plannedProgress(makeRequirement({ startDate: dayKey(-9), dueDate: dayKey(-2) }), project, NOW)).toBe(1);
  });

  it("falls back to createdAt and the project deadline", () => {
    // createdAt is exactly 5 days ago (noon); due end of day +4 ≈ 9.5 days later.
    const req = makeRequirement({ createdAt: daysAgo(5), startDate: null, dueDate: null });
    const p = makeProject({ deadline: dayKey(4) });
    expect(plannedProgress(req, p, NOW)).toBeCloseTo(5 / 9.5, 2);
  });
});

describe("project progress and schedule gap", () => {
  it("weights requirements by weight", () => {
    const data = makeData({
      requirements: [makeRequirement({ id: "r1", weight: 2 }), makeRequirement({ id: "r2", weight: 8 })],
      tasks: [makeTask({ id: "a", requirementId: "r1", done: true }), makeTask({ id: "b", requirementId: "r2" })],
    });
    expect(projectProgress("p1", data, ONE)).toBeCloseTo(0.2, 6);
    expect(totalProgress(data, ONE)).toBeCloseTo(0.2, 6);
  });

  it("ignores unlinked tasks", () => {
    const data = makeData({
      requirements: [makeRequirement()],
      tasks: [makeTask({ id: "a", done: true }), makeTask({ id: "u", requirementId: null })],
    });
    expect(projectProgress("p1", data, ONE)).toBe(1);
  });

  it("is actual minus planned, in percentage points", () => {
    const data = makeData({
      requirements: [makeRequirement({ startDate: dayKey(-10), dueDate: dayKey(9) })],
      tasks: [makeTask({ id: "a", done: true }), makeTask({ id: "b" })],
    });
    expect(scheduleGap("p1", data, estimateMultipliers(data), NOW)).toBeCloseTo(50 - 52.5, 3);
  });

  it("is 0 for a project with no requirements", () => {
    expect(scheduleGap("p1", makeData(), ONE, NOW)).toBe(0);
    expect(projectProgress("p1", makeData(), ONE)).toBe(0);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/planner/progress.test.ts`
Expected: FAIL — `Failed to resolve import "./progress"`.

- [ ] **Step 3: Write `web/src/planner/progress.ts`**

```ts
// Real progress (effort-based, no bonuses) and the plan it is compared against.
import { multiplierFor, type Multipliers } from "./learning";
import { endOfLocalDay, startOfLocalDay } from "./time";
import type { Project, Requirement, StudiumData, Task } from "./types";

export function taskEffort(task: Task, multiplier: number): number {
  return task.done ? (task.actualMin ?? task.estimateMin) : task.estimateMin * multiplier;
}

export function tasksOfRequirement(requirementId: string, tasks: Task[]): Task[] {
  return tasks.filter((t) => t.requirementId === requirementId);
}

export function requirementProgress(requirementId: string, tasks: Task[], multiplier: number): number {
  let total = 0;
  let done = 0;
  for (const t of tasksOfRequirement(requirementId, tasks)) {
    const effort = taskEffort(t, multiplier);
    total += effort;
    if (t.done) done += effort;
  }
  return total > 0 ? done / total : 0;
}

export function isRequirementDone(requirementId: string, tasks: Task[]): boolean {
  const list = tasksOfRequirement(requirementId, tasks);
  return list.length > 0 && list.every((t) => t.done);
}

export function requirementStart(req: Requirement): Date {
  return req.startDate ? startOfLocalDay(req.startDate) : new Date(req.createdAt);
}

export function requirementDue(req: Requirement, project: Project): Date {
  return endOfLocalDay(req.dueDate ?? project.deadline);
}

export function plannedProgress(req: Requirement, project: Project, now: Date): number {
  const s = requirementStart(req).getTime();
  const d = requirementDue(req, project).getTime();
  const t = now.getTime();
  if (t < s) return 0;
  if (d <= s) return 1;
  return Math.min(1, (t - s) / (d - s));
}

export function projectProgress(projectId: string, data: StudiumData, multipliers: Multipliers): number {
  const reqs = data.requirements.filter((r) => r.projectId === projectId);
  const totalWeight = reqs.reduce((s, r) => s + r.weight, 0);
  if (totalWeight === 0) return 0;
  const m = multiplierFor(multipliers, projectId);
  return reqs.reduce((s, r) => s + r.weight * requirementProgress(r.id, data.tasks, m), 0) / totalWeight;
}

/** Weighted (actual − planned) across the project's requirements, in percentage points. */
export function scheduleGap(projectId: string, data: StudiumData, multipliers: Multipliers, now: Date): number {
  const project = data.projects.find((p) => p.id === projectId);
  if (!project) return 0;
  const reqs = data.requirements.filter((r) => r.projectId === projectId);
  const totalWeight = reqs.reduce((s, r) => s + r.weight, 0);
  if (totalWeight === 0) return 0;
  const m = multiplierFor(multipliers, projectId);
  const sum = reqs.reduce(
    (s, r) => s + r.weight * (requirementProgress(r.id, data.tasks, m) - plannedProgress(r, project, now)),
    0,
  );
  return (sum / totalWeight) * 100;
}

export function totalProgress(data: StudiumData, multipliers: Multipliers): number {
  const projectIds = new Set(data.projects.map((p) => p.id));
  let weight = 0;
  let sum = 0;
  for (const r of data.requirements) {
    if (!projectIds.has(r.projectId)) continue;
    weight += r.weight;
    sum += r.weight * requirementProgress(r.id, data.tasks, multiplierFor(multipliers, r.projectId));
  }
  return weight > 0 ? sum / weight : 0;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/planner/progress.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 5: Commit**

```bash
git add src/planner/progress.ts src/planner/progress.test.ts
git commit -m "feat(planner): add effort-based progress, plan and schedule gap" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Neglect, sickness, recovery and mood

**Files:**
- Create: `web/src/planner/mood.ts`
- Test: `web/src/planner/mood.test.ts`

**Interfaces:**
- Consumes: `progress.ts` (`isRequirementDone`, `plannedProgress`, `requirementStart`, `scheduleGap`, `tasksOfRequirement`), `history.ts` (`lastCompletionAt`, `lastMedicineGiven`), `learning.ts` (`estimateMultipliers`, `Multipliers`), `time.ts` (`DAY_MS`, `wholeDaysBetween`), `tuning.ts`.
- Produces:
  - `requirementIdleDays(req: Requirement, data: StudiumData, now: Date): number`
  - `type NeglectedRequirement = { requirement: Requirement; idleDays: number }`
  - `neglectedRequirements(projectId: string, data: StudiumData, now: Date, minDays?: number): NeglectedRequirement[]` (longest idle first)
  - `type ProjectHealth = { sick: boolean; recovering: boolean; recoveringFor: string[] }`
  - `projectHealth(projectId: string, data: StudiumData, now: Date): ProjectHealth`
  - `moodFromGap(gap: number): Mood`
  - `type ProjectMood = { mood: Mood; gap: number; neglected: NeglectedRequirement[]; health: ProjectHealth }`
  - `projectMood(projectId: string, data: StudiumData, now: Date, multipliers?: Multipliers): ProjectMood`

- [ ] **Step 1: Write the failing test `web/src/planner/mood.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { moodFromGap, neglectedRequirements, projectHealth, projectMood, requirementIdleDays } from "./mood";
import { NOW, completed, dayKey, daysAgo, makeData, makeRequirement, makeTask } from "./testData";
import type { StudiumData, StudiumEvent } from "./types";

/** One weight-5 requirement with 8 one-hour tasks; `done` of them finished `lastDoneDaysAgo` days ago. */
function moodData(o: {
  done: number;
  lastDoneDaysAgo?: number;
  startDate?: string;
  dueDate?: string;
  extraEvents?: StudiumEvent[];
}): StudiumData {
  const requirement = makeRequirement({ startDate: o.startDate ?? dayKey(-10), dueDate: o.dueDate ?? dayKey(9) });
  const tasks = Array.from({ length: 8 }, (_, i) => makeTask({ id: `t${i + 1}`, done: i < o.done }));
  const events = tasks.filter((t) => t.done).map((t) => completed(t.id, daysAgo(o.lastDoneDaysAgo ?? 1)));
  return makeData({ requirements: [requirement], tasks, events: [...events, ...(o.extraEvents ?? [])] });
}

// With start day -10 and due day +9, planned progress at NOW is 52.5%.
describe("mood from the plan", () => {
  it("maps gaps to moods", () => {
    expect(moodFromGap(10)).toBe("Delighted");
    expect(moodFromGap(9.9)).toBe("Happy");
    expect(moodFromGap(-9.9)).toBe("Happy");
    expect(moodFromGap(-10)).toBe("Worried");
    expect(moodFromGap(-24.9)).toBe("Worried");
    expect(moodFromGap(-25)).toBe("Upset");
  });

  it("follows actual vs planned progress", () => {
    expect(projectMood("p1", moodData({ done: 3 }), NOW).mood).toBe("Worried"); // 37.5 − 52.5
    expect(projectMood("p1", moodData({ done: 4 }), NOW).mood).toBe("Happy"); // 50 − 52.5
    expect(projectMood("p1", moodData({ done: 6 }), NOW).mood).toBe("Delighted"); // 75 − 52.5
    expect(projectMood("p1", moodData({ done: 8 }), NOW).mood).toBe("Proud");
  });

  it("is Upset when nothing is done, and neglect cannot lower Upset further", () => {
    const m = projectMood("p1", moodData({ done: 0 }), NOW);
    expect(m.mood).toBe("Upset");
    expect(m.neglected).toHaveLength(1);
  });

  it("does not count activity, only progress against the plan", () => {
    // Same progress, one finished today vs a week ago (both under the neglect limit).
    expect(projectMood("p1", moodData({ done: 4, lastDoneDaysAgo: 0 }), NOW).mood).toBe("Happy");
    expect(projectMood("p1", moodData({ done: 4, lastDoneDaysAgo: 6 }), NOW).mood).toBe("Happy");
  });
});

describe("neglect", () => {
  it("counts idle days from the later of the start and the last completion", () => {
    const data = moodData({ done: 2, lastDoneDaysAgo: 3 });
    expect(requirementIdleDays(data.requirements[0], data, NOW)).toBe(3);
    const fresh = moodData({ done: 0 });
    expect(requirementIdleDays(fresh.requirements[0], fresh, NOW)).toBe(10);
  });

  it("never neglects a requirement that hasn't started", () => {
    const data = moodData({ done: 0, startDate: dayKey(5), dueDate: dayKey(20) });
    expect(requirementIdleDays(data.requirements[0], data, NOW)).toBe(0);
    expect(neglectedRequirements("p1", data, NOW)).toEqual([]);
    expect(projectMood("p1", data, NOW).mood).toBe("Happy");
  });

  it("lowers mood one level after 7 idle days", () => {
    expect(projectMood("p1", moodData({ done: 4, lastDoneDaysAgo: 8 }), NOW).mood).toBe("Worried");
  });

  it("lists the longest idle requirement first", () => {
    const data = makeData({
      requirements: [
        makeRequirement({ id: "r1", startDate: dayKey(-9), dueDate: dayKey(20) }),
        makeRequirement({ id: "r2", startDate: dayKey(-12), dueDate: dayKey(20) }),
      ],
      tasks: [makeTask({ id: "a", requirementId: "r1" }), makeTask({ id: "b", requirementId: "r2" })],
    });
    expect(neglectedRequirements("p1", data, NOW).map((n) => [n.requirement.id, n.idleDays])).toEqual([
      ["r2", 12],
      ["r1", 9],
    ]);
  });
});

describe("sick, medicine and recovery", () => {
  // Start day -20, due day +19: planned is 51.25% at NOW.
  const base = { startDate: dayKey(-20), dueDate: dayKey(19) };
  const medicine = (days: number): StudiumEvent => ({ type: "medicine_given", at: daysAgo(days), projectId: "p1" });

  it("is Sick after 14 idle days", () => {
    const data = moodData({ ...base, done: 4, lastDoneDaysAgo: 15 });
    expect(projectHealth("p1", data, NOW).sick).toBe(true);
    expect(projectMood("p1", data, NOW).mood).toBe("Sick");
  });

  it("is Recovering after medicine, capped at Worried", () => {
    const data = moodData({ ...base, done: 6, lastDoneDaysAgo: 15, extraEvents: [medicine(1)] });
    const health = projectHealth("p1", data, NOW);
    expect(health).toEqual({ sick: false, recovering: true, recoveringFor: ["r1"] });
    expect(projectMood("p1", data, NOW).mood).toBe("Worried"); // Delighted → neglect → Happy → cap
  });

  it("ends recovery early once the neglected requirement moves", () => {
    const data = moodData({
      ...base,
      done: 6,
      lastDoneDaysAgo: 15,
      extraEvents: [medicine(1), completed("t6", daysAgo(0.5))],
    });
    expect(projectHealth("p1", data, NOW).recovering).toBe(false);
    expect(projectMood("p1", data, NOW).mood).toBe("Delighted");
  });

  it("gets sick again when recovery runs out without progress", () => {
    const data = moodData({ ...base, done: 4, lastDoneDaysAgo: 15, extraEvents: [medicine(4)] });
    expect(projectHealth("p1", data, NOW)).toEqual({ sick: true, recovering: false, recoveringFor: [] });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/planner/mood.test.ts`
Expected: FAIL — `Failed to resolve import "./mood"`.

- [ ] **Step 3: Write `web/src/planner/mood.ts`**

```ts
// Pet mood: based on being on track with the plan, lowered by neglect,
// replaced by Sick after long neglect, capped while Recovering from medicine.
import { lastCompletionAt, lastMedicineGiven } from "./history";
import { estimateMultipliers, type Multipliers } from "./learning";
import { isRequirementDone, plannedProgress, requirementStart, scheduleGap, tasksOfRequirement } from "./progress";
import { DAY_MS, wholeDaysBetween } from "./time";
import { DELIGHTED_GAP, NEGLECT_DAYS, RECOVERY_DAYS, SICK_DAYS, UPSET_GAP, WORRIED_GAP } from "./tuning";
import type { Mood, Requirement, StudiumData } from "./types";

export function requirementIdleDays(req: Requirement, data: StudiumData, now: Date): number {
  const start = requirementStart(req);
  if (now < start) return 0;
  const taskIds = tasksOfRequirement(req.id, data.tasks).map((t) => t.id);
  const last = lastCompletionAt(data.events, taskIds, now);
  return wholeDaysBetween(last && last > start ? last : start, now);
}

export type NeglectedRequirement = { requirement: Requirement; idleDays: number };

/** Unfinished requirements whose plan has started and that have been idle at least `minDays`. */
export function neglectedRequirements(
  projectId: string,
  data: StudiumData,
  now: Date,
  minDays: number = NEGLECT_DAYS,
): NeglectedRequirement[] {
  const project = data.projects.find((p) => p.id === projectId);
  if (!project) return [];
  return data.requirements
    .filter((r) => r.projectId === projectId)
    .filter((r) => !isRequirementDone(r.id, data.tasks) && plannedProgress(r, project, now) > 0)
    .map((r) => ({ requirement: r, idleDays: requirementIdleDays(r, data, now) }))
    .filter((n) => n.idleDays >= minDays)
    .sort((a, b) => b.idleDays - a.idleDays);
}

export type ProjectHealth = { sick: boolean; recovering: boolean; recoveringFor: string[] };

export function projectHealth(projectId: string, data: StudiumData, now: Date): ProjectHealth {
  let recovering = false;
  let recoveringFor: string[] = [];
  const medAt = lastMedicineGiven(data.events, projectId, now);
  if (medAt && now.getTime() - medAt.getTime() < RECOVERY_DAYS * DAY_MS) {
    // The requirements that were neglected when the medicine was given.
    const before = { ...data, events: data.events.filter((e) => Date.parse(e.at) <= medAt.getTime()) };
    const targets = neglectedRequirements(projectId, before, medAt).map((n) => n.requirement.id);
    const allMoved = targets.every((id) => {
      const taskIds = tasksOfRequirement(id, data.tasks).map((t) => t.id);
      const last = lastCompletionAt(data.events, taskIds, now);
      return last !== null && last > medAt;
    });
    recovering = !allMoved;
    recoveringFor = recovering ? targets : [];
  }
  const sick = !recovering && neglectedRequirements(projectId, data, now, SICK_DAYS).length > 0;
  return { sick, recovering, recoveringFor };
}

export function moodFromGap(gap: number): Mood {
  if (gap >= DELIGHTED_GAP) return "Delighted";
  if (gap > WORRIED_GAP) return "Happy";
  if (gap > UPSET_GAP) return "Worried";
  return "Upset";
}

const LADDER: Mood[] = ["Upset", "Worried", "Happy", "Delighted"];

function lowerOneLevel(mood: Mood): Mood {
  const i = LADDER.indexOf(mood);
  return i > 0 ? LADDER[i - 1] : mood; // Upset, Proud and Sick stay as they are
}

function capAtWorried(mood: Mood): Mood {
  return mood === "Happy" || mood === "Delighted" || mood === "Proud" ? "Worried" : mood;
}

export type ProjectMood = {
  mood: Mood;
  gap: number;
  neglected: NeglectedRequirement[];
  health: ProjectHealth;
};

export function projectMood(
  projectId: string,
  data: StudiumData,
  now: Date,
  multipliers: Multipliers = estimateMultipliers(data),
): ProjectMood {
  const reqs = data.requirements.filter((r) => r.projectId === projectId);
  const gap = scheduleGap(projectId, data, multipliers, now);
  const neglected = neglectedRequirements(projectId, data, now);
  const health = projectHealth(projectId, data, now);

  let mood: Mood =
    reqs.length > 0 && reqs.every((r) => isRequirementDone(r.id, data.tasks)) ? "Proud" : moodFromGap(gap);
  if (neglected.length > 0) mood = lowerOneLevel(mood);
  if (health.sick) mood = "Sick";
  else if (health.recovering) mood = capAtWorried(mood);

  return { mood, gap, neglected, health };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/planner/mood.test.ts`
Expected: PASS (12 tests).

- [ ] **Step 5: Commit**

```bash
git add src/planner/mood.ts src/planner/mood.test.ts
git commit -m "feat(planner): add neglect, sickness, recovery and plan-based mood" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Value, bonuses and the completion payout

**Files:**
- Create: `web/src/planner/value.ts`
- Test: `web/src/planner/value.test.ts`

**Interfaces:**
- Consumes: `blocking.ts` (`downstreamOpenCount`), `history.ts` (`finishBonusPaid`, `hasBeenCompleted`, `paidCompletionsOnDay`), `learning.ts` (`estimateMultipliers`, `multiplierFor`, `Multipliers`), `mood.ts` (`projectHealth`, `requirementIdleDays`), `progress.ts` (`isRequirementDone`, `taskEffort`, `tasksOfRequirement`), `time.ts` (`localDateKey`), `tuning.ts`, `types.ts`.
- Produces:
  - `requirementPool(weight: number): number`
  - `taskBaseValue(task: Task, tasks: Task[], requirement: Requirement | undefined, multiplier: number): number`
  - `unblockBonus(taskId: string, tasks: Task[]): number`
  - `neglectBonus(idleDays: number, recovering: boolean): number`
  - `dailyCurve(k: number): number`
  - `type Payout = { tokens: number; breakdown: TokenBreakdown }`
  - `computeCompletionPayout(data: StudiumData, taskId: string, actualMin: number | null, now: Date): Payout`
  - `expectedTokens(task: Task, data: StudiumData, now: Date, multipliers?: Multipliers): number`

- [ ] **Step 1: Write the failing test `web/src/planner/value.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { NOW, completed, daysAgo, makeData, makeRequirement, makeTask } from "./testData";
import { ZERO_BREAKDOWN, type StudiumEvent } from "./types";
import { computeCompletionPayout, dailyCurve, expectedTokens, neglectBonus, unblockBonus } from "./value";

/** The spec's worked example: weight 6, tasks of 2 h, 1 h, 3 h; the 1 h task unblocks two tasks; 7 days idle. */
function specExample(extraEvents: StudiumEvent[] = []) {
  return makeData({
    requirements: [
      makeRequirement({ id: "r1", weight: 6, createdAt: daysAgo(7) }),
      makeRequirement({ id: "r2", weight: 4, createdAt: daysAgo(1) }),
    ],
    tasks: [
      makeTask({ id: "t1", estimateMin: 120 }),
      makeTask({ id: "t2", estimateMin: 60 }),
      makeTask({ id: "t3", estimateMin: 180 }),
      makeTask({ id: "x1", requirementId: "r2", blockedBy: ["t2"] }),
      makeTask({ id: "x2", requirementId: "r2", blockedBy: ["t2"] }),
    ],
    events: extraEvents,
  });
}

describe("bonus curves", () => {
  it("gives +15% per unblocked task up to +60%", () => {
    const tasks = [makeTask({ id: "a" }), ...Array.from({ length: 6 }, (_, i) => makeTask({ id: `d${i}`, blockedBy: ["a"] }))];
    expect(unblockBonus("a", tasks)).toBe(0.6);
    expect(unblockBonus("a", tasks.slice(0, 3))).toBeCloseTo(0.3, 6);
  });

  it("gives +5% per idle day beyond 5, up to +50%, doubled while recovering", () => {
    expect(neglectBonus(5, false)).toBe(0);
    expect(neglectBonus(7, false)).toBeCloseTo(0.1, 6);
    expect(neglectBonus(30, false)).toBe(0.5);
    expect(neglectBonus(7, true)).toBeCloseTo(0.2, 6);
    expect(neglectBonus(30, true)).toBe(1);
  });

  it("pays the first 5 completions in full, then decays to a floor", () => {
    expect(dailyCurve(1)).toBe(1);
    expect(dailyCurve(5)).toBe(1);
    expect(dailyCurve(6)).toBeCloseTo(0.8, 6);
    expect(dailyCurve(7)).toBeCloseTo(0.64, 6);
    expect(dailyCurve(20)).toBe(0.25);
  });
});

describe("computeCompletionPayout", () => {
  it("matches the spec's worked example: 29 tokens", () => {
    const payout = computeCompletionPayout(specExample(), "t2", 60, NOW);
    expect(payout.breakdown.base).toBeCloseTo(70, 6);
    expect(payout.breakdown.unblockBonus).toBeCloseTo(0.3, 6);
    expect(payout.breakdown.neglectBonus).toBeCloseTo(0.1, 6);
    expect(payout.breakdown.finish).toBe(0);
    expect(payout.tokens).toBe(29);
  });

  it("pays the finish bonus when the last task is done", () => {
    const data = makeData({
      requirements: [makeRequirement({ weight: 6 })],
      tasks: [makeTask({ id: "a", done: true }), makeTask({ id: "b" })],
      events: [completed("a", daysAgo(1))],
    });
    const payout = computeCompletionPayout(data, "b", 60, NOW);
    expect(payout.breakdown.base).toBeCloseTo(210, 6);
    expect(payout.breakdown.finish).toBeCloseTo(180, 6);
    expect(payout.tokens).toBe(117);
  });

  it("pays the finish bonus only once per requirement", () => {
    const data = makeData({
      requirements: [makeRequirement({ weight: 6 })],
      tasks: [makeTask({ id: "a", done: true }), makeTask({ id: "c" })],
      events: [completed("a", daysAgo(1), { tokens: 117, breakdown: { ...ZERO_BREAKDOWN, finish: 180 } })],
    });
    const payout = computeCompletionPayout(data, "c", 60, NOW);
    expect(payout.breakdown.finish).toBe(0);
    expect(payout.tokens).toBe(63);
  });

  it("pays nothing for a task that was completed before", () => {
    const data = specExample([completed("t2", daysAgo(2), { tokens: 29 })]);
    expect(computeCompletionPayout(data, "t2", 60, NOW)).toEqual({ tokens: 0, breakdown: ZERO_BREAKDOWN });
  });

  it("pays nothing for an unlinked task", () => {
    const data = makeData({ tasks: [makeTask({ id: "u", requirementId: null })] });
    expect(computeCompletionPayout(data, "u", 60, NOW).tokens).toBe(0);
  });

  it("applies the daily curve after 5 paid completions today", () => {
    const earlier = Array.from({ length: 5 }, (_, i) =>
      completed(`other${i}`, new Date(NOW.getTime() - 3_600_000).toISOString(), { tokens: 10 }),
    );
    const payout = computeCompletionPayout(specExample(earlier), "t2", 60, NOW);
    expect(payout.breakdown.dailyCurve).toBeCloseTo(0.8, 6);
    expect(payout.tokens).toBe(24); // 70 × 1.4 × 0.8 × 0.3 = 23.52
  });

  it("halves tokens while the project is sick", () => {
    const data = makeData({
      requirements: [makeRequirement({ createdAt: daysAgo(15) })],
      tasks: [makeTask({ id: "a" }), makeTask({ id: "b" })],
    });
    const payout = computeCompletionPayout(data, "a", 60, NOW);
    expect(payout.breakdown.sickMultiplier).toBe(0.5);
    expect(payout.breakdown.neglectBonus).toBe(0.5);
    expect(payout.tokens).toBe(47); // 210 × 1.5 × 0.5 × 0.3 = 47.25
  });

  it("doubles the neglect bonus while recovering and drops the sick penalty", () => {
    const data = makeData({
      requirements: [makeRequirement({ createdAt: daysAgo(15) })],
      tasks: [makeTask({ id: "a" }), makeTask({ id: "b" })],
      events: [{ type: "medicine_given", at: daysAgo(1), projectId: "p1" }],
    });
    const payout = computeCompletionPayout(data, "a", 60, NOW);
    expect(payout.breakdown.sickMultiplier).toBe(1);
    expect(payout.breakdown.neglectBonus).toBe(1);
    expect(payout.tokens).toBe(126); // 210 × 2 × 0.3
  });
});

describe("expectedTokens", () => {
  it("estimates an open task's tokens without the daily curve", () => {
    // Open t2: effort 60 of 360 → base 70; +30% unblock, +10% neglect → 29.4
    expect(expectedTokens(specExample().tasks[1], specExample(), NOW)).toBe(29);
  });

  it("is 0 for done or unlinked tasks", () => {
    const data = makeData({ tasks: [makeTask({ id: "u", requirementId: null })] });
    expect(expectedTokens(data.tasks[0], data, NOW)).toBe(0);
    expect(expectedTokens(makeTask({ done: true }), specExample(), NOW)).toBe(0);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/planner/value.test.ts`
Expected: FAIL — `Failed to resolve import "./value"`.

- [ ] **Step 3: Write `web/src/planner/value.ts`**

```ts
// What a task is worth, and the tokens paid when it is completed. See spec section 2.
import { downstreamOpenCount } from "./blocking";
import { finishBonusPaid, hasBeenCompleted, paidCompletionsOnDay } from "./history";
import { estimateMultipliers, multiplierFor, type Multipliers } from "./learning";
import { projectHealth, requirementIdleDays } from "./mood";
import { isRequirementDone, taskEffort, tasksOfRequirement } from "./progress";
import { localDateKey } from "./time";
import {
  DAILY_DECAY,
  DAILY_FLOOR,
  DAILY_FULL_PAY_COUNT,
  FINISH_SHARE,
  NEGLECT_BONUS_MAX,
  NEGLECT_BONUS_PER_DAY,
  NEGLECT_BONUS_START_DAYS,
  POOL_PER_WEIGHT,
  RECOVERY_NEGLECT_FACTOR,
  SICK_TOKEN_MULTIPLIER,
  TASK_SHARE,
  TOKENS_PER_VALUE,
  UNBLOCK_BONUS_MAX,
  UNBLOCK_BONUS_PER_TASK,
} from "./tuning";
import { ZERO_BREAKDOWN, type Requirement, type StudiumData, type Task, type TokenBreakdown } from "./types";

export function requirementPool(weight: number): number {
  return weight * POOL_PER_WEIGHT;
}

/** The task's share of its requirement's 70%, by effort. 0 for unlinked tasks. */
export function taskBaseValue(task: Task, tasks: Task[], requirement: Requirement | undefined, multiplier: number): number {
  if (!task.requirementId || !requirement) return 0;
  const total = tasksOfRequirement(requirement.id, tasks).reduce((s, t) => s + taskEffort(t, multiplier), 0);
  if (total <= 0) return 0;
  return (requirementPool(requirement.weight) * TASK_SHARE * taskEffort(task, multiplier)) / total;
}

export function unblockBonus(taskId: string, tasks: Task[]): number {
  return Math.min(UNBLOCK_BONUS_MAX, downstreamOpenCount(taskId, tasks) * UNBLOCK_BONUS_PER_TASK);
}

export function neglectBonus(idleDays: number, recovering: boolean): number {
  const factor = recovering ? RECOVERY_NEGLECT_FACTOR : 1;
  const raw = Math.max(0, idleDays - NEGLECT_BONUS_START_DAYS) * NEGLECT_BONUS_PER_DAY;
  return Math.min(NEGLECT_BONUS_MAX * factor, raw * factor);
}

/** Multiplier for the k-th paid completion of the day (1-based). */
export function dailyCurve(k: number): number {
  if (k <= DAILY_FULL_PAY_COUNT) return 1;
  return Math.max(DAILY_FLOOR, DAILY_DECAY ** (k - DAILY_FULL_PAY_COUNT));
}

export type Payout = { tokens: number; breakdown: TokenBreakdown };

const NOTHING: Payout = { tokens: 0, breakdown: ZERO_BREAKDOWN };

/** Tokens for completing `taskId` now. Call before marking the task done in `data`. */
export function computeCompletionPayout(
  data: StudiumData,
  taskId: string,
  actualMin: number | null,
  now: Date,
): Payout {
  const task = data.tasks.find((t) => t.id === taskId);
  if (!task || hasBeenCompleted(data.events, taskId)) return NOTHING;
  const requirement = data.requirements.find((r) => r.id === task.requirementId);
  if (!requirement) return NOTHING;

  const multiplier = multiplierFor(estimateMultipliers(data), task.projectId);
  const after = data.tasks.map((t) => (t.id === taskId ? { ...t, done: true, actualMin } : t));
  const completedTask = after.find((t) => t.id === taskId) as Task;

  const base = taskBaseValue(completedTask, after, requirement, multiplier);
  const unblock = unblockBonus(taskId, data.tasks);
  const health = projectHealth(task.projectId, data, now);
  const neglect = neglectBonus(
    requirementIdleDays(requirement, data, now),
    health.recoveringFor.includes(requirement.id),
  );
  const reqTaskIds = tasksOfRequirement(requirement.id, after).map((t) => t.id);
  const finish =
    isRequirementDone(requirement.id, after) && !finishBonusPaid(data.events, reqTaskIds)
      ? requirementPool(requirement.weight) * FINISH_SHARE
      : 0;
  const curve = dailyCurve(paidCompletionsOnDay(data.events, localDateKey(now)) + 1);
  const sickMultiplier = health.sick ? SICK_TOKEN_MULTIPLIER : 1;

  const tokens = Math.round((base * (1 + unblock + neglect) + finish) * curve * sickMultiplier * TOKENS_PER_VALUE);
  return {
    tokens,
    breakdown: { base, unblockBonus: unblock, neglectBonus: neglect, finish, dailyCurve: curve, sickMultiplier },
  };
}

/** Rough tokens for finishing an open task now (no daily curve, finish bonus or sick penalty). For ranking. */
export function expectedTokens(
  task: Task,
  data: StudiumData,
  now: Date,
  multipliers: Multipliers = estimateMultipliers(data),
): number {
  if (task.done || !task.requirementId) return 0;
  const requirement = data.requirements.find((r) => r.id === task.requirementId);
  if (!requirement) return 0;
  const base = taskBaseValue(task, data.tasks, requirement, multiplierFor(multipliers, task.projectId));
  const health = projectHealth(task.projectId, data, now);
  const neglect = neglectBonus(
    requirementIdleDays(requirement, data, now),
    health.recoveringFor.includes(requirement.id),
  );
  return Math.round(base * (1 + unblockBonus(task.id, data.tasks) + neglect) * TOKENS_PER_VALUE);
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/planner/value.test.ts`
Expected: PASS (13 tests).

- [ ] **Step 5: Commit**

```bash
git add src/planner/value.ts src/planner/value.test.ts
git commit -m "feat(planner): add task value, bonuses, daily curve and completion payout" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Suggested next

**Files:**
- Create: `web/src/planner/suggest.ts`
- Test: `web/src/planner/suggest.test.ts`

**Interfaces:**
- Consumes: `blocking.ts` (`isBlocked`), `learning.ts` (`estimateMultipliers`), `value.ts` (`expectedTokens`), `time.ts` (`localDateKey`), `tuning.ts` (`SUGGESTED_COUNT`), `types.ts`.
- Produces:
  - `todayTaskIds(data: StudiumData, now: Date): string[]`
  - `type Suggestion = { task: Task; project: Project; expectedTokens: number }`
  - `suggestNext(data: StudiumData, now: Date, count?: number): Suggestion[]`

- [ ] **Step 1: Write the failing test `web/src/planner/suggest.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { suggestNext, todayTaskIds } from "./suggest";
import { NOW, dayKey, makeData, makeRequirement, makeTask } from "./testData";

function data() {
  return makeData({
    requirements: [makeRequirement()],
    tasks: [
      makeTask({ id: "a" }), // unblocks c
      makeTask({ id: "b" }),
      makeTask({ id: "c", blockedBy: ["a"] }), // blocked
      makeTask({ id: "d", done: true }), // done
      makeTask({ id: "e", requirementId: null }), // unlinked
      makeTask({ id: "f" }), // already in today
      makeTask({ id: "g", priority: true }), // pinned
    ],
    today: { date: dayKey(0), taskIds: ["f"] },
  });
}

describe("suggestNext", () => {
  it("puts pinned tasks first, then the highest expected tokens", () => {
    expect(suggestNext(data(), NOW).map((s) => s.task.id)).toEqual(["g", "a", "b"]);
  });

  it("respects the count", () => {
    expect(suggestNext(data(), NOW, 2).map((s) => s.task.id)).toEqual(["g", "a"]);
  });

  it("ignores yesterday's today list", () => {
    const stale = { ...data(), today: { date: dayKey(-1), taskIds: ["f"] } };
    expect(todayTaskIds(stale, NOW)).toEqual([]);
    expect(suggestNext(stale, NOW).map((s) => s.task.id)).toContain("f");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/planner/suggest.test.ts`
Expected: FAIL — `Failed to resolve import "./suggest"`.

- [ ] **Step 3: Write `web/src/planner/suggest.ts`**

```ts
import { isBlocked } from "./blocking";
import { estimateMultipliers } from "./learning";
import { localDateKey } from "./time";
import { SUGGESTED_COUNT } from "./tuning";
import type { Project, StudiumData, Task } from "./types";
import { expectedTokens } from "./value";

/** Today's plan, or nothing if it was made on an earlier day. */
export function todayTaskIds(data: StudiumData, now: Date): string[] {
  return data.today.date === localDateKey(now) ? data.today.taskIds : [];
}

export type Suggestion = { task: Task; project: Project; expectedTokens: number };

export function suggestNext(data: StudiumData, now: Date, count: number = SUGGESTED_COUNT): Suggestion[] {
  const multipliers = estimateMultipliers(data);
  const inToday = new Set(todayTaskIds(data, now));
  const projects = new Map(data.projects.map((p) => [p.id, p]));
  return data.tasks
    .filter(
      (t) =>
        !t.done && t.requirementId !== null && !inToday.has(t.id) && projects.has(t.projectId) && !isBlocked(t, data.tasks),
    )
    .map((t) => ({
      task: t,
      project: projects.get(t.projectId) as Project,
      expectedTokens: expectedTokens(t, data, now, multipliers),
    }))
    .sort((a, b) => Number(b.task.priority) - Number(a.task.priority) || b.expectedTokens - a.expectedTokens)
    .slice(0, count);
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/planner/suggest.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/planner/suggest.ts src/planner/suggest.test.ts
git commit -m "feat(planner): rank suggested next tasks" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Shop products and user actions

**Files:**
- Create: `web/src/store/products.ts`, `web/src/store/actions.ts`
- Test: `web/src/store/actions.test.ts`

**Interfaces:**
- Consumes: everything in `planner/` above.
- Produces (`products.ts`):
  - `type ShopCategory = "Food" | "Clothes" | "Toys" | "Care"`
  - `type ShopProduct = { id: string; name: string; description: string; category: ShopCategory; price: number }`
  - `SHOP_PRODUCTS: ShopProduct[]`, `findProduct(id: string): ShopProduct | undefined`
- Produces (`actions.ts`), every function returns new data and never mutates its input:
  - `cleanMinutes(value: number, fallback: number): number`, `clampWeight(value: number): number`
  - `type ProjectInput = Pick<Project, "name" | "shortName" | "color" | "deadline" | "description" | "petKind">`
  - `createProject(data, input: ProjectInput, now): { data: StudiumData; project: Project }`
  - `updateProject(data, id, changes: Partial<Pick<Project, "name" | "shortName" | "color" | "deadline" | "description">>): StudiumData`
  - `deleteProject(data, id): StudiumData`
  - `type RequirementInput = { projectId: string; title: string; weight: number; startDate?: string | null; dueDate?: string | null }`
  - `createRequirement(data, input, now): { data; requirement: Requirement }`
  - `updateRequirement(data, id, changes: Partial<Pick<Requirement, "title" | "weight" | "startDate" | "dueDate">>, now): StudiumData`
  - `deleteRequirement(data, id, mode: "deleteTasks" | "unlinkTasks"): StudiumData`
  - `type TaskInput = { projectId: string; requirementId: string | null; title: string; estimateMin: number; blockedBy?: string[] }`
  - `createTask(data, input, now): { data; task: Task }`
  - `updateTask(data, id, changes: Partial<Pick<Task, "title" | "requirementId" | "estimateMin" | "blockedBy">>, now): StudiumData`
  - `deleteTask(data, id): StudiumData`
  - `togglePriority(data, id): StudiumData`
  - `completeTask(data, id, actualMin: number | null, now): { data; payout: Payout | null }` (`null` when missing, already done or blocked)
  - `reopenTask(data, id, now): StudiumData`
  - `addToToday(data, taskId, now): StudiumData`, `removeFromToday(data, taskId, now): StudiumData`
  - `purchase(data, productId, now): { data; ok: boolean }`
  - `giveMedicine(data, projectId, now): { data; ok: boolean }`

- [ ] **Step 1: Write `web/src/store/products.ts`**

```ts
import { MEDICINE_PRICE, MEDICINE_PRODUCT_ID } from "../planner/tuning";

export type ShopCategory = "Food" | "Clothes" | "Toys" | "Care";

export type ShopProduct = {
  id: string;
  name: string;
  description: string;
  category: ShopCategory;
  price: number;
};

export const SHOP_PRODUCTS: ShopProduct[] = [
  { id: "berry-bites", name: "Berry Bites", description: "A sweet everyday snack for your companion.", category: "Food", price: 35 },
  { id: "power-bento", name: "Power Bento", description: "A hearty meal for long study sessions.", category: "Food", price: 60 },
  { id: "scholar-scarf", name: "Scholar Scarf", description: "A soft scarf with a studious stripe.", category: "Clothes", price: 120 },
  { id: "rainy-day-coat", name: "Rainy-Day Coat", description: "Keeps tiny paws dry in any weather.", category: "Clothes", price: 180 },
  { id: "focus-ball", name: "Focus Ball", description: "A bouncy reward after completing a task.", category: "Toys", price: 75 },
  { id: "puzzle-cube", name: "Puzzle Cube", description: "A clever toy for curious companions.", category: "Toys", price: 150 },
  {
    id: MEDICINE_PRODUCT_ID,
    name: "Medicine",
    description: "Cures a sick companion and starts a 3-day recovery.",
    category: "Care",
    price: MEDICINE_PRICE,
  },
];

export function findProduct(id: string): ShopProduct | undefined {
  return SHOP_PRODUCTS.find((p) => p.id === id);
}
```

- [ ] **Step 2: Write the failing test `web/src/store/actions.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { paidCompletionsOnDay, tokenBalance, inventory } from "../planner/history";
import { NOW, completed, dayKey, daysAgo, makeData, makeRequirement, makeTask } from "../planner/testData";
import { addDays } from "../planner/time";
import {
  addToToday,
  clampWeight,
  completeTask,
  createRequirement,
  createTask,
  deleteRequirement,
  deleteTask,
  giveMedicine,
  purchase,
  reopenTask,
  updateTask,
} from "./actions";

const base = () =>
  makeData({
    requirements: [makeRequirement()],
    tasks: [makeTask({ id: "A" }), makeTask({ id: "B", blockedBy: ["A"] })],
  });

describe("requirements", () => {
  it("clamps weights to whole numbers 1–10", () => {
    expect([clampWeight(0), clampWeight(12), clampWeight(3.6), clampWeight(Number.NaN)]).toEqual([1, 10, 4, 1]);
  });

  it("creates a requirement and records an event", () => {
    const { data, requirement } = createRequirement(makeData(), { projectId: "p1", title: " Rigging ", weight: 12 }, NOW);
    expect(requirement).toMatchObject({ title: "Rigging", weight: 10, startDate: null, dueDate: null });
    expect(data.events.at(-1)).toMatchObject({ type: "requirement_created", requirementId: requirement.id });
  });

  it("deletes a requirement's tasks or moves them to Unlinked", () => {
    expect(deleteRequirement(base(), "r1", "deleteTasks").tasks).toEqual([]);
    expect(deleteRequirement(base(), "r1", "unlinkTasks").tasks.map((t) => t.requirementId)).toEqual([null, null]);
  });
});

describe("tasks", () => {
  it("cleans a garbage estimate and drops invalid blockers", () => {
    const withOther = { ...base(), tasks: [...base().tasks, makeTask({ id: "O", projectId: "p2" })] };
    const { task } = createTask(
      withOther,
      { projectId: "p1", requirementId: "r1", title: "New", estimateMin: Number.NaN, blockedBy: ["A", "O", "gone", "A"] },
      NOW,
    );
    expect(task.estimateMin).toBe(60);
    expect(task.blockedBy).toEqual(["A"]);
  });

  it("refuses a blocker that would make a loop", () => {
    const data = updateTask(base(), "A", { blockedBy: ["B"] }, NOW);
    expect(data.tasks.find((t) => t.id === "A")?.blockedBy).toEqual([]);
  });

  it("removes a deleted task from other tasks' blockers and from today", () => {
    const withToday = addToToday(base(), "A", NOW);
    const data = deleteTask(withToday, "A");
    expect(data.tasks.map((t) => [t.id, t.blockedBy])).toEqual([["B", []]]);
    expect(data.today.taskIds).toEqual([]);
  });
});

describe("completing", () => {
  it("pays, marks done and records the event", () => {
    const { data, payout } = completeTask(base(), "A", 45, NOW);
    expect(payout?.tokens).toBeGreaterThan(0);
    expect(data.tasks.find((t) => t.id === "A")).toMatchObject({ done: true, actualMin: 45 });
    expect(data.events.at(-1)).toMatchObject({ type: "task_completed", taskId: "A", actualMin: 45, tokens: payout?.tokens });
    expect(tokenBalance(data.events)).toBe(650 + (payout?.tokens ?? 0));
  });

  it("will not complete a blocked task", () => {
    const start = base();
    const result = completeTask(start, "B", 30, NOW);
    expect(result.payout).toBeNull();
    expect(result.data).toBe(start);
  });

  it("pays only once across complete → reopen → complete, and re-completions don't use up the day", () => {
    let data = completeTask(base(), "A", 60, NOW).data;
    data = reopenTask(data, "A", NOW);
    expect(data.tasks.find((t) => t.id === "A")).toMatchObject({ done: false, actualMin: null });
    const again = completeTask(data, "A", 60, NOW);
    expect(again.payout?.tokens).toBe(0);
    expect(paidCompletionsOnDay(again.data.events, dayKey(0))).toBe(1);
  });
});

describe("today", () => {
  it("starts a fresh list on a new day", () => {
    const yesterday = addToToday(base(), "A", addDays(NOW, -1));
    const today = addToToday(yesterday, "B", NOW);
    expect(today.today).toEqual({ date: dayKey(0), taskIds: ["B"] });
  });

  it("does not add done tasks or duplicates", () => {
    let data = addToToday(base(), "A", NOW);
    data = addToToday(data, "A", NOW);
    expect(data.today.taskIds).toEqual(["A"]);
    const done = completeTask(base(), "A", 60, NOW).data;
    expect(addToToday(done, "A", NOW).today.taskIds).toEqual([]);
  });
});

describe("shop and medicine", () => {
  const sick = () =>
    makeData({
      requirements: [makeRequirement({ startDate: dayKey(-30), dueDate: dayKey(30) })],
      tasks: [makeTask({ id: "a", done: true }), makeTask({ id: "b" })],
      events: [completed("a", daysAgo(15))],
    });

  it("refuses a purchase the balance can't cover", () => {
    const poor = { ...sick(), events: [...sick().events, { type: "purchase" as const, at: daysAgo(1), productId: "x", price: 640 }] };
    expect(purchase(poor, "medicine", NOW).ok).toBe(false);
  });

  it("only gives medicine to a sick pet, and only if you have some", () => {
    expect(giveMedicine(sick(), "p1", NOW).ok).toBe(false); // none in inventory
    const stocked = purchase(sick(), "medicine", NOW).data;
    expect(inventory(stocked.events).medicine).toBe(1);
    const healthy = purchase(base(), "medicine", NOW).data;
    expect(giveMedicine(healthy, "p1", NOW).ok).toBe(false); // not sick
    const given = giveMedicine(stocked, "p1", NOW);
    expect(given.ok).toBe(true);
    expect(inventory(given.data.events).medicine).toBe(0);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run src/store/actions.test.ts`
Expected: FAIL — `Failed to resolve import "./actions"`.

- [ ] **Step 4: Write `web/src/store/actions.ts`**

```ts
// User actions as pure functions: (data, input, now) → new data (+ result).
// Every change that matters for history appends an event.
import { isBlocked, wouldCreateCycle } from "../planner/blocking";
import { inventory, tokenBalance } from "../planner/history";
import { projectHealth } from "../planner/mood";
import { localDateKey } from "../planner/time";
import { DEFAULT_ESTIMATE_MIN, MEDICINE_PRODUCT_ID } from "../planner/tuning";
import type { Project, Requirement, StudiumData, StudiumEvent, Task } from "../planner/types";
import { computeCompletionPayout, type Payout } from "../planner/value";
import { findProduct } from "./products";

const newId = () => crypto.randomUUID();
const stamp = (now: Date) => now.toISOString();
const withEvent = (data: StudiumData, event: StudiumEvent): StudiumEvent[] => [...data.events, event];

export function cleanMinutes(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? Math.round(value) : fallback;
}

export function clampWeight(value: number): number {
  return Number.isFinite(value) ? Math.min(10, Math.max(1, Math.round(value))) : 1;
}

function currentToday(data: StudiumData, now: Date): StudiumData["today"] {
  const key = localDateKey(now);
  return data.today.date === key ? data.today : { date: key, taskIds: [] };
}

/** Removes tasks and every reference to them (blockers, today). */
function withoutTasks(data: StudiumData, removed: Set<string>): Pick<StudiumData, "tasks" | "today"> {
  return {
    tasks: data.tasks
      .filter((t) => !removed.has(t.id))
      .map((t) => (t.blockedBy.some((id) => removed.has(id)) ? { ...t, blockedBy: t.blockedBy.filter((id) => !removed.has(id)) } : t)),
    today: { ...data.today, taskIds: data.today.taskIds.filter((id) => !removed.has(id)) },
  };
}

/** Keeps wanted blockers that exist, are in the same project and don't create a loop. */
function cleanBlockers(taskId: string, projectId: string, wanted: string[], tasks: Task[]): string[] {
  let working = tasks.map((t) => (t.id === taskId ? { ...t, blockedBy: [] as string[] } : t));
  const result: string[] = [];
  for (const id of new Set(wanted)) {
    const blocker = working.find((t) => t.id === id);
    if (!blocker || blocker.projectId !== projectId || wouldCreateCycle(taskId, id, working)) continue;
    result.push(id);
    working = working.map((t) => (t.id === taskId ? { ...t, blockedBy: [...result] } : t));
  }
  return result;
}

function cleanRequirementId(data: StudiumData, projectId: string, requirementId: string | null): string | null {
  return data.requirements.some((r) => r.id === requirementId && r.projectId === projectId) ? requirementId : null;
}

// ---- Projects ----

export type ProjectInput = Pick<Project, "name" | "shortName" | "color" | "deadline" | "description" | "petKind">;

export function createProject(data: StudiumData, input: ProjectInput, now: Date): { data: StudiumData; project: Project } {
  const createdAt = stamp(now);
  const project: Project = { ...input, name: input.name.trim(), id: newId(), createdAt, hatchedAt: createdAt };
  return { data: { ...data, projects: [...data.projects, project] }, project };
}

export function updateProject(
  data: StudiumData,
  id: string,
  changes: Partial<Pick<Project, "name" | "shortName" | "color" | "deadline" | "description">>,
): StudiumData {
  return { ...data, projects: data.projects.map((p) => (p.id === id ? { ...p, ...changes } : p)) };
}

export function deleteProject(data: StudiumData, id: string): StudiumData {
  const removed = new Set(data.tasks.filter((t) => t.projectId === id).map((t) => t.id));
  return {
    ...data,
    ...withoutTasks(data, removed),
    projects: data.projects.filter((p) => p.id !== id),
    requirements: data.requirements.filter((r) => r.projectId !== id),
  };
}

// ---- Requirements ----

export type RequirementInput = {
  projectId: string;
  title: string;
  weight: number;
  startDate?: string | null;
  dueDate?: string | null;
};

export function createRequirement(
  data: StudiumData,
  input: RequirementInput,
  now: Date,
): { data: StudiumData; requirement: Requirement } {
  if (!data.projects.some((p) => p.id === input.projectId)) throw new Error(`Unknown project ${input.projectId}`);
  const requirement: Requirement = {
    id: newId(),
    projectId: input.projectId,
    title: input.title.trim(),
    weight: clampWeight(input.weight),
    startDate: input.startDate ?? null,
    dueDate: input.dueDate ?? null,
    createdAt: stamp(now),
  };
  return {
    data: {
      ...data,
      requirements: [...data.requirements, requirement],
      events: withEvent(data, { type: "requirement_created", at: stamp(now), requirementId: requirement.id }),
    },
    requirement,
  };
}

export function updateRequirement(
  data: StudiumData,
  id: string,
  changes: Partial<Pick<Requirement, "title" | "weight" | "startDate" | "dueDate">>,
  now: Date,
): StudiumData {
  if (!data.requirements.some((r) => r.id === id)) return data;
  const clean: Partial<Requirement> = { ...changes };
  if (changes.title !== undefined) clean.title = changes.title.trim();
  if (changes.weight !== undefined) clean.weight = clampWeight(changes.weight);
  return {
    ...data,
    requirements: data.requirements.map((r) => (r.id === id ? { ...r, ...clean } : r)),
    events: withEvent(data, { type: "requirement_edited", at: stamp(now), requirementId: id, changes: clean }),
  };
}

export function deleteRequirement(data: StudiumData, id: string, mode: "deleteTasks" | "unlinkTasks"): StudiumData {
  const requirements = data.requirements.filter((r) => r.id !== id);
  if (mode === "deleteTasks") {
    const removed = new Set(data.tasks.filter((t) => t.requirementId === id).map((t) => t.id));
    return { ...data, ...withoutTasks(data, removed), requirements };
  }
  return {
    ...data,
    requirements,
    tasks: data.tasks.map((t) => (t.requirementId === id ? { ...t, requirementId: null } : t)),
  };
}

// ---- Tasks ----

export type TaskInput = {
  projectId: string;
  requirementId: string | null;
  title: string;
  estimateMin: number;
  blockedBy?: string[];
};

export function createTask(data: StudiumData, input: TaskInput, now: Date): { data: StudiumData; task: Task } {
  const id = newId();
  const task: Task = {
    id,
    projectId: input.projectId,
    requirementId: cleanRequirementId(data, input.projectId, input.requirementId),
    title: input.title.trim(),
    estimateMin: cleanMinutes(input.estimateMin, DEFAULT_ESTIMATE_MIN),
    blockedBy: cleanBlockers(id, input.projectId, input.blockedBy ?? [], data.tasks),
    priority: false,
    done: false,
    actualMin: null,
    createdAt: stamp(now),
  };
  return {
    data: { ...data, tasks: [...data.tasks, task], events: withEvent(data, { type: "task_created", at: stamp(now), taskId: id }) },
    task,
  };
}

export function updateTask(
  data: StudiumData,
  id: string,
  changes: Partial<Pick<Task, "title" | "requirementId" | "estimateMin" | "blockedBy">>,
  now: Date,
): StudiumData {
  const task = data.tasks.find((t) => t.id === id);
  if (!task) return data;
  const clean: Partial<Task> = {};
  if (changes.title !== undefined) clean.title = changes.title.trim();
  if (changes.estimateMin !== undefined) clean.estimateMin = cleanMinutes(changes.estimateMin, task.estimateMin);
  if (changes.requirementId !== undefined) clean.requirementId = cleanRequirementId(data, task.projectId, changes.requirementId);
  if (changes.blockedBy !== undefined) clean.blockedBy = cleanBlockers(id, task.projectId, changes.blockedBy, data.tasks);
  return {
    ...data,
    tasks: data.tasks.map((t) => (t.id === id ? { ...t, ...clean } : t)),
    events: withEvent(data, { type: "task_edited", at: stamp(now), taskId: id, changes: clean }),
  };
}

export function deleteTask(data: StudiumData, id: string): StudiumData {
  return { ...data, ...withoutTasks(data, new Set([id])) };
}

export function togglePriority(data: StudiumData, id: string): StudiumData {
  return { ...data, tasks: data.tasks.map((t) => (t.id === id ? { ...t, priority: !t.priority } : t)) };
}

export function completeTask(
  data: StudiumData,
  id: string,
  actualMin: number | null,
  now: Date,
): { data: StudiumData; payout: Payout | null } {
  const task = data.tasks.find((t) => t.id === id);
  if (!task || task.done || isBlocked(task, data.tasks)) return { data, payout: null };
  const actual = actualMin === null ? null : cleanMinutes(actualMin, task.estimateMin);
  const payout = computeCompletionPayout(data, id, actual, now);
  return {
    data: {
      ...data,
      tasks: data.tasks.map((t) => (t.id === id ? { ...t, done: true, actualMin: actual } : t)),
      events: withEvent(data, {
        type: "task_completed",
        at: stamp(now),
        taskId: id,
        actualMin: actual,
        tokens: payout.tokens,
        breakdown: payout.breakdown,
      }),
    },
    payout,
  };
}

export function reopenTask(data: StudiumData, id: string, now: Date): StudiumData {
  const task = data.tasks.find((t) => t.id === id);
  if (!task?.done) return data;
  return {
    ...data,
    tasks: data.tasks.map((t) => (t.id === id ? { ...t, done: false, actualMin: null } : t)),
    events: withEvent(data, { type: "task_reopened", at: stamp(now), taskId: id }),
  };
}

// ---- Today's plan ----

export function addToToday(data: StudiumData, taskId: string, now: Date): StudiumData {
  const task = data.tasks.find((t) => t.id === taskId);
  const today = currentToday(data, now);
  if (!task || task.done || today.taskIds.includes(taskId)) return { ...data, today };
  return { ...data, today: { ...today, taskIds: [...today.taskIds, taskId] } };
}

export function removeFromToday(data: StudiumData, taskId: string, now: Date): StudiumData {
  const today = currentToday(data, now);
  return { ...data, today: { ...today, taskIds: today.taskIds.filter((id) => id !== taskId) } };
}

// ---- Shop ----

export function purchase(data: StudiumData, productId: string, now: Date): { data: StudiumData; ok: boolean } {
  const product = findProduct(productId);
  if (!product || tokenBalance(data.events) < product.price) return { data, ok: false };
  return {
    data: { ...data, events: withEvent(data, { type: "purchase", at: stamp(now), productId, price: product.price }) },
    ok: true,
  };
}

export function giveMedicine(data: StudiumData, projectId: string, now: Date): { data: StudiumData; ok: boolean } {
  const haveMedicine = (inventory(data.events)[MEDICINE_PRODUCT_ID] ?? 0) > 0;
  if (!haveMedicine || !projectHealth(projectId, data, now).sick) return { data, ok: false };
  return { data: { ...data, events: withEvent(data, { type: "medicine_given", at: stamp(now), projectId }) }, ok: true };
}
```

- [ ] **Step 5: Run tests and the build**

Run: `npx vitest run src/store/actions.test.ts`
Expected: PASS (13 tests).
Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/store/products.ts src/store/actions.ts src/store/actions.test.ts
git commit -m "feat(store): add shop catalog and pure user actions" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Saving and loading

**Files:**
- Create: `web/src/store/storage.ts`
- Test: `web/src/store/storage.test.ts`

**Interfaces:**
- Consumes: `planner/types.ts` (`PET_KINDS`, `StudiumData`), `store/seed.ts` (`buildSeed`) — **created in Task 11**. To keep this task self-contained, Step 1 adds a temporary minimal `seed.ts`; Task 11 replaces it.
- Produces:
  - `STORAGE_KEY = "studium-data-v1"`, `BACKUP_PREFIX = "studium-data-backup-"`
  - `type LoadNotice = "damaged-data" | "storage-unavailable" | null`
  - `type LoadResult = { data: StudiumData; persistent: boolean; notice: LoadNotice }`
  - `isValidData(value: unknown): value is StudiumData`
  - `browserStorage(): Storage | null`
  - `loadData(storage: Storage | null, now: Date): LoadResult`
  - `saveData(storage: Storage | null, data: StudiumData): boolean`

- [ ] **Step 1: Write a temporary `web/src/store/seed.ts`** (replaced in Task 11)

```ts
import { localDateKey } from "../planner/time";
import type { StudiumData } from "../planner/types";

// Temporary: an empty data set. Task 11 replaces this with the real example data.
export function buildSeed(now: Date): StudiumData {
  return { version: 1, projects: [], requirements: [], tasks: [], events: [], today: { date: localDateKey(now), taskIds: [] } };
}
```

- [ ] **Step 2: Write the failing test `web/src/store/storage.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { NOW, makeData, makeRequirement, makeTask } from "../planner/testData";
import { BACKUP_PREFIX, STORAGE_KEY, isValidData, loadData, saveData } from "./storage";

function memoryStorage(failWrites = false): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (k: string) => void map.delete(k),
    setItem: (k: string, v: string) => {
      if (failWrites) throw new Error("QuotaExceededError");
      map.set(k, String(v));
    },
  } as Storage;
}

const valid = () =>
  makeData({ requirements: [makeRequirement()], tasks: [makeTask()] });

describe("isValidData", () => {
  it("accepts good data, including unknown event types from a newer version", () => {
    const data = { ...valid(), events: [{ type: "something_new", at: NOW.toISOString(), extra: 1 }] };
    expect(isValidData(data)).toBe(true);
  });

  it("rejects broken references and wrong shapes", () => {
    expect(isValidData({ ...valid(), tasks: [makeTask({ projectId: "missing" })] })).toBe(false);
    expect(isValidData({ ...valid(), tasks: [makeTask({ requirementId: "missing" })] })).toBe(false);
    expect(isValidData({ ...valid(), version: 2 })).toBe(false);
    expect(isValidData({ ...valid(), events: [{ type: "task_completed", at: NOW.toISOString(), taskId: "t1" }] })).toBe(false);
    expect(isValidData(null)).toBe(false);
  });
});

describe("loadData / saveData", () => {
  it("starts with the example data and saves it when nothing is stored", () => {
    const storage = memoryStorage();
    const result = loadData(storage, NOW);
    expect(result).toMatchObject({ persistent: true, notice: null });
    expect(storage.getItem(STORAGE_KEY)).not.toBeNull();
  });

  it("round-trips saved data", () => {
    const storage = memoryStorage();
    expect(saveData(storage, valid())).toBe(true);
    expect(loadData(storage, NOW).data).toEqual(valid());
  });

  it("keeps a backup and falls back when the saved data is damaged", () => {
    const storage = memoryStorage();
    storage.setItem(STORAGE_KEY, "{not json");
    const result = loadData(storage, NOW);
    expect(result.notice).toBe("damaged-data");
    expect(storage.getItem(`${BACKUP_PREFIX}${NOW.toISOString()}`)).toBe("{not json");
    expect(isValidData(JSON.parse(storage.getItem(STORAGE_KEY) as string))).toBe(true);
  });

  it("works from memory when storage is unavailable", () => {
    expect(loadData(null, NOW)).toMatchObject({ persistent: false, notice: "storage-unavailable" });
    expect(saveData(null, valid())).toBe(false);
  });

  it("reports a failed save instead of throwing", () => {
    expect(saveData(memoryStorage(true), valid())).toBe(false);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run src/store/storage.test.ts`
Expected: FAIL — `Failed to resolve import "./storage"`.

- [ ] **Step 4: Write `web/src/store/storage.ts`**

```ts
// Loading and saving Studium's data in localStorage, with validation and backups.
import { PET_KINDS, type StudiumData } from "../planner/types";
import { buildSeed } from "./seed";

export const STORAGE_KEY = "studium-data-v1";
export const BACKUP_PREFIX = "studium-data-backup-";

export type LoadNotice = "damaged-data" | "storage-unavailable" | null;
export type LoadResult = { data: StudiumData; persistent: boolean; notice: LoadNotice };

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === "string";
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isBool = (v: unknown): v is boolean => typeof v === "boolean";
const isNullableStr = (v: unknown) => v === null || isStr(v);
const allStr = (o: Obj, keys: string[]) => keys.every((k) => isStr(o[k]));

export function isValidData(value: unknown): value is StudiumData {
  if (!isObj(value) || value.version !== 1) return false;
  const { projects, requirements, tasks, events, today } = value;
  if (![projects, requirements, tasks, events].every(Array.isArray)) return false;
  if (!isObj(today) || !isStr(today.date) || !Array.isArray(today.taskIds) || !today.taskIds.every(isStr)) return false;

  const projectIds = new Set<string>();
  for (const p of projects as unknown[]) {
    if (!isObj(p) || !allStr(p, ["id", "name", "shortName", "color", "deadline", "description", "hatchedAt", "createdAt"])) return false;
    if (!PET_KINDS.includes(p.petKind as never)) return false;
    projectIds.add(p.id as string);
  }

  const requirementIds = new Set<string>();
  for (const r of requirements as unknown[]) {
    if (!isObj(r) || !allStr(r, ["id", "projectId", "title", "createdAt"]) || !isNum(r.weight)) return false;
    if (!isNullableStr(r.startDate) || !isNullableStr(r.dueDate) || !projectIds.has(r.projectId as string)) return false;
    requirementIds.add(r.id as string);
  }

  for (const t of tasks as unknown[]) {
    if (!isObj(t) || !allStr(t, ["id", "projectId", "title", "createdAt"]) || !projectIds.has(t.projectId as string)) return false;
    if (!(t.requirementId === null || (isStr(t.requirementId) && requirementIds.has(t.requirementId)))) return false;
    if (!isNum(t.estimateMin) || !Array.isArray(t.blockedBy) || !t.blockedBy.every(isStr)) return false;
    if (!isBool(t.priority) || !isBool(t.done) || !(t.actualMin === null || isNum(t.actualMin))) return false;
  }

  for (const e of events as unknown[]) {
    if (!isObj(e) || !isStr(e.type) || !isStr(e.at)) return false;
    if (e.type === "task_completed" && !(isStr(e.taskId) && isNum(e.tokens) && isObj(e.breakdown) && isNum(e.breakdown.finish))) return false;
    if (e.type === "purchase" && !(isStr(e.productId) && isNum(e.price))) return false;
    if (e.type === "medicine_given" && !isStr(e.projectId)) return false;
  }
  return true;
}

/** localStorage if it can actually be used (private modes and blocked storage return null). */
export function browserStorage(): Storage | null {
  try {
    const s = window.localStorage;
    const probe = "__studium_probe__";
    s.setItem(probe, probe);
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

export function saveData(storage: Storage | null, data: StudiumData): boolean {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadData(storage: Storage | null, now: Date): LoadResult {
  const unavailable: LoadResult = { data: buildSeed(now), persistent: false, notice: "storage-unavailable" };
  if (!storage) return unavailable;

  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return unavailable;
  }

  if (raw === null) {
    const data = buildSeed(now);
    saveData(storage, data);
    return { data, persistent: true, notice: null };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = undefined;
  }
  if (isValidData(parsed)) return { data: parsed, persistent: true, notice: null };

  // Damaged: keep the original text so nothing is lost, then start from the example data.
  try {
    storage.setItem(`${BACKUP_PREFIX}${now.toISOString()}`, raw);
  } catch {
    // Backup failed (storage full); still recover.
  }
  const data = buildSeed(now);
  saveData(storage, data);
  return { data, persistent: true, notice: "damaged-data" };
}
```

- [ ] **Step 5: Run tests and the build**

Run: `npx vitest run src/store/storage.test.ts`
Expected: PASS (7 tests).
Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/store/storage.ts src/store/storage.test.ts src/store/seed.ts
git commit -m "feat(store): validate, load and save data with backups for damaged data" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Example data

**Files:**
- Modify (replace): `web/src/store/seed.ts`
- Test: `web/src/store/seed.test.ts`

**Interfaces:**
- Consumes: `planner/types.ts`, `planner/time.ts`, `planner/mood.ts` (test only), `store/storage.ts` (`isValidData`, test only), `planner/history.ts` (test only).
- Produces: `buildSeed(now: Date): StudiumData` — five projects with ids `webDev`, `appDev`, `Animation`, `seniorCap`, `petExt` (same ids the extension already uses for saved pet positions), requirements `<projectId>-r<n>`, tasks `<projectId>-t<n>`.

Designed moods at any time of day (verified in Step 1's test):

| Project | Pet | Situation | Mood |
|---|---|---|---|
| webDev | pigeon | slightly ahead on case studies | Happy |
| appDev | dog | far behind on streaks (and slow: 1.5× estimates) | Worried or Upset |
| Animation | frog | Rigging idle 9 days | neglected, not Sick |
| seniorCap | cat | Prototype idle 16 days | Sick |
| petExt | turtle | Studium link just started | Happy (not Sick) |

- [ ] **Step 1: Write the failing test `web/src/store/seed.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { tokenBalance } from "../planner/history";
import { projectMood } from "../planner/mood";
import { NOW } from "../planner/testData";
import { buildSeed } from "./seed";
import { isValidData } from "./storage";

const LATE = new Date(2026, 9, 14, 23, 30);
const EARLY = new Date(2026, 9, 14, 0, 5);

describe.each([
  ["noon", NOW],
  ["late evening", LATE],
  ["just after midnight", EARLY],
])("buildSeed at %s", (_label, now) => {
  const seed = buildSeed(now);
  const mood = (id: string) => projectMood(id, seed, now);

  it("is valid, fully linked data with a 650-token balance", () => {
    expect(isValidData(seed)).toBe(true);
    expect(seed.projects.map((p) => p.id)).toEqual(["webDev", "appDev", "Animation", "seniorCap", "petExt"]);
    expect(seed.tasks.every((t) => t.requirementId !== null)).toBe(true);
    const ids = new Set(seed.tasks.map((t) => t.id));
    expect(seed.tasks.flatMap((t) => t.blockedBy).every((id) => ids.has(id))).toBe(true);
    expect(seed.tasks.some((t) => t.blockedBy.length > 0)).toBe(true);
    expect(tokenBalance(seed.events)).toBe(650);
  });

  it("starts with a mix of moods", () => {
    expect(["Happy", "Delighted"]).toContain(mood("webDev").mood);
    expect(["Worried", "Upset"]).toContain(mood("appDev").mood);
    expect(mood("appDev").neglected).toEqual([]);
    expect(mood("Animation").neglected.length).toBeGreaterThan(0);
    expect(mood("Animation").mood).not.toBe("Sick");
    expect(mood("seniorCap").mood).toBe("Sick");
    expect(mood("petExt").mood).toBe("Happy");
  });

  it("puts only open tasks in today's plan", () => {
    const open = new Set(seed.tasks.filter((t) => !t.done).map((t) => t.id));
    expect(seed.today.taskIds.length).toBeGreaterThan(0);
    expect(seed.today.taskIds.every((id) => open.has(id))).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/store/seed.test.ts`
Expected: FAIL — the temporary seed has no projects (`expected [] to equal [ 'webDev', … ]`).

- [ ] **Step 3: Replace `web/src/store/seed.ts`**

```ts
// Example data, built relative to "now" so it looks the same whenever it is first opened.
// Day offsets: negative = in the past. Task numbers in blockedBy are within the same project.
import { DAY_MS, addDays, localDateKey } from "../planner/time";
import {
  ZERO_BREAKDOWN,
  type PetKind,
  type Project,
  type Requirement,
  type StudiumData,
  type StudiumEvent,
  type Task,
} from "../planner/types";

type SeedTask = {
  title: string;
  est: number;
  done?: { daysAgo: number; actual: number };
  priority?: boolean;
  blockedBy?: number[];
};
type SeedRequirement = { title: string; weight: number; start: number; due: number | null; tasks: SeedTask[] };
type SeedProject = {
  id: string;
  name: string;
  color: string;
  petKind: PetKind;
  deadline: number;
  createdDaysAgo: number;
  description: string;
  requirements: SeedRequirement[];
};

const SEED: SeedProject[] = [
  {
    id: "webDev",
    name: "Web Development Portfolio",
    color: "#2d3a8c",
    petKind: "pigeon",
    deadline: 48,
    createdDaysAgo: 30,
    description: "Build a personal portfolio site with case studies, live demos, and a blog.",
    requirements: [
      {
        title: "Site structure & design",
        weight: 3,
        start: -30,
        due: -5,
        tasks: [
          { title: "Design landing page layout", est: 120, done: { daysAgo: 12, actual: 120 } },
          { title: "Implement responsive nav", est: 180, done: { daysAgo: 8, actual: 180 } },
        ],
      },
      {
        title: "Case studies",
        weight: 5,
        start: -20,
        due: 20,
        tasks: [
          { title: "Write case study #1", est: 180, done: { daysAgo: 5, actual: 180 } },
          { title: "Write case study #2", est: 180, done: { daysAgo: 2, actual: 180 } },
          { title: "Write case study #3", est: 180, priority: true },
          { title: "Record demo videos", est: 120 },
        ],
      },
      {
        title: "Contact form & deploy",
        weight: 2,
        start: 10,
        due: null,
        tasks: [
          { title: "Contact form with validation", est: 120 },
          { title: "Deploy to Vercel", est: 60, blockedBy: [7] },
        ],
      },
    ],
  },
  {
    id: "appDev",
    name: "Mobile App — Habit Tracker",
    color: "#c9501a",
    petKind: "dog",
    deadline: 124,
    createdDaysAgo: 40,
    description: "React Native app for tracking daily habits with streaks, reminders, and analytics.",
    requirements: [
      {
        title: "Core habit screens",
        weight: 4,
        start: -40,
        due: -10,
        tasks: [
          { title: "Set up Expo project", est: 60, done: { daysAgo: 30, actual: 90 } },
          { title: "Design onboarding flow", est: 120, done: { daysAgo: 25, actual: 180 } },
          { title: "Build habit CRUD screens", est: 240, done: { daysAgo: 4, actual: 360 } },
        ],
      },
      {
        title: "Streaks & reminders",
        weight: 4,
        start: -20,
        due: 5,
        tasks: [
          { title: "Implement streak logic", est: 180, priority: true },
          { title: "Streak unit tests", est: 120, blockedBy: [4] },
          { title: "Push notification integration", est: 240 },
          { title: "Notification permission UX", est: 60, done: { daysAgo: 3, actual: 90 } },
        ],
      },
      {
        title: "Analytics",
        weight: 2,
        start: 1,
        due: 60,
        tasks: [{ title: "Analytics dashboard", est: 240, blockedBy: [4] }],
      },
    ],
  },
  {
    id: "Animation",
    name: "3D Animation Reel",
    color: "#3a7c4f",
    petKind: "frog",
    deadline: 18,
    createdDaysAgo: 35,
    description: "Produce a 90-second showreel showcasing motion graphics and 3D character animation.",
    requirements: [
      {
        title: "Story & modeling",
        weight: 3,
        start: -35,
        due: -15,
        tasks: [
          { title: "Storyboard all 6 scenes", est: 240, done: { daysAgo: 25, actual: 240 } },
          { title: "Model hero character", est: 300, done: { daysAgo: 18, actual: 300 } },
        ],
      },
      {
        title: "Rigging",
        weight: 4,
        start: -14,
        due: 3,
        tasks: [
          { title: "Rig hero character", est: 240, done: { daysAgo: 9, actual: 240 } },
          { title: "Weight paint character", est: 180, priority: true },
        ],
      },
      {
        title: "Animation & render",
        weight: 5,
        start: 4,
        due: 17,
        tasks: [
          { title: "Animate scenes 1 & 2", est: 480, blockedBy: [4] },
          { title: "Render final frames", est: 240, blockedBy: [5] },
          { title: "Sound design & export", est: 180, blockedBy: [6] },
        ],
      },
    ],
  },
  {
    id: "seniorCap",
    name: "Senior Capstone Project",
    color: "#7b4fa6",
    petKind: "cat",
    deadline: 208,
    createdDaysAgo: 60,
    description: "Full-stack AI-assisted tutoring platform — research, development, and thesis paper.",
    requirements: [
      {
        title: "Research",
        weight: 3,
        start: -60,
        due: -30,
        tasks: [
          { title: "Literature review (20 papers)", est: 600, done: { daysAgo: 40, actual: 600 } },
          { title: "Define research questions", est: 120, done: { daysAgo: 32, actual: 120 } },
        ],
      },
      {
        title: "Prototype v1",
        weight: 5,
        start: -30,
        due: 30,
        tasks: [
          { title: "System architecture design", est: 240, done: { daysAgo: 16, actual: 240 } },
          { title: "Build prototype v1", est: 900, priority: true, blockedBy: [3] },
          { title: "Prototype database schema", est: 180 },
        ],
      },
      {
        title: "User study",
        weight: 4,
        start: 20,
        due: 90,
        tasks: [
          { title: "Recruit participants (n=20)", est: 120, blockedBy: [4] },
          { title: "Run user study", est: 600, blockedBy: [6] },
        ],
      },
      {
        title: "Thesis & defense",
        weight: 4,
        start: 60,
        due: null,
        tasks: [
          { title: "Write thesis draft", est: 1200 },
          { title: "Defense presentation", est: 300, blockedBy: [8] },
        ],
      },
    ],
  },
  {
    id: "petExt",
    name: "Virtual Pet Extension",
    color: "#1a6e7e",
    petKind: "turtle",
    deadline: 62,
    createdDaysAgo: 14,
    description: "Chrome extension with project pets that follow you across the web and link to Studium.",
    requirements: [
      {
        title: "Pet basics",
        weight: 4,
        start: -14,
        due: -3,
        tasks: [
          { title: "Pet walks, drags, and throws", est: 240, done: { daysAgo: 10, actual: 240 } },
          { title: "One pet per project", est: 120, done: { daysAgo: 6, actual: 120 } },
          { title: "Pet types and art", est: 240, done: { daysAgo: 1, actual: 240 } },
        ],
      },
      {
        title: "Studium link",
        weight: 5,
        start: -2,
        due: 25,
        tasks: [
          { title: "Save Studium data between visits", est: 480, priority: true },
          { title: "Share pet mood with Studium", est: 300, blockedBy: [4] },
        ],
      },
      {
        title: "Sprites & polish",
        weight: 2,
        start: 25,
        due: null,
        tasks: [{ title: "Replace placeholder art with sprites", est: 600 }],
      },
    ],
  },
];

const TODAY_TASK_IDS = ["webDev-t5", "Animation-t4"];

export function buildSeed(now: Date): StudiumData {
  const at = (daysAgo: number) => new Date(now.getTime() - daysAgo * DAY_MS).toISOString();
  const day = (offset: number) => localDateKey(addDays(now, offset));

  const projects: Project[] = [];
  const requirements: Requirement[] = [];
  const tasks: Task[] = [];
  const events: StudiumEvent[] = [];

  for (const sp of SEED) {
    const createdAt = at(sp.createdDaysAgo);
    projects.push({
      id: sp.id,
      name: sp.name,
      shortName: sp.id,
      color: sp.color,
      deadline: day(sp.deadline),
      description: sp.description,
      petKind: sp.petKind,
      hatchedAt: createdAt,
      createdAt,
    });

    let taskNumber = 0;
    sp.requirements.forEach((sr, i) => {
      const requirementId = `${sp.id}-r${i + 1}`;
      requirements.push({
        id: requirementId,
        projectId: sp.id,
        title: sr.title,
        weight: sr.weight,
        startDate: day(sr.start),
        dueDate: sr.due === null ? null : day(sr.due),
        createdAt,
      });
      for (const st of sr.tasks) {
        taskNumber += 1;
        const id = `${sp.id}-t${taskNumber}`;
        tasks.push({
          id,
          projectId: sp.id,
          requirementId,
          title: st.title,
          estimateMin: st.est,
          blockedBy: (st.blockedBy ?? []).map((n) => `${sp.id}-t${n}`),
          priority: st.priority ?? false,
          done: st.done !== undefined,
          actualMin: st.done?.actual ?? null,
          createdAt,
        });
        if (st.done) {
          // Seed completions pay nothing, so the starting balance stays 650.
          events.push({
            type: "task_completed",
            at: at(st.done.daysAgo),
            taskId: id,
            actualMin: st.done.actual,
            tokens: 0,
            breakdown: { ...ZERO_BREAKDOWN },
          });
        }
      }
    });
  }

  events.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  return { version: 1, projects, requirements, tasks, events, today: { date: localDateKey(now), taskIds: TODAY_TASK_IDS } };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/store/seed.test.ts`
Expected: PASS (9 tests: 3 cases × 3 times of day).

If a mood assertion fails, print the gaps with a one-off `console.log(projectMood(id, seed, now))` in the test, adjust **only** the seed's day offsets or estimates (not the rules or the test) until the designed moods in the table above hold at all three times, then remove the log.

- [ ] **Step 5: Run the whole suite**

Run: `npx vitest run`
Expected: all test files pass (Tasks 1–11).

- [ ] **Step 6: Commit**

```bash
git add src/store/seed.ts src/store/seed.test.ts
git commit -m "feat(store): add example data with a mix of moods" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Final check and README

**Files:**
- Modify: `README.md` (repo root)

**Interfaces:**
- Consumes: everything above.
- Produces: documentation only.

- [ ] **Step 1: Add a "Planner core" section to `README.md`** after the "Where to change things" table

```markdown
## Planner core (Studium logic)

The rules from the planner spec (`docs/superpowers/specs/2026-10-14-studium-planner-design.md`) live in `web/src/planner/` as plain, tested functions. The screens don't use them yet; that's the next plan.

| What | Where |
| --- | --- |
| Every tunable number (bonuses, thresholds, curve, token rate) | `web/src/planner/tuning.ts` |
| Example projects, requirements and tasks | `web/src/store/seed.ts` |
| Shop items, including Medicine | `web/src/store/products.ts` |

Run the tests with `npm test` in `web/`.
```

- [ ] **Step 2: Run the full test suite and the build**

Run: `npm test`
Expected: all tests pass.
Run: `npm run build`
Expected: build succeeds (the app still shows the old Studium screens).

- [ ] **Step 3: Commit**

```bash
git add ../README.md
git commit -m "docs: describe the planner core" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Coverage map (spec → task)

| Spec item | Task |
|---|---|
| Data model, events, ids, start date | 1, 9 |
| Token balance, inventory, pay once | 2, 7, 9 |
| Requirement pool, effort split, unlinked = 0 | 5, 7 |
| Finish bonus (once) | 7 |
| Unblock bonus, blocking, loops | 3, 7, 9 |
| Neglect bonus, recovery doubling | 6, 7 |
| Daily curve | 2, 7 |
| Sick penalty | 7 |
| Plan, gap, mood thresholds, neglect, Sick, Medicine, Recovering | 5, 6, 9 |
| Learning multipliers | 4 |
| Suggested next, Today's plan | 8, 9 |
| Edit/delete projects, requirements, tasks | 9 |
| Validation, backups, storage unavailable, unknown events | 10 |
| Example data with mixed moods | 11 |

Not in this plan (Plans 2 and 3): screens, egg picker, habitat, `studium-pets-v1`, extension changes.

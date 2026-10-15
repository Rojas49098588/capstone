# Studium Screens Implementation Plan (Plan 2 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Studium's in-memory screens with screens driven by the planner core: requirements and tasks with estimates and blockers, a completion prompt that records time and pays tokens, the habitat with mood readouts and medicine, Priority Focus with Today and Suggested next, the Care shop and the egg picker, all saved between visits.

**Architecture:** A `StudiumProvider` (React context) owns the saved data from `store/` and exposes every action from `store/actions.ts` with the current time filled in. Small pure helpers in `ui/` turn planner results into text (`format.ts`) and per-project summaries (`derive.ts`). Each screen piece is its own component in `components/`, takes ids (not stale objects) and reads live data from the context. `App.tsx` becomes a thin shell for navigation, modals and toasts.

**Tech Stack:** React 19, TypeScript 5.9 (strict), Tailwind CSS v4, Vite 8, Vitest 5 with jsdom, @testing-library/react and @testing-library/user-event.

**Spec:** `docs/superpowers/specs/2026-10-14-studium-planner-design.md` (sections 4 and 7). **Builds on:** Plan 1 (`docs/superpowers/plans/2026-10-15-planner-core.md`), branch `feature/planner-core`.

## Global Constraints

- Branch: create `feature/studium-screens` from `feature/planner-core` (Plan 1 is not merged into `main` yet).
- Components read and change data only through `useStudiumContext()`. The only direct `localStorage` use outside `store/` is the existing theme preference (`studium-theme`).
- Components never call `new Date()` / `Date.now()`; they use `s.now` from the context. The provider's clock is injectable for tests.
- The habitat box is `<div data-pet-habitat="<projectId>">`. The extension (Plan 3) sets `data-pet-attached` on it; if that hasn't happened within 1000 ms the still image `web/public/pets/<petKind>.png` is shown.
- Keep the existing look: Tailwind utility classes with the CSS variables in `web/src/index.css`, DM Serif Display headings via `style={SERIF}`, DM Mono labels. No new UI libraries.
- The egg picker must never show the animal's name in visible text or accessible names before hatching.
- Every component test file starts with `// @vitest-environment jsdom` and imports `renderWithStudium` (or at least `../test/render`) so React Testing Library cleans up between tests.
- Run commands from `web/`. Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Deleting the thing you're looking at** (the open project, a requirement whose card is showing, the task in the completion prompt) — the app falls back gracefully instead of crashing. Pinned in Task 13 (`deleting the open project returns to the overview`) and by components returning `null` for missing ids (Tasks 5, 6, 7).
2. **The day changing while the page stays open** — Today's plan must clear and day labels update without a reload. Pinned in Task 3 (`refreshes "now" every minute`).
3. **Storage failing mid-session** (quota full, private mode) — the app keeps working and says changes won't be saved. Pinned in Task 3 (`reports a failed save`) and Task 13 (notice banner).
4. **Keyboard-only use** — Escape closes the completion prompt and project modal; arrow keys move between eggs. Pinned in Tasks 4, 7 and 12.
5. **Re-checking and un-checking tasks from different places** (Today list vs project page) — the same task shows the same state everywhere and pays once. Pinned in Task 13 (`complete from Today, reopen on the project page`).

---

## File Structure

```
web/
  package.json                      + @testing-library/react, @testing-library/user-event, @testing-library/dom, jsdom
  public/pets/{cat,dog,frog,pigeon,turtle}.png   copied from extension/assets/pets
  src/
    test/render.tsx                 renderWithStudium, memoryStorage, savedData (+ RTL cleanup)
    ui/styles.ts                    shared class strings, project colors
    ui/format.ts                    all UI wording: minutes, dates, gap, attention, accuracy, payout message
    ui/derive.ts                    per-project and overall summaries
    store/useStudium.tsx            useStudium hook, StudiumProvider, useStudiumContext
    pets/eggs.ts                    egg looks + vague descriptions, shuffle
    components/
      EstimatePicker.tsx            quick time buttons + custom minutes
      EggPicker.tsx                 five mystery eggs
      TaskForm.tsx                  add/edit task fields
      TaskRow.tsx                   one task: complete/reopen, lock, today, pin, edit, delete, link
      RequirementForm.tsx           add/edit requirement fields
      RequirementCard.tsx           one requirement with progress vs plan and its tasks
      RequirementsSection.tsx       all requirements + Unlinked group + add requirement
      CompletionPrompt.tsx          "About how long did it take?"
      Toast.tsx                     short status message
      Habitat.tsx                   pet box + mood/attention/accuracy + medicine
      ProjectDetail.tsx             project page
      Overview.tsx                  totals, rings, Priority Focus (Today / Suggested), project cards
      Shop.tsx                      catalog incl. Care / Medicine
      ProjectModal.tsx              new/edit/delete project, egg picker
      NoticeBanner.tsx              saved-data notices
    App.tsx                         shell only (navigation, theme, modals, toast)
    *.test.ts(x)                    next to each file
README.md, HANDOFF.md               updated in Task 14
```

---

### Task 1: UI test tooling, shared styles, wording helpers, pet images

**Files:**
- Modify: `web/package.json` (dev dependencies)
- Create: `web/public/pets/*.png` (copies), `web/src/test/render.tsx`, `web/src/ui/styles.ts`, `web/src/ui/format.ts`
- Test: `web/src/ui/format.test.ts`

**Interfaces:**
- Consumes: Plan 1 — `planner/time.ts` (`DAY_MS`, `isDateKey`, `localDateKey`, `startOfLocalDay`), `planner/mood.ts` (`NeglectedRequirement`), `planner/tuning.ts` (`LEARNING_MIN_SAMPLES_SHOWN`), `planner/types.ts` (`Mood`, `Task`, `ZERO_BREAKDOWN`), `planner/value.ts` (`Payout`), `planner/testData.ts`.
- Produces:
  - `ui/styles.ts`: `CARD`, `LABEL`, `INPUT`, `BUTTON_PRIMARY`, `BUTTON_SECONDARY`, `BUTTON_SMALL`, `MUTED`, `SERIF`, `PROJECT_COLORS`.
  - `ui/format.ts`: `ESTIMATE_CHOICES`, `MOOD_COLORS`, `formatMinutes(min)`, `formatDate(key)`, `daysUntil(key, now)`, `deadlineLabel(key, now)`, `percent(fraction)`, `gapLabel(gap)`, `attentionLabel(neglected)`, `accuracyLabel(shortName, multiplier, samples)`, `payoutMessage(payout, task)`.
  - `test/render.tsx` (completed in Task 3): for now `memoryStorage()` and the RTL `afterEach(cleanup)` registration.

- [ ] **Step 1: Create the branch and install test tooling**

```bash
git checkout feature/planner-core
git checkout -b feature/studium-screens
npm install -D @testing-library/react @testing-library/user-event @testing-library/dom jsdom
mkdir -p public/pets && cp ../extension/assets/pets/*.png public/pets/
```

- [ ] **Step 2: Write `web/src/ui/styles.ts`**

```ts
// Shared class strings so every screen keeps Studium's look.
export const CARD = "bg-[var(--color-card)] border border-[var(--color-border)]";
export const LABEL = "block text-xs font-mono uppercase tracking-widest text-[var(--color-muted-foreground)] mb-1";
export const INPUT =
  "w-full border border-[var(--color-border)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-foreground)]";
export const BUTTON_PRIMARY =
  "px-4 py-2 text-sm bg-[var(--color-primary)] text-[var(--color-primary-foreground)] hover:bg-[var(--color-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors";
export const BUTTON_SECONDARY =
  "px-4 py-2 text-sm border border-[var(--color-border)] hover:border-[var(--color-foreground)] transition-colors";
export const BUTTON_SMALL =
  "px-2 py-1 text-xs border border-[var(--color-border)] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:border-[var(--color-foreground)] transition-colors";
export const MUTED = "text-[var(--color-muted-foreground)]";
export const SERIF = { fontFamily: "var(--font-serif)" } as const;
export const PROJECT_COLORS = ["#2d3a8c", "#c9501a", "#3a7c4f", "#7b4fa6", "#8a6a00", "#1a6e7e"];
```

- [ ] **Step 3: Write `web/src/test/render.tsx` (first part)**

```tsx
// Test helpers for components. Importing this file also registers RTL cleanup.
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(cleanup);

/** An in-memory Storage. */
export function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (k: string) => void map.delete(k),
    setItem: (k: string, v: string) => void map.set(k, String(v)),
  } as Storage;
}
```

- [ ] **Step 4: Write the failing test `web/src/ui/format.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { NOW, dayKey, makeRequirement, makeTask } from "../planner/testData";
import { ZERO_BREAKDOWN } from "../planner/types";
import {
  accuracyLabel,
  attentionLabel,
  deadlineLabel,
  formatDate,
  formatMinutes,
  gapLabel,
  payoutMessage,
} from "./format";

describe("format", () => {
  it("formats minutes", () => {
    expect([15, 60, 90, 480].map(formatMinutes)).toEqual(["15 min", "1 h", "1 h 30 min", "8 h"]);
  });

  it("formats dates and handles empty ones", () => {
    expect(formatDate("2026-12-01")).toBe("Dec 1, 2026");
    expect(formatDate("")).toBe("No date");
  });

  it("labels deadlines by calendar day", () => {
    expect(deadlineLabel(dayKey(3), NOW)).toBe("3 days left");
    expect(deadlineLabel(dayKey(1), NOW)).toBe("1 day left");
    expect(deadlineLabel(dayKey(0), NOW)).toBe("Due today");
    expect(deadlineLabel(dayKey(-1), NOW)).toBe("Overdue");
  });

  it("describes the schedule gap", () => {
    expect(gapLabel(4.2)).toBe("4 points ahead of plan");
    expect(gapLabel(-18.6)).toBe("19 points behind plan");
    expect(gapLabel(1)).toBe("1 point ahead of plan");
    expect(gapLabel(0.3)).toBe("On plan");
  });

  it("names the longest-idle requirement", () => {
    expect(attentionLabel([])).toBe("All requirements active");
    expect(attentionLabel([{ requirement: makeRequirement({ title: "User study" }), idleDays: 9 }])).toBe(
      "User study: 9 days idle",
    );
  });

  it("shows estimate accuracy only with enough samples", () => {
    expect(accuracyLabel("appDev", 1.42, 3)).toBe("Your appDev tasks take about 1.4× your estimates");
    expect(accuracyLabel("appDev", 1.42, 2)).toBeNull();
  });

  it("explains a payout", () => {
    const payout = { tokens: 29, breakdown: { ...ZERO_BREAKDOWN, base: 70, unblockBonus: 0.3, neglectBonus: 0.1 } };
    expect(payoutMessage(payout, makeTask())).toBe(
      "+29 tokens: unblocks work +30%, revived a neglected requirement +10%",
    );
    const zero = { tokens: 0, breakdown: { ...ZERO_BREAKDOWN } };
    expect(payoutMessage(zero, makeTask({ requirementId: null }))).toMatch(/Unlinked tasks earn no tokens/);
    expect(payoutMessage(zero, makeTask())).toMatch(/already paid/);
  });
});
```

- [ ] **Step 5: Run it to verify it fails**

Run: `npx vitest run src/ui/format.test.ts`
Expected: FAIL — `Cannot find module './format'`.

- [ ] **Step 6: Write `web/src/ui/format.ts`**

```ts
// All wording shown in the UI, in one place so it stays consistent and testable.
import type { NeglectedRequirement } from "../planner/mood";
import { DAY_MS, isDateKey, localDateKey, startOfLocalDay } from "../planner/time";
import { LEARNING_MIN_SAMPLES_SHOWN } from "../planner/tuning";
import type { Mood, Task } from "../planner/types";
import type { Payout } from "../planner/value";

export const ESTIMATE_CHOICES: readonly number[] = [15, 30, 60, 120, 240, 480];

export const MOOD_COLORS: Record<Mood, string> = {
  Proud: "#3a7c4f",
  Delighted: "#3a7c4f",
  Happy: "#1a6e7e",
  Worried: "#c9501a",
  Upset: "#b4443c",
  Sick: "#7a8a2a",
};

export function formatMinutes(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} h ${rest} min` : `${h} h`;
}

export function formatDate(key: string): string {
  if (!isDateKey(key)) return "No date";
  return startOfLocalDay(key).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** Calendar days from today to the date: 0 = today, negative = past. */
export function daysUntil(key: string, now: Date): number {
  if (!isDateKey(key)) return 0;
  return Math.round((startOfLocalDay(key).getTime() - startOfLocalDay(localDateKey(now)).getTime()) / DAY_MS);
}

export function deadlineLabel(key: string, now: Date): string {
  const d = daysUntil(key, now);
  if (d > 1) return `${d} days left`;
  if (d === 1) return "1 day left";
  if (d === 0) return "Due today";
  return "Overdue";
}

export function percent(fraction: number): number {
  return Math.round(fraction * 100);
}

export function gapLabel(gap: number): string {
  const n = Math.round(Math.abs(gap));
  if (n === 0) return "On plan";
  return `${n} ${n === 1 ? "point" : "points"} ${gap > 0 ? "ahead of" : "behind"} plan`;
}

export function attentionLabel(neglected: NeglectedRequirement[]): string {
  if (neglected.length === 0) return "All requirements active";
  const top = neglected[0];
  return `${top.requirement.title}: ${top.idleDays} days idle`;
}

export function accuracyLabel(shortName: string, multiplier: number, samples: number): string | null {
  if (samples < LEARNING_MIN_SAMPLES_SHOWN) return null;
  return `Your ${shortName} tasks take about ${multiplier.toFixed(1)}× your estimates`;
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

export function payoutMessage(payout: Payout, task: Task): string {
  if (payout.tokens === 0) {
    return task.requirementId
      ? "Done. No new tokens: this task was already paid."
      : "Done. Unlinked tasks earn no tokens; link it to a requirement next time.";
  }
  const b = payout.breakdown;
  const parts: string[] = [];
  if (b.unblockBonus > 0) parts.push(`unblocks work +${pct(b.unblockBonus)}`);
  if (b.neglectBonus > 0) parts.push(`revived a neglected requirement +${pct(b.neglectBonus)}`);
  if (b.finish > 0) parts.push("finished a requirement");
  if (b.dailyCurve < 1) parts.push(`busy day ×${b.dailyCurve.toFixed(2)}`);
  if (b.sickMultiplier < 1) parts.push(`sick pet ×${b.sickMultiplier}`);
  return `+${payout.tokens} tokens${parts.length > 0 ? `: ${parts.join(", ")}` : ""}`;
}
```

- [ ] **Step 7: Run tests and the build**

Run: `npx vitest run src/ui/format.test.ts`
Expected: PASS (7 tests).
Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json public/pets src/test src/ui
git commit -m "feat(ui): add UI test tooling, shared styles and wording helpers" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Project summaries

**Files:**
- Create: `web/src/ui/derive.ts`
- Test: `web/src/ui/derive.test.ts`

**Interfaces:**
- Consumes: `planner/learning.ts` (`estimateMultipliers`, `multiplierFor`, `samplesFor`, `Multipliers`), `planner/mood.ts` (`projectMood`, `NeglectedRequirement`, `ProjectHealth`), `planner/progress.ts` (`projectProgress`, `totalProgress`), `store/seed.ts` (`buildSeed`, test), `store/actions.ts` (`createProject`, test).
- Produces:
  - `type ProjectSummary = { project; progress; gap; mood; neglected; health; multiplier; samples; tasksDone; tasksTotal }`
  - `summarizeProject(project: Project, data: StudiumData, now: Date, multipliers?: Multipliers): ProjectSummary`
  - `type Dashboard = { summaries: ProjectSummary[]; total: number; tasksDone: number; tasksTotal: number }`
  - `summarizeAll(data: StudiumData, now: Date): Dashboard`

- [ ] **Step 1: Write the failing test `web/src/ui/derive.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { NOW, dayKey } from "../planner/testData";
import { createProject } from "../store/actions";
import { buildSeed } from "../store/seed";
import { summarizeAll, summarizeProject } from "./derive";

describe("summaries", () => {
  it("summarizes every project in the example data", () => {
    const dash = summarizeAll(buildSeed(NOW), NOW);
    expect(dash.summaries.map((s) => s.project.id)).toEqual(["webDev", "appDev", "Animation", "seniorCap", "petExt"]);
    const web = dash.summaries[0];
    expect([web.tasksDone, web.tasksTotal]).toEqual([4, 8]);
    expect(dash.summaries[3].mood).toBe("Sick");
    expect(dash.total).toBeGreaterThan(0);
    expect(dash.total).toBeLessThan(1);
    expect(dash.tasksTotal).toBe(dash.summaries.reduce((n, s) => n + s.tasksTotal, 0));
  });

  it("handles a project with no requirements", () => {
    const { data, project } = createProject(
      buildSeed(NOW),
      { name: "Blank", shortName: "blank", color: "#2d3a8c", deadline: dayKey(30), description: "", petKind: "cat" },
      NOW,
    );
    const s = summarizeProject(project, data, NOW);
    expect([s.progress, s.gap, s.mood, s.tasksTotal]).toEqual([0, 0, "Happy", 0]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/ui/derive.test.ts`
Expected: FAIL — `Cannot find module './derive'`.

- [ ] **Step 3: Write `web/src/ui/derive.ts`**

```ts
// Everything a screen needs to know about a project, computed once per render.
import { estimateMultipliers, multiplierFor, samplesFor, type Multipliers } from "../planner/learning";
import { projectMood, type NeglectedRequirement, type ProjectHealth } from "../planner/mood";
import { projectProgress, totalProgress } from "../planner/progress";
import type { Mood, Project, StudiumData } from "../planner/types";

export type ProjectSummary = {
  project: Project;
  progress: number; // 0..1, weighted by requirement weight
  gap: number; // percentage points vs plan
  mood: Mood;
  neglected: NeglectedRequirement[];
  health: ProjectHealth;
  multiplier: number;
  samples: number;
  tasksDone: number;
  tasksTotal: number;
};

export function summarizeProject(
  project: Project,
  data: StudiumData,
  now: Date,
  multipliers: Multipliers = estimateMultipliers(data),
): ProjectSummary {
  const m = projectMood(project.id, data, now, multipliers);
  const tasks = data.tasks.filter((t) => t.projectId === project.id);
  return {
    project,
    progress: projectProgress(project.id, data, multipliers),
    gap: m.gap,
    mood: m.mood,
    neglected: m.neglected,
    health: m.health,
    multiplier: multiplierFor(multipliers, project.id),
    samples: samplesFor(multipliers, project.id),
    tasksDone: tasks.filter((t) => t.done).length,
    tasksTotal: tasks.length,
  };
}

export type Dashboard = { summaries: ProjectSummary[]; total: number; tasksDone: number; tasksTotal: number };

export function summarizeAll(data: StudiumData, now: Date): Dashboard {
  const multipliers = estimateMultipliers(data);
  const summaries = data.projects.map((p) => summarizeProject(p, data, now, multipliers));
  return {
    summaries,
    total: totalProgress(data, multipliers),
    tasksDone: summaries.reduce((n, s) => n + s.tasksDone, 0),
    tasksTotal: summaries.reduce((n, s) => n + s.tasksTotal, 0),
  };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/ui/derive.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ui/derive.ts src/ui/derive.test.ts
git commit -m "feat(ui): summarize projects for the screens" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The Studium provider

**Files:**
- Create: `web/src/store/useStudium.tsx`
- Modify: `web/src/test/render.tsx` (add `renderWithStudium`, `savedData`)
- Test: `web/src/store/useStudium.test.tsx`

**Interfaces:**
- Consumes: `store/storage.ts` (`browserStorage`, `loadData`, `saveData`, `LoadNotice`, `STORAGE_KEY`), `store/actions.ts` (all actions and input types), `planner/value.ts` (`Payout`).
- Produces:
  - `type Notice = LoadNotice | "save-failed"`
  - `type StudiumOptions = { storage?: Storage | null; clock?: () => Date }`
  - `useStudium(options?: StudiumOptions): Studium` where `Studium` has `data`, `now`, `notice`, `persistent`, `dismissNotice()`, and actions: `createProject(input): Project`, `updateProject(id, changes)`, `deleteProject(id)`, `createRequirement(input): Requirement`, `updateRequirement(id, changes)`, `deleteRequirement(id, mode)`, `createTask(input): Task`, `updateTask(id, changes)`, `deleteTask(id)`, `togglePriority(id)`, `completeTask(id, actualMin): Payout | null`, `reopenTask(id)`, `addToToday(id)`, `removeFromToday(id)`, `purchase(productId): boolean`, `giveMedicine(projectId): boolean`.
  - `StudiumProvider({ children, options? })`, `useStudiumContext(): Studium`, `NOW_REFRESH_MS = 60_000`.
  - `test/render.tsx`: `renderWithStudium(ui, { data?, now?, storage? }) → RenderResult & { storage: Storage | null }`, `savedData(storage): StudiumData`.

- [ ] **Step 1: Add to `web/src/test/render.tsx`** (append below `memoryStorage`)

```tsx
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { NOW } from "../planner/testData";
import type { StudiumData } from "../planner/types";
import { buildSeed } from "../store/seed";
import { STORAGE_KEY, saveData } from "../store/storage";
import { StudiumProvider } from "../store/useStudium";

/** Renders `ui` inside a StudiumProvider with saved data (the example data by default) and a fixed clock. */
export function renderWithStudium(
  ui: ReactElement,
  o: { data?: StudiumData; now?: Date; storage?: Storage | null } = {},
) {
  const now = o.now ?? NOW;
  const storage = o.storage === null ? null : (o.storage ?? memoryStorage());
  if (storage) saveData(storage, o.data ?? buildSeed(now));
  const result = render(<StudiumProvider options={{ storage, clock: () => now }}>{ui}</StudiumProvider>);
  return { ...result, storage };
}

/** What the provider last saved. */
export function savedData(storage: Storage | null): StudiumData {
  return JSON.parse(storage?.getItem(STORAGE_KEY) ?? "null") as StudiumData;
}
```

Move the new `import` lines to the top of the file with the existing imports.

- [ ] **Step 2: Write the failing test `web/src/store/useStudium.test.tsx`**

```tsx
// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NOW } from "../planner/testData";
import { memoryStorage, savedData } from "../test/render";
import { STORAGE_KEY } from "./storage";
import { NOW_REFRESH_MS, useStudium } from "./useStudium";

afterEach(() => vi.useRealTimers());

describe("useStudium", () => {
  it("loads the example data and saves it on the first visit", () => {
    const storage = memoryStorage();
    const { result } = renderHook(() => useStudium({ storage, clock: () => NOW }));
    expect(result.current.data.projects).toHaveLength(5);
    expect(storage.getItem(STORAGE_KEY)).not.toBeNull();
    expect(result.current.notice).toBeNull();
  });

  it("applies actions with the clock's time and saves them", () => {
    const storage = memoryStorage();
    const { result } = renderHook(() => useStudium({ storage, clock: () => NOW }));
    let payout: ReturnType<typeof result.current.completeTask> = null;
    act(() => {
      payout = result.current.completeTask("webDev-t5", 180);
    });
    expect(payout).not.toBeNull();
    const saved = savedData(storage);
    expect(saved.tasks.find((t) => t.id === "webDev-t5")?.done).toBe(true);
    expect(saved.events.slice(-1)[0].at).toBe(NOW.toISOString());
    expect(result.current.data).toEqual(saved);
  });

  it("reports a failed save but keeps working", () => {
    const storage = memoryStorage();
    const { result } = renderHook(() => useStudium({ storage, clock: () => NOW }));
    storage.setItem = () => {
      throw new Error("QuotaExceededError");
    };
    act(() => {
      result.current.addToToday("webDev-t6");
    });
    expect(result.current.notice).toBe("save-failed");
    expect(result.current.data.today.taskIds).toContain("webDev-t6");
  });

  it("works without storage", () => {
    const { result } = renderHook(() => useStudium({ storage: null, clock: () => NOW }));
    expect([result.current.notice, result.current.persistent]).toEqual(["storage-unavailable", false]);
    act(() => {
      result.current.togglePriority("webDev-t6");
    });
    expect(result.current.data.tasks.find((t) => t.id === "webDev-t6")?.priority).toBe(true);
  });

  it('refreshes "now" every minute so day changes show up', () => {
    vi.useFakeTimers();
    let time = NOW;
    const { result } = renderHook(() => useStudium({ storage: memoryStorage(), clock: () => time }));
    time = new Date(NOW.getTime() + 24 * 3_600_000);
    act(() => {
      vi.advanceTimersByTime(NOW_REFRESH_MS);
    });
    expect(result.current.now).toEqual(time);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run src/store/useStudium.test.tsx`
Expected: FAIL — `Cannot find module './useStudium'` (imported by both the test and `test/render.tsx`).

- [ ] **Step 4: Write `web/src/store/useStudium.tsx`**

```tsx
// Owns Studium's saved data for the React tree. Every action gets the current time,
// is applied with the pure functions in actions.ts, and is saved straight away.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { StudiumData } from "../planner/types";
import * as A from "./actions";
import { browserStorage, loadData, saveData, type LoadNotice } from "./storage";

export const NOW_REFRESH_MS = 60_000;

export type Notice = LoadNotice | "save-failed";
export type StudiumOptions = { storage?: Storage | null; clock?: () => Date };

export function useStudium(options: StudiumOptions = {}) {
  const [env] = useState(() => ({
    storage: options.storage === undefined ? browserStorage() : options.storage,
    clock: options.clock ?? (() => new Date()),
  }));
  const [initial] = useState(() => loadData(env.storage, env.clock()));
  const [data, setData] = useState<StudiumData>(initial.data);
  const [notice, setNotice] = useState<Notice>(initial.notice);
  const [now, setNow] = useState(() => env.clock());
  const dataRef = useRef(data);
  const persistent = initial.persistent;

  // Moods, day labels and Today's plan depend on the date, so keep "now" fresh.
  useEffect(() => {
    const id = setInterval(() => setNow(env.clock()), NOW_REFRESH_MS);
    return () => clearInterval(id);
  }, [env]);

  const apply = useCallback(
    function apply<R>(fn: (d: StudiumData, at: Date) => { data: StudiumData; result: R }): R {
      const at = env.clock();
      const { data: next, result } = fn(dataRef.current, at);
      if (next !== dataRef.current) {
        dataRef.current = next;
        setData(next);
        setNow(at);
        if (persistent && !saveData(env.storage, next)) setNotice("save-failed");
      }
      return result;
    },
    [env, persistent],
  );

  const actions = useMemo(() => {
    const change = (fn: (d: StudiumData, at: Date) => StudiumData) =>
      apply((d, at) => ({ data: fn(d, at), result: undefined }));
    return {
      createProject: (input: A.ProjectInput) =>
        apply((d, at) => {
          const r = A.createProject(d, input, at);
          return { data: r.data, result: r.project };
        }),
      updateProject: (id: string, changes: Parameters<typeof A.updateProject>[2]) =>
        change((d) => A.updateProject(d, id, changes)),
      deleteProject: (id: string) => change((d) => A.deleteProject(d, id)),
      createRequirement: (input: A.RequirementInput) =>
        apply((d, at) => {
          const r = A.createRequirement(d, input, at);
          return { data: r.data, result: r.requirement };
        }),
      updateRequirement: (id: string, changes: Parameters<typeof A.updateRequirement>[2]) =>
        change((d, at) => A.updateRequirement(d, id, changes, at)),
      deleteRequirement: (id: string, mode: "deleteTasks" | "unlinkTasks") =>
        change((d) => A.deleteRequirement(d, id, mode)),
      createTask: (input: A.TaskInput) =>
        apply((d, at) => {
          const r = A.createTask(d, input, at);
          return { data: r.data, result: r.task };
        }),
      updateTask: (id: string, changes: Parameters<typeof A.updateTask>[2]) =>
        change((d, at) => A.updateTask(d, id, changes, at)),
      deleteTask: (id: string) => change((d) => A.deleteTask(d, id)),
      togglePriority: (id: string) => change((d) => A.togglePriority(d, id)),
      completeTask: (id: string, actualMin: number | null) =>
        apply((d, at) => {
          const r = A.completeTask(d, id, actualMin, at);
          return { data: r.data, result: r.payout };
        }),
      reopenTask: (id: string) => change((d, at) => A.reopenTask(d, id, at)),
      addToToday: (id: string) => change((d, at) => A.addToToday(d, id, at)),
      removeFromToday: (id: string) => change((d, at) => A.removeFromToday(d, id, at)),
      purchase: (productId: string) =>
        apply((d, at) => {
          const r = A.purchase(d, productId, at);
          return { data: r.data, result: r.ok };
        }),
      giveMedicine: (projectId: string) =>
        apply((d, at) => {
          const r = A.giveMedicine(d, projectId, at);
          return { data: r.data, result: r.ok };
        }),
    };
  }, [apply]);

  const dismissNotice = useCallback(() => setNotice(null), []);

  return { data, now, notice, persistent, dismissNotice, ...actions };
}

export type Studium = ReturnType<typeof useStudium>;

const StudiumContext = createContext<Studium | null>(null);

export function StudiumProvider({ children, options }: { children: ReactNode; options?: StudiumOptions }) {
  const studium = useStudium(options);
  return <StudiumContext.Provider value={studium}>{children}</StudiumContext.Provider>;
}

export function useStudiumContext(): Studium {
  const studium = useContext(StudiumContext);
  if (!studium) throw new Error("useStudiumContext must be used inside <StudiumProvider>");
  return studium;
}
```

- [ ] **Step 5: Run tests and the build**

Run: `npx vitest run src/store/useStudium.test.tsx`
Expected: PASS (5 tests).
Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/store/useStudium.tsx src/store/useStudium.test.tsx src/test/render.tsx
git commit -m "feat(store): add the Studium provider that saves every action" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Estimate picker, eggs and egg picker

**Files:**
- Create: `web/src/components/EstimatePicker.tsx`, `web/src/pets/eggs.ts`, `web/src/components/EggPicker.tsx`
- Test: `web/src/components/EstimatePicker.test.tsx`, `web/src/components/EggPicker.test.tsx`

**Interfaces:**
- Consumes: `ui/format.ts` (`ESTIMATE_CHOICES`, `formatMinutes`), `ui/styles.ts`, `planner/types.ts` (`PetKind`, `PET_KINDS`).
- Produces:
  - `EstimatePicker({ label: string; value: number; onChange: (min: number) => void })` — radios named like `"1 h"`, plus a number input labelled `` `${label} in minutes` ``.
  - `pets/eggs.ts`: `type EggPattern`, `type EggLook = { kind; shell; speckle; pattern; description }`, `EGGS: EggLook[]`, `shuffledEggs(random?: () => number): EggLook[]`.
  - `EggPicker({ value: PetKind | null; onChange: (kind: PetKind) => void; eggs?: EggLook[] })` — radios named `"Egg 1"`…`"Egg 5"`.

- [ ] **Step 1: Write the failing tests**

`web/src/components/EstimatePicker.test.tsx`:

```tsx
// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import "../test/render";
import EstimatePicker from "./EstimatePicker";

describe("EstimatePicker", () => {
  it("marks the current choice and reports a new one", async () => {
    const onChange = vi.fn();
    render(<EstimatePicker label="Estimate" value={60} onChange={onChange} />);
    expect(screen.getByRole("radio", { name: "1 h" }).getAttribute("aria-checked")).toBe("true");
    await userEvent.click(screen.getByRole("radio", { name: "2 h" }));
    expect(onChange).toHaveBeenCalledWith(120);
  });

  it("accepts a custom number of minutes", () => {
    const onChange = vi.fn();
    render(<EstimatePicker label="Estimate" value={60} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Estimate in minutes"), { target: { value: "45" } });
    expect(onChange).toHaveBeenCalledWith(45);
  });

  it("shows a custom value in the box", () => {
    render(<EstimatePicker label="Estimate" value={45} onChange={() => {}} />);
    expect((screen.getByLabelText("Estimate in minutes") as HTMLInputElement).value).toBe("45");
  });
});
```

`web/src/components/EggPicker.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { PET_KINDS, type PetKind } from "../planner/types";
import { EGGS, shuffledEggs } from "../pets/eggs";
import "../test/render";
import EggPicker from "./EggPicker";

describe("EggPicker", () => {
  it("shows a vague description for the chosen egg", async () => {
    const onChange = vi.fn();
    render(<EggPicker value={null} onChange={onChange} eggs={EGGS} />);
    const eggs = screen.getAllByRole("radio");
    expect(eggs).toHaveLength(5);
    await userEvent.click(eggs[0]);
    expect(onChange).toHaveBeenCalledWith(EGGS[0].kind);
    screen.getByText(EGGS[0].description);
  });

  it("moves between eggs with the arrow keys", async () => {
    function Harness() {
      const [value, setValue] = useState<PetKind | null>(null);
      return <EggPicker value={value} onChange={setValue} eggs={EGGS} />;
    }
    render(<Harness />);
    await userEvent.click(screen.getAllByRole("radio")[0]);
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getAllByRole("radio")[1].getAttribute("aria-checked")).toBe("true");
    screen.getByText(EGGS[1].description);
  });

  it("never names the animal", () => {
    render(<EggPicker value={null} onChange={() => {}} eggs={EGGS} />);
    const visible = (document.body.textContent ?? "").toLowerCase();
    const names = screen.getAllByRole("radio").map((egg) => (egg.getAttribute("aria-label") ?? "").toLowerCase());
    for (const kind of PET_KINDS) {
      expect(visible).not.toContain(kind);
      for (const name of names) expect(name).not.toContain(kind);
    }
    for (const egg of EGGS) for (const kind of PET_KINDS) expect(egg.description.toLowerCase()).not.toContain(kind);
  });

  it("shuffles into a different order without losing eggs", () => {
    const a = shuffledEggs(() => 0).map((e) => e.kind);
    const b = shuffledEggs(() => 0.999).map((e) => e.kind);
    expect([...a].sort()).toEqual([...PET_KINDS].sort());
    expect(a).not.toEqual(b);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/components/EstimatePicker.test.tsx src/components/EggPicker.test.tsx`
Expected: FAIL — `Cannot find module './EstimatePicker'` and `Cannot find module '../pets/eggs'`.

- [ ] **Step 3: Write `web/src/components/EstimatePicker.tsx`**

```tsx
import { ESTIMATE_CHOICES, formatMinutes } from "../ui/format";
import { LABEL } from "../ui/styles";

type Props = { label: string; value: number; onChange: (minutes: number) => void };

/** Quick time choices (15 min to 8 h) plus a box for any number of minutes. */
export default function EstimatePicker({ label, value, onChange }: Props) {
  const isPreset = ESTIMATE_CHOICES.includes(value);
  return (
    <fieldset>
      <legend className={LABEL}>{label}</legend>
      <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label={label}>
        {ESTIMATE_CHOICES.map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={value === m}
            onClick={() => onChange(m)}
            className={`px-2.5 py-1 text-xs border transition-colors ${
              value === m
                ? "bg-[var(--color-inverse)] text-[var(--color-inverse-foreground)] border-[var(--color-inverse)]"
                : "border-[var(--color-border)] hover:border-[var(--color-foreground)]"
            }`}
          >
            {formatMinutes(m)}
          </button>
        ))}
        <label className="flex items-center gap-1 text-xs text-[var(--color-muted-foreground)]">
          <input
            type="number"
            min={1}
            aria-label={`${label} in minutes`}
            placeholder="other"
            value={isPreset ? "" : value}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n) && n > 0) onChange(Math.round(n));
            }}
            className="w-16 border border-[var(--color-border)] px-2 py-1 text-xs focus:outline-none focus:border-[var(--color-foreground)]"
          />
          min
        </label>
      </div>
    </fieldset>
  );
}
```

- [ ] **Step 4: Write `web/src/pets/eggs.ts`**

```ts
// Placeholder eggs for the New Project form. Tints and patterns are chosen so they
// don't hint at the animal; descriptions are deliberately vague. Edit freely.
import type { PetKind } from "../planner/types";

export type EggPattern = "dots" | "stripes" | "zigzag" | "spots" | "stars";

export type EggLook = {
  kind: PetKind;
  shell: string;
  speckle: string;
  pattern: EggPattern;
  description: string;
};

export const EGGS: EggLook[] = [
  { kind: "cat", shell: "#e8defa", speckle: "#8b6fc0", pattern: "dots", description: "Something in here likes warm spots and long naps." },
  { kind: "dog", shell: "#d8ebf7", speckle: "#3f7ab0", pattern: "zigzag", description: "It's already wiggling. It can't wait to meet you." },
  { kind: "turtle", shell: "#fbe1cf", speckle: "#c46a3a", pattern: "spots", description: "Heavy and calm. In no hurry at all." },
  { kind: "frog", shell: "#f7efc4", speckle: "#b08a1e", pattern: "stripes", description: "Cool and a little damp. It twitched when you blinked." },
  {
    kind: "pigeon",
    shell: "#f6d6de",
    speckle: "#b0476a",
    pattern: "stars",
    description: "It keeps leaning toward the window, as if it wants to be up high.",
  },
];

/** A shuffled copy (Fisher–Yates), so an egg's position doesn't give it away. */
export function shuffledEggs(random: () => number = Math.random): EggLook[] {
  const eggs = [...EGGS];
  for (let i = eggs.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [eggs[i], eggs[j]] = [eggs[j], eggs[i]];
  }
  return eggs;
}
```

- [ ] **Step 5: Write `web/src/components/EggPicker.tsx`**

```tsx
import { useId, useRef, useState, type KeyboardEvent, type ReactElement } from "react";
import type { PetKind } from "../planner/types";
import { shuffledEggs, type EggLook, type EggPattern } from "../pets/eggs";

const EGG_PATH = "M30 3C15 3 4 27 4 45c0 16 12 28 26 28s26-12 26-28C56 27 45 3 30 3Z";

const PATTERNS: Record<EggPattern, ReactElement> = {
  dots: (
    <>
      {[[18, 24], [38, 20], [28, 40], [14, 52], [42, 50], [30, 62]].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="3" />
      ))}
    </>
  ),
  stripes: (
    <>
      {[30, 44, 58].map((y) => (
        <rect key={y} x="0" y={y} width="60" height="5" />
      ))}
    </>
  ),
  zigzag: <path d="M0 42l8-8 8 8 8-8 8 8 8-8 8 8 8-8" fill="none" strokeWidth="4" />,
  spots: (
    <>
      {[[20, 30, 6], [40, 44, 8], [24, 58, 5]].map(([x, y, r]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={r} />
      ))}
    </>
  ),
  stars: (
    <>
      {[[20, 28], [40, 40], [26, 56]].map(([x, y]) => (
        <path key={`${x}-${y}`} d={`M${x} ${y - 5}l1.5 3.5 3.5 1.5-3.5 1.5-1.5 3.5-1.5-3.5-3.5-1.5 3.5-1.5z`} />
      ))}
    </>
  ),
};

function EggSvg({ egg }: { egg: EggLook }) {
  const clipId = useId();
  return (
    <svg viewBox="0 0 60 76" className="w-12 h-16" aria-hidden="true">
      <defs>
        <clipPath id={clipId}>
          <path d={EGG_PATH} />
        </clipPath>
      </defs>
      <path d={EGG_PATH} fill={egg.shell} />
      <g clipPath={`url(#${clipId})`} fill={egg.speckle} stroke={egg.speckle}>
        {PATTERNS[egg.pattern]}
      </g>
      <path d={EGG_PATH} fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.5" />
    </svg>
  );
}

type Props = { value: PetKind | null; onChange: (kind: PetKind) => void; eggs?: EggLook[] };

/** Five mystery eggs. Highlighting one shows a vague hint about what's inside. */
export default function EggPicker({ value, onChange, eggs: given }: Props) {
  const [eggs] = useState(() => given ?? shuffledEggs());
  const [highlighted, setHighlighted] = useState<PetKind | null>(null);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const shown = eggs.find((e) => e.kind === (highlighted ?? value));

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (step === 0) return;
    e.preventDefault();
    const next = (index + step + eggs.length) % eggs.length;
    onChange(eggs[next].kind);
    buttons.current[next]?.focus();
  }

  return (
    <div>
      <div role="radiogroup" aria-label="Choose an egg" className="flex flex-wrap gap-2">
        {eggs.map((egg, i) => {
          const selected = value === egg.kind;
          return (
            <button
              key={egg.kind}
              ref={(el) => {
                buttons.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`Egg ${i + 1}`}
              tabIndex={selected || (value === null && i === 0) ? 0 : -1}
              onClick={() => onChange(egg.kind)}
              onKeyDown={(e) => onKeyDown(e, i)}
              onFocus={() => setHighlighted(egg.kind)}
              onBlur={() => setHighlighted(null)}
              onMouseEnter={() => setHighlighted(egg.kind)}
              onMouseLeave={() => setHighlighted(null)}
              className={`p-2 border-2 transition-colors text-[var(--color-foreground)] ${
                selected ? "border-[var(--color-accent)]" : "border-transparent hover:border-[var(--color-border)]"
              }`}
            >
              <EggSvg egg={egg} />
            </button>
          );
        })}
      </div>
      <p aria-live="polite" className="text-sm italic text-[var(--color-muted-foreground)] mt-2 min-h-[1.25rem]">
        {shown ? shown.description : "Pick an egg. Each one holds a different companion."}
      </p>
    </div>
  );
}
```

- [ ] **Step 6: Run tests and the build**

Run: `npx vitest run src/components/EstimatePicker.test.tsx src/components/EggPicker.test.tsx`
Expected: PASS (7 tests).
Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/components/EstimatePicker.tsx src/components/EstimatePicker.test.tsx src/pets src/components/EggPicker.tsx src/components/EggPicker.test.tsx
git commit -m "feat(ui): add estimate picker and mystery egg picker" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Task form and task row

**Files:**
- Create: `web/src/components/TaskForm.tsx`, `web/src/components/TaskRow.tsx`
- Test: `web/src/components/TaskForm.test.tsx`, `web/src/components/TaskRow.test.tsx`

**Interfaces:**
- Consumes: `planner/blocking.ts` (`blockerOptions`, `openBlockers`), `planner/suggest.ts` (`todayTaskIds`), `planner/tuning.ts` (`DEFAULT_ESTIMATE_MIN`), `EstimatePicker`, `useStudiumContext`, `ui/format.ts` (`formatMinutes`), `ui/styles.ts`, `test/render.tsx`.
- Produces:
  - `type TaskFormValues = { title: string; requirementId: string | null; estimateMin: number; blockedBy: string[] }`
  - `TaskForm({ requirements; projectTasks; taskId?; initial?; submitLabel; onSubmit; onCancel? })` — fields labelled `"Task title"`, `"Requirement"` (unlinked option value `""`), `EstimatePicker` with label `"Estimate"`, blocker checkboxes labelled by task title; error text `"Give the task a title."`.
  - `TaskRow({ taskId: string; onRequestComplete: (taskId: string) => void })` — returns `null` for a missing task. Checkbox button named `"Complete <title>"` / `"Reopen <title>"`; buttons `"+ Today"` / `"In today"` (aria-pressed), `"Pin <title>"` / `"Unpin <title>"`, `"Edit <title>"`, `"Delete <title>"`; unlinked tasks get a select labelled `"Link <title> to a requirement"`.

- [ ] **Step 1: Write the failing tests**

`web/src/components/TaskForm.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { makeRequirement, makeTask } from "../planner/testData";
import "../test/render";
import TaskForm from "./TaskForm";

const requirements = [makeRequirement({ id: "r1", title: "Rigging" }), makeRequirement({ id: "r2", title: "Render" })];
const projectTasks = [makeTask({ id: "A", title: "Rig" }), makeTask({ id: "B", title: "Paint", blockedBy: ["A"] })];

describe("TaskForm", () => {
  it("asks for a title", async () => {
    const onSubmit = vi.fn();
    render(<TaskForm requirements={requirements} projectTasks={projectTasks} submitLabel="Add task" onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole("button", { name: "Add task" }));
    expect(onSubmit).not.toHaveBeenCalled();
    screen.getByText("Give the task a title.");
  });

  it("submits title, requirement, estimate and blockers", async () => {
    const onSubmit = vi.fn();
    render(<TaskForm requirements={requirements} projectTasks={projectTasks} submitLabel="Add task" onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText("Task title"), "Weight paint");
    await userEvent.selectOptions(screen.getByLabelText("Requirement"), "r2");
    await userEvent.click(screen.getByRole("radio", { name: "2 h" }));
    await userEvent.click(screen.getByLabelText("Rig"));
    await userEvent.click(screen.getByRole("button", { name: "Add task" }));
    expect(onSubmit).toHaveBeenCalledWith({ title: "Weight paint", requirementId: "r2", estimateMin: 120, blockedBy: ["A"] });
  });

  it("can leave a task unlinked", async () => {
    const onSubmit = vi.fn();
    render(<TaskForm requirements={requirements} projectTasks={[]} submitLabel="Add task" onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText("Task title"), "Loose end");
    await userEvent.selectOptions(screen.getByLabelText("Requirement"), "");
    await userEvent.click(screen.getByRole("button", { name: "Add task" }));
    expect(onSubmit.mock.calls[0][0].requirementId).toBeNull();
  });

  it("doesn't offer blockers that would make a loop", () => {
    render(
      <TaskForm
        requirements={requirements}
        projectTasks={projectTasks}
        taskId="A"
        initial={{ title: "Rig", requirementId: "r1" }}
        submitLabel="Save task"
        onSubmit={() => {}}
      />,
    );
    expect(screen.queryByLabelText("Paint")).toBeNull();
  });
});
```

`web/src/components/TaskRow.test.tsx`:

```tsx
// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NOW } from "../planner/testData";
import { buildSeed } from "../store/seed";
import { renderWithStudium, savedData } from "../test/render";
import TaskRow from "./TaskRow";

const task = (storage: Storage | null, id: string) => savedData(storage).tasks.find((t) => t.id === id);

describe("TaskRow", () => {
  it("locks a blocked task and says what it's waiting on", () => {
    renderWithStudium(<TaskRow taskId="webDev-t8" onRequestComplete={vi.fn()} />);
    expect((screen.getByRole("checkbox", { name: "Complete Deploy to Vercel" }) as HTMLButtonElement).disabled).toBe(true);
    screen.getByText(/Waiting on: Contact form with validation/);
  });

  it("asks for the time before completing an open task", async () => {
    const onRequestComplete = vi.fn();
    renderWithStudium(<TaskRow taskId="webDev-t6" onRequestComplete={onRequestComplete} />);
    await userEvent.click(screen.getByRole("checkbox", { name: "Complete Record demo videos" }));
    expect(onRequestComplete).toHaveBeenCalledWith("webDev-t6");
  });

  it("reopens a done task", async () => {
    const { storage } = renderWithStudium(<TaskRow taskId="webDev-t3" onRequestComplete={vi.fn()} />);
    await userEvent.click(screen.getByRole("checkbox", { name: "Reopen Write case study #1" }));
    expect(task(storage, "webDev-t3")?.done).toBe(false);
    screen.getByRole("checkbox", { name: "Complete Write case study #1" });
  });

  it("adds to and removes from today", async () => {
    const { storage } = renderWithStudium(<TaskRow taskId="webDev-t6" onRequestComplete={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "+ Today" }));
    expect(savedData(storage).today.taskIds).toContain("webDev-t6");
    await userEvent.click(screen.getByRole("button", { name: "In today" }));
    expect(savedData(storage).today.taskIds).not.toContain("webDev-t6");
  });

  it("pins, edits and deletes", async () => {
    const { storage } = renderWithStudium(<TaskRow taskId="webDev-t6" onRequestComplete={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Pin Record demo videos" }));
    expect(task(storage, "webDev-t6")?.priority).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "Edit Record demo videos" }));
    await userEvent.clear(screen.getByLabelText("Task title"));
    await userEvent.type(screen.getByLabelText("Task title"), "Record demos");
    await userEvent.click(screen.getByRole("button", { name: "Save task" }));
    screen.getByText("Record demos");
    await userEvent.click(screen.getByRole("button", { name: "Delete Record demos" }));
    expect(task(storage, "webDev-t6")).toBeUndefined();
  });

  it("links an unlinked task to a requirement", async () => {
    const data = buildSeed(NOW);
    data.tasks = data.tasks.map((t) => (t.id === "webDev-t6" ? { ...t, requirementId: null } : t));
    const { storage } = renderWithStudium(<TaskRow taskId="webDev-t6" onRequestComplete={vi.fn()} />, { data });
    await userEvent.selectOptions(screen.getByLabelText("Link Record demo videos to a requirement"), "webDev-r2");
    expect(task(storage, "webDev-t6")?.requirementId).toBe("webDev-r2");
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/components/TaskForm.test.tsx src/components/TaskRow.test.tsx`
Expected: FAIL — `Cannot find module './TaskForm'` / `'./TaskRow'`.

- [ ] **Step 3: Write `web/src/components/TaskForm.tsx`**

```tsx
import { useState, type FormEvent } from "react";
import { blockerOptions } from "../planner/blocking";
import { DEFAULT_ESTIMATE_MIN } from "../planner/tuning";
import type { Requirement, Task } from "../planner/types";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, INPUT, LABEL } from "../ui/styles";
import EstimatePicker from "./EstimatePicker";

export type TaskFormValues = { title: string; requirementId: string | null; estimateMin: number; blockedBy: string[] };

type Props = {
  requirements: Requirement[];
  projectTasks: Task[];
  taskId?: string; // set when editing, so loop-creating blockers are hidden
  initial?: Partial<TaskFormValues>;
  submitLabel: string;
  onSubmit: (values: TaskFormValues) => void;
  onCancel?: () => void;
};

export default function TaskForm({ requirements, projectTasks, taskId, initial, submitLabel, onSubmit, onCancel }: Props) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [requirementId, setRequirementId] = useState<string | null>(
    initial?.requirementId !== undefined ? initial.requirementId : (requirements[0]?.id ?? null),
  );
  const [estimateMin, setEstimateMin] = useState(initial?.estimateMin ?? DEFAULT_ESTIMATE_MIN);
  const [blockedBy, setBlockedBy] = useState<string[]>(initial?.blockedBy ?? []);
  const [error, setError] = useState("");
  const options = taskId ? blockerOptions(taskId, projectTasks) : projectTasks;

  function toggleBlocker(id: string) {
    setBlockedBy((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Give the task a title.");
      return;
    }
    onSubmit({ title: title.trim(), requirementId, estimateMin, blockedBy });
  }

  return (
    <form onSubmit={submit} className="space-y-3 py-2">
      <div>
        <label className={LABEL} htmlFor={`${taskId ?? "new"}-title`}>
          Task
        </label>
        <input
          id={`${taskId ?? "new"}-title`}
          aria-label="Task title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs doing?"
          className={INPUT}
        />
        {error && <p className="text-xs text-[var(--color-accent)] mt-1">{error}</p>}
      </div>
      <div>
        <label className={LABEL} htmlFor={`${taskId ?? "new"}-req`}>
          Requirement
        </label>
        <select
          id={`${taskId ?? "new"}-req`}
          aria-label="Requirement"
          value={requirementId ?? ""}
          onChange={(e) => setRequirementId(e.target.value || null)}
          className={INPUT}
        >
          {requirements.map((r) => (
            <option key={r.id} value={r.id}>
              {r.title}
            </option>
          ))}
          <option value="">Unlinked (earns no tokens)</option>
        </select>
      </div>
      <EstimatePicker label="Estimate" value={estimateMin} onChange={setEstimateMin} />
      {options.length > 0 && (
        <fieldset>
          <legend className={LABEL}>Blocked by</legend>
          <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
            {options.map((t) => (
              <label key={t.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={blockedBy.includes(t.id)} onChange={() => toggleBlocker(t.id)} />
                {t.title}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <div className="flex gap-2">
        <button type="submit" className={BUTTON_PRIMARY}>
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className={BUTTON_SECONDARY}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Write `web/src/components/TaskRow.tsx`**

```tsx
import { useState } from "react";
import { openBlockers } from "../planner/blocking";
import { todayTaskIds } from "../planner/suggest";
import { useStudiumContext } from "../store/useStudium";
import { formatMinutes } from "../ui/format";
import { BUTTON_SMALL } from "../ui/styles";
import TaskForm from "./TaskForm";

type Props = { taskId: string; onRequestComplete: (taskId: string) => void };

export default function TaskRow({ taskId, onRequestComplete }: Props) {
  const s = useStudiumContext();
  const [editing, setEditing] = useState(false);
  const task = s.data.tasks.find((t) => t.id === taskId);
  if (!task) return null;

  const project = s.data.projects.find((p) => p.id === task.projectId);
  const projectTasks = s.data.tasks.filter((t) => t.projectId === task.projectId);
  const requirements = s.data.requirements.filter((r) => r.projectId === task.projectId);
  const inToday = todayTaskIds(s.data, s.now).includes(task.id);
  const blockers = task.done ? [] : openBlockers(task, projectTasks);
  const color = project?.color ?? "var(--color-foreground)";

  if (editing) {
    return (
      <TaskForm
        requirements={requirements}
        projectTasks={projectTasks}
        taskId={task.id}
        initial={task}
        submitLabel="Save task"
        onSubmit={(values) => {
          s.updateTask(task.id, values);
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="group flex items-start gap-3 py-1.5">
      <button
        type="button"
        role="checkbox"
        aria-checked={task.done}
        aria-label={task.done ? `Reopen ${task.title}` : `Complete ${task.title}`}
        disabled={blockers.length > 0}
        onClick={() => (task.done ? s.reopenTask(task.id) : onRequestComplete(task.id))}
        className="mt-0.5 w-4 h-4 flex-shrink-0 border rounded-sm flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ borderColor: task.done ? color : "var(--color-border)", backgroundColor: task.done ? color : "transparent" }}
      >
        {task.done && (
          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm leading-relaxed break-words ${
            task.done ? "line-through text-[var(--color-muted-foreground)]" : "text-[var(--color-foreground)]"
          }`}
        >
          {task.title}
        </p>
        <p className="text-xs text-[var(--color-muted-foreground)]">
          {formatMinutes(task.estimateMin)} estimate
          {task.done && task.actualMin !== null && ` · took ${formatMinutes(task.actualMin)}`}
          {blockers.length > 0 && (
            <span className="text-[var(--color-accent)]"> · Waiting on: {blockers.map((b) => b.title).join(", ")}</span>
          )}
        </p>
        {task.requirementId === null && requirements.length > 0 && (
          <select
            aria-label={`Link ${task.title} to a requirement`}
            value=""
            onChange={(e) => e.target.value && s.updateTask(task.id, { requirementId: e.target.value })}
            className="mt-1 text-xs border border-[var(--color-border)] px-2 py-1"
          >
            <option value="">Link to a requirement…</option>
            {requirements.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {!task.done && (
          <button
            type="button"
            aria-pressed={inToday}
            onClick={() => (inToday ? s.removeFromToday(task.id) : s.addToToday(task.id))}
            className={BUTTON_SMALL}
          >
            {inToday ? "In today" : "+ Today"}
          </button>
        )}
        <button
          type="button"
          aria-pressed={task.priority}
          aria-label={`${task.priority ? "Unpin" : "Pin"} ${task.title}`}
          title={task.priority ? "Pinned to the top of Suggested next" : "Pin to the top of Suggested next"}
          onClick={() => s.togglePriority(task.id)}
          className={`px-1 ${task.priority ? "text-[var(--color-accent)]" : "text-[var(--color-border)] hover:text-[var(--color-accent)]"}`}
        >
          <svg className="w-4 h-4" fill={task.priority ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M6 21V5.5A2.5 2.5 0 0 1 8.5 3H19l-2.5 4L19 11H8" />
          </svg>
        </button>
        <button type="button" aria-label={`Edit ${task.title}`} onClick={() => setEditing(true)} className={BUTTON_SMALL}>
          Edit
        </button>
        <button
          type="button"
          aria-label={`Delete ${task.title}`}
          onClick={() => s.deleteTask(task.id)}
          className="px-1 text-lg leading-none text-[var(--color-muted-foreground)] hover:text-[var(--color-accent)]"
        >
          ×
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run tests and the build**

Run: `npx vitest run src/components/TaskForm.test.tsx src/components/TaskRow.test.tsx`
Expected: PASS (10 tests).
Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/components/TaskForm.tsx src/components/TaskForm.test.tsx src/components/TaskRow.tsx src/components/TaskRow.test.tsx
git commit -m "feat(ui): add task form and task row" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Requirement form, card and section

**Files:**
- Create: `web/src/components/RequirementForm.tsx`, `web/src/components/RequirementCard.tsx`, `web/src/components/RequirementsSection.tsx`
- Test: `web/src/components/RequirementCard.test.tsx`

**Interfaces:**
- Consumes: `planner/learning.ts` (`estimateMultipliers`, `multiplierFor`), `planner/progress.ts` (`isRequirementDone`, `plannedProgress`, `requirementProgress`, `tasksOfRequirement`), `planner/mood.ts` (`requirementIdleDays`), `planner/tuning.ts` (`NEGLECT_DAYS`), `TaskForm`, `TaskRow`, `useStudiumContext`, `ui/format.ts` (`formatDate`, `percent`), `ui/styles.ts`.
- Produces:
  - `type RequirementFormValues = { title: string; weight: number; startDate: string | null; dueDate: string | null }`
  - `RequirementForm({ initial?; submitLabel; onSubmit; onCancel? })` — fields labelled `"Requirement title"`, `"Weight (1–10)"`, `"Start date"`, `"Due date"`; error `"Give the requirement a title."`.
  - `RequirementCard({ requirementId; onRequestComplete })` — `<article aria-label={title}>`, progressbar named `"<title> progress"`, buttons `"Edit <title>"`, `"Delete <title>"`, `"+ Add task"`; delete confirm buttons `"Move tasks to Unlinked"`, `"Delete tasks too"`, `"Cancel"`. Shows `"<n> days idle"` when neglected. Returns `null` for a missing requirement.
  - `RequirementsSection({ projectId; onRequestComplete })` — heading `"Requirements"`, button `"+ Add requirement"`, region `"Unlinked tasks"` when any exist.

- [ ] **Step 1: Write the failing test `web/src/components/RequirementCard.test.tsx`**

```tsx
// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithStudium, savedData } from "../test/render";
import RequirementCard from "./RequirementCard";

describe("RequirementCard", () => {
  it("shows weight, progress against plan and its tasks", () => {
    renderWithStudium(<RequirementCard requirementId="webDev-r2" onRequestComplete={vi.fn()} />);
    screen.getByText(/Weight 5/);
    screen.getByRole("progressbar", { name: "Case studies progress" });
    screen.getByText(/% done · plan \d+%/);
    screen.getByText("Write case study #3");
  });

  it("flags a neglected requirement", () => {
    renderWithStudium(<RequirementCard requirementId="Animation-r2" onRequestComplete={vi.fn()} />);
    screen.getByText("9 days idle");
  });

  it("adds a task to itself", async () => {
    const { storage } = renderWithStudium(<RequirementCard requirementId="webDev-r2" onRequestComplete={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "+ Add task" }));
    await userEvent.type(screen.getByLabelText("Task title"), "Write case study #4");
    await userEvent.click(screen.getByRole("button", { name: "Add task" }));
    const added = savedData(storage).tasks.find((t) => t.title === "Write case study #4");
    expect(added?.requirementId).toBe("webDev-r2");
    screen.getByText("Write case study #4");
  });

  it("edits the weight", async () => {
    renderWithStudium(<RequirementCard requirementId="webDev-r2" onRequestComplete={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Edit Case studies" }));
    await userEvent.clear(screen.getByLabelText("Weight (1–10)"));
    await userEvent.type(screen.getByLabelText("Weight (1–10)"), "8");
    await userEvent.click(screen.getByRole("button", { name: "Save requirement" }));
    screen.getByText(/Weight 8/);
  });

  it("moves its tasks to Unlinked when deleted that way", async () => {
    const { storage } = renderWithStudium(<RequirementCard requirementId="webDev-r2" onRequestComplete={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Delete Case studies" }));
    await userEvent.click(screen.getByRole("button", { name: "Move tasks to Unlinked" }));
    const saved = savedData(storage);
    expect(saved.requirements.some((r) => r.id === "webDev-r2")).toBe(false);
    expect(saved.tasks.filter((t) => ["webDev-t3", "webDev-t4", "webDev-t5", "webDev-t6"].includes(t.id)).every((t) => t.requirementId === null)).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/RequirementCard.test.tsx`
Expected: FAIL — `Cannot find module './RequirementCard'`.

- [ ] **Step 3: Write `web/src/components/RequirementForm.tsx`**

```tsx
import { useState, type FormEvent } from "react";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, INPUT, LABEL } from "../ui/styles";

export type RequirementFormValues = { title: string; weight: number; startDate: string | null; dueDate: string | null };

type Props = {
  initial?: Partial<RequirementFormValues>;
  submitLabel: string;
  onSubmit: (values: RequirementFormValues) => void;
  onCancel?: () => void;
};

export default function RequirementForm({ initial, submitLabel, onSubmit, onCancel }: Props) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [weight, setWeight] = useState(String(initial?.weight ?? 5));
  const [startDate, setStartDate] = useState(initial?.startDate ?? "");
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? "");
  const [error, setError] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Give the requirement a title.");
      return;
    }
    onSubmit({ title: title.trim(), weight: Number(weight), startDate: startDate || null, dueDate: dueDate || null });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className={LABEL}>
          Requirement
          <input aria-label="Requirement title" value={title} onChange={(e) => setTitle(e.target.value)} className={`${INPUT} mt-1 normal-case tracking-normal font-sans`} />
        </label>
        {error && <p className="text-xs text-[var(--color-accent)] mt-1">{error}</p>}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <label className={LABEL}>
          Weight
          <input
            aria-label="Weight (1–10)"
            type="number"
            min={1}
            max={10}
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className={`${INPUT} mt-1`}
          />
        </label>
        <label className={LABEL}>
          Start
          <input aria-label="Start date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={`${INPUT} mt-1`} />
        </label>
        <label className={LABEL}>
          Due
          <input aria-label="Due date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={`${INPUT} mt-1`} />
        </label>
      </div>
      <p className="text-xs text-[var(--color-muted-foreground)]">
        Weight decides what this requirement is worth compared with the others. Start and due dates set the plan; leave them
        empty to use today and the project deadline.
      </p>
      <div className="flex gap-2">
        <button type="submit" className={BUTTON_PRIMARY}>
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className={BUTTON_SECONDARY}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Write `web/src/components/RequirementCard.tsx`**

```tsx
import { useState } from "react";
import { estimateMultipliers, multiplierFor } from "../planner/learning";
import { requirementIdleDays } from "../planner/mood";
import { isRequirementDone, plannedProgress, requirementProgress, tasksOfRequirement } from "../planner/progress";
import { NEGLECT_DAYS } from "../planner/tuning";
import { useStudiumContext } from "../store/useStudium";
import { formatDate, percent } from "../ui/format";
import { BUTTON_SECONDARY, BUTTON_SMALL, CARD } from "../ui/styles";
import RequirementForm from "./RequirementForm";
import TaskForm from "./TaskForm";
import TaskRow from "./TaskRow";

type Props = { requirementId: string; onRequestComplete: (taskId: string) => void };
type Mode = "view" | "edit" | "confirmDelete" | "addTask";

export default function RequirementCard({ requirementId, onRequestComplete }: Props) {
  const s = useStudiumContext();
  const [mode, setMode] = useState<Mode>("view");
  const requirement = s.data.requirements.find((r) => r.id === requirementId);
  const project = requirement ? s.data.projects.find((p) => p.id === requirement.projectId) : undefined;
  if (!requirement || !project) return null;

  const projectTasks = s.data.tasks.filter((t) => t.projectId === project.id);
  const requirements = s.data.requirements.filter((r) => r.projectId === project.id);
  const tasks = [...tasksOfRequirement(requirement.id, projectTasks)].sort(
    (a, b) => Number(a.done) - Number(b.done) || Number(b.priority) - Number(a.priority),
  );
  const multiplier = multiplierFor(estimateMultipliers(s.data), project.id);
  const progress = requirementProgress(requirement.id, s.data.tasks, multiplier);
  const planned = plannedProgress(requirement, project, s.now);
  const done = isRequirementDone(requirement.id, s.data.tasks);
  const idle = requirementIdleDays(requirement, s.data, s.now);
  const neglected = !done && planned > 0 && idle >= NEGLECT_DAYS;
  const dates = `${requirement.startDate ? `${formatDate(requirement.startDate)} – ` : ""}Due ${formatDate(requirement.dueDate ?? project.deadline)}`;

  return (
    <article aria-label={requirement.title} className={`${CARD} p-5 space-y-3`}>
      {mode === "edit" ? (
        <RequirementForm
          initial={requirement}
          submitLabel="Save requirement"
          onSubmit={(values) => {
            s.updateRequirement(requirement.id, values);
            setMode("view");
          }}
          onCancel={() => setMode("view")}
        />
      ) : (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-semibold text-[var(--color-foreground)] break-words">{requirement.title}</h3>
            <p className="text-xs font-mono text-[var(--color-muted-foreground)] mt-0.5">
              Weight {requirement.weight} · {dates}
            </p>
          </div>
          <div className="flex gap-1 flex-shrink-0">
            <button type="button" aria-label={`Edit ${requirement.title}`} onClick={() => setMode("edit")} className={BUTTON_SMALL}>
              Edit
            </button>
            <button type="button" aria-label={`Delete ${requirement.title}`} onClick={() => setMode("confirmDelete")} className={BUTTON_SMALL}>
              Delete
            </button>
          </div>
        </div>
      )}

      <div>
        <div
          className="relative h-2 bg-[var(--color-muted)]"
          role="progressbar"
          aria-label={`${requirement.title} progress`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent(progress)}
        >
          <div className="h-full transition-all duration-500" style={{ width: `${percent(progress)}%`, backgroundColor: project.color }} />
          <div
            className="absolute -top-1 h-4 w-0.5 bg-[var(--color-foreground)]"
            style={{ left: `${percent(planned)}%` }}
            title={`Planned by today: ${percent(planned)}%`}
            aria-hidden="true"
          />
        </div>
        <p className="text-xs mt-1 flex justify-between gap-2 text-[var(--color-muted-foreground)]">
          <span>
            {percent(progress)}% done · plan {percent(planned)}%
          </span>
          {neglected && <span className="text-[var(--color-accent)] font-medium">{idle} days idle</span>}
          {done && <span>Finished</span>}
        </p>
      </div>

      {mode === "confirmDelete" && (
        <div role="alert" className="border border-[var(--color-accent)] p-3 space-y-2 text-sm">
          <p>
            Delete “{requirement.title}”? What should happen to its {tasks.length} {tasks.length === 1 ? "task" : "tasks"}?
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => s.deleteRequirement(requirement.id, "unlinkTasks")} className={BUTTON_SECONDARY}>
              Move tasks to Unlinked
            </button>
            <button type="button" onClick={() => s.deleteRequirement(requirement.id, "deleteTasks")} className={BUTTON_SECONDARY}>
              Delete tasks too
            </button>
            <button type="button" onClick={() => setMode("view")} className={BUTTON_SECONDARY}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div>
        {tasks.length === 0 ? (
          <p className="text-sm italic text-[var(--color-muted-foreground)]">No tasks yet.</p>
        ) : (
          tasks.map((t) => <TaskRow key={t.id} taskId={t.id} onRequestComplete={onRequestComplete} />)
        )}
      </div>

      {mode === "addTask" ? (
        <TaskForm
          requirements={requirements}
          projectTasks={projectTasks}
          initial={{ requirementId: requirement.id }}
          submitLabel="Add task"
          onSubmit={(values) => {
            s.createTask({ projectId: project.id, ...values });
            setMode("view");
          }}
          onCancel={() => setMode("view")}
        />
      ) : (
        <button type="button" onClick={() => setMode("addTask")} className={BUTTON_SMALL}>
          + Add task
        </button>
      )}
    </article>
  );
}
```

- [ ] **Step 5: Write `web/src/components/RequirementsSection.tsx`**

```tsx
import { useState } from "react";
import { useStudiumContext } from "../store/useStudium";
import { BUTTON_SMALL, CARD, SERIF } from "../ui/styles";
import RequirementCard from "./RequirementCard";
import RequirementForm from "./RequirementForm";
import TaskRow from "./TaskRow";

type Props = { projectId: string; onRequestComplete: (taskId: string) => void };

export default function RequirementsSection({ projectId, onRequestComplete }: Props) {
  const s = useStudiumContext();
  const [adding, setAdding] = useState(false);
  const requirements = s.data.requirements.filter((r) => r.projectId === projectId);
  const unlinked = s.data.tasks.filter((t) => t.projectId === projectId && t.requirementId === null);

  return (
    <section aria-labelledby="requirements-heading" className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <h2 id="requirements-heading" style={SERIF} className="text-2xl">
          Requirements
        </h2>
        {!adding && (
          <button type="button" onClick={() => setAdding(true)} className={BUTTON_SMALL}>
            + Add requirement
          </button>
        )}
      </div>
      {adding && (
        <div className={`${CARD} p-5`}>
          <RequirementForm
            submitLabel="Add requirement"
            onSubmit={(values) => {
              s.createRequirement({ projectId, ...values });
              setAdding(false);
            }}
            onCancel={() => setAdding(false)}
          />
        </div>
      )}
      {requirements.length === 0 && !adding && (
        <p className="text-sm italic text-[var(--color-muted-foreground)]">
          No requirements yet. Add one first: every task belongs to a requirement, and its weight decides what the tasks
          are worth.
        </p>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {requirements.map((r) => (
          <RequirementCard key={r.id} requirementId={r.id} onRequestComplete={onRequestComplete} />
        ))}
      </div>
      {unlinked.length > 0 && (
        <section aria-label="Unlinked tasks" className={`${CARD} p-5 border-dashed`}>
          <h3 className="font-semibold">Unlinked</h3>
          <p className="text-xs text-[var(--color-muted-foreground)] mb-2">
            These tasks earn nothing until you link them to a requirement.
          </p>
          {unlinked.map((t) => (
            <TaskRow key={t.id} taskId={t.id} onRequestComplete={onRequestComplete} />
          ))}
        </section>
      )}
    </section>
  );
}
```

- [ ] **Step 6: Run tests and the build**

Run: `npx vitest run src/components/RequirementCard.test.tsx`
Expected: PASS (5 tests).
Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/components/RequirementForm.tsx src/components/RequirementCard.tsx src/components/RequirementCard.test.tsx src/components/RequirementsSection.tsx
git commit -m "feat(ui): add requirement cards with progress against plan" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Completion prompt and toast

**Files:**
- Create: `web/src/components/CompletionPrompt.tsx`, `web/src/components/Toast.tsx`
- Test: `web/src/components/CompletionPrompt.test.tsx`, `web/src/components/Toast.test.tsx`

**Interfaces:**
- Consumes: `EstimatePicker`, `useStudiumContext`, `ui/format.ts` (`formatMinutes`, `payoutMessage`), `ui/styles.ts`.
- Produces:
  - `CompletionPrompt({ taskId: string; onClose: () => void; onDone: (message: string) => void })` — dialog named `About how long did "<title>" take?`; buttons `"Save and complete"`, `"Skip"`, `"Cancel"`; Escape closes. Returns `null` for a missing task.
  - `Toast({ message: string | null; onDismiss: () => void; timeoutMs?: number })` — `role="status"`, button `"Dismiss"`; `TOAST_MS = 6000`.

- [ ] **Step 1: Write the failing tests**

`web/src/components/CompletionPrompt.test.tsx`:

```tsx
// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithStudium, savedData } from "../test/render";
import CompletionPrompt from "./CompletionPrompt";

const find = (storage: Storage | null) => savedData(storage).tasks.find((t) => t.id === "webDev-t5");

describe("CompletionPrompt", () => {
  it("completes with the chosen time and reports the tokens", async () => {
    const onDone = vi.fn();
    const onClose = vi.fn();
    const { storage } = renderWithStudium(<CompletionPrompt taskId="webDev-t5" onClose={onClose} onDone={onDone} />);
    screen.getByRole("dialog", { name: 'About how long did "Write case study #3" take?' });
    expect(screen.getByRole("radio", { name: "3 h" }).getAttribute("aria-checked")).toBe("true");
    await userEvent.click(screen.getByRole("radio", { name: "4 h" }));
    await userEvent.click(screen.getByRole("button", { name: "Save and complete" }));
    expect(find(storage)).toMatchObject({ done: true, actualMin: 240 });
    expect(onDone.mock.calls[0][0]).toMatch(/^\+\d+ tokens/);
    expect(onClose).toHaveBeenCalled();
  });

  it("can skip the time", async () => {
    const { storage } = renderWithStudium(<CompletionPrompt taskId="webDev-t5" onClose={vi.fn()} onDone={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(find(storage)).toMatchObject({ done: true, actualMin: null });
  });

  it("cancels without completing, also with Escape", async () => {
    const onClose = vi.fn();
    const { storage } = renderWithStudium(<CompletionPrompt taskId="webDev-t5" onClose={onClose} onDone={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(find(storage)?.done).toBe(false);
  });
});
```

`web/src/components/Toast.test.tsx`:

```tsx
// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../test/render";
import Toast from "./Toast";

afterEach(() => vi.useRealTimers());

describe("Toast", () => {
  it("shows a message and can be dismissed", async () => {
    const onDismiss = vi.fn();
    render(<Toast message="+29 tokens" onDismiss={onDismiss} />);
    expect(screen.getByRole("status").textContent).toContain("+29 tokens");
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onDismiss).toHaveBeenCalled();
  });

  it("dismisses itself after a while", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<Toast message="Saved" onDismiss={onDismiss} timeoutMs={1000} />);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onDismiss).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/components/CompletionPrompt.test.tsx src/components/Toast.test.tsx`
Expected: FAIL — `Cannot find module './CompletionPrompt'` / `'./Toast'`.

- [ ] **Step 3: Write `web/src/components/CompletionPrompt.tsx`**

```tsx
import { useEffect, useState } from "react";
import { useStudiumContext } from "../store/useStudium";
import { formatMinutes, payoutMessage } from "../ui/format";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, CARD, SERIF } from "../ui/styles";
import EstimatePicker from "./EstimatePicker";

type Props = { taskId: string; onClose: () => void; onDone: (message: string) => void };

/** Asks roughly how long a task took, then completes it and reports the tokens. */
export default function CompletionPrompt({ taskId, onClose, onDone }: Props) {
  const s = useStudiumContext();
  const task = s.data.tasks.find((t) => t.id === taskId);
  const [minutes, setMinutes] = useState(task?.estimateMin ?? 60);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!task) return null;

  function finish(actualMin: number | null) {
    if (!task) return;
    const payout = s.completeTask(task.id, actualMin);
    onDone(payout ? payoutMessage(payout, task) : "That task can't be completed yet.");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-overlay)]">
      <div role="dialog" aria-modal="true" aria-labelledby="complete-title" className={`${CARD} w-full max-w-md mx-4 p-6 space-y-4`}>
        <h2 id="complete-title" style={SERIF} className="text-xl">
          About how long did "{task.title}" take?
        </h2>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          You estimated {formatMinutes(task.estimateMin)}. A rough answer is fine; it helps Studium learn your pace.
        </p>
        <EstimatePicker label="Time taken" value={minutes} onChange={setMinutes} />
        <div className="flex flex-wrap gap-2 pt-2">
          {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
          <button type="button" autoFocus onClick={() => finish(minutes)} className={BUTTON_PRIMARY}>
            Save and complete
          </button>
          <button type="button" onClick={() => finish(null)} className={BUTTON_SECONDARY}>
            Skip
          </button>
          <button type="button" onClick={onClose} className={BUTTON_SECONDARY}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Write `web/src/components/Toast.tsx`**

```tsx
import { useEffect } from "react";

export const TOAST_MS = 6000;

type Props = { message: string | null; onDismiss: () => void; timeoutMs?: number };

export default function Toast({ message, onDismiss, timeoutMs = TOAST_MS }: Props) {
  useEffect(() => {
    if (!message) return;
    const id = setTimeout(onDismiss, timeoutMs);
    return () => clearTimeout(id);
  }, [message, onDismiss, timeoutMs]);

  return (
    <div role="status" aria-live="polite" className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 w-full max-w-md">
      {message && (
        <div className="flex items-start gap-3 bg-[var(--color-inverse)] text-[var(--color-inverse-foreground)] px-4 py-3 shadow-lg">
          <span className="flex-1 text-sm">{message}</span>
          <button type="button" aria-label="Dismiss" onClick={onDismiss} className="text-white/60 hover:text-white">
            ×
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Run tests and the build**

Run: `npx vitest run src/components/CompletionPrompt.test.tsx src/components/Toast.test.tsx`
Expected: PASS (5 tests).
Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/components/CompletionPrompt.tsx src/components/CompletionPrompt.test.tsx src/components/Toast.tsx src/components/Toast.test.tsx
git commit -m "feat(ui): ask for actual time when completing and report tokens" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Habitat

**Files:**
- Create: `web/src/components/Habitat.tsx`
- Test: `web/src/components/Habitat.test.tsx`

**Interfaces:**
- Consumes: `ui/derive.ts` (`summarizeProject`), `planner/history.ts` (`inventory`), `planner/tuning.ts` (`MEDICINE_PRODUCT_ID`), `ui/format.ts` (`MOOD_COLORS`, `accuracyLabel`, `attentionLabel`, `gapLabel`), `ui/styles.ts`, `useStudiumContext`.
- Produces: `HABITAT_FALLBACK_MS = 1000`; `Habitat({ projectId: string; justHatched: boolean; onOpenShop: () => void })` — section named `"<shortName> habitat"`; box `data-pet-habitat={projectId}`; fallback `<img alt="<shortName>'s <petKind>">`; buttons `"Give medicine (<n> left)"` or `"Buy medicine in the Shop"`; hatch text `"It hatched: a <petKind>!"`.

- [ ] **Step 1: Write the failing test `web/src/components/Habitat.test.tsx`**

```tsx
// @vitest-environment jsdom
import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NOW } from "../planner/testData";
import { buildSeed } from "../store/seed";
import { renderWithStudium } from "../test/render";
import Habitat, { HABITAT_FALLBACK_MS } from "./Habitat";

afterEach(() => vi.useRealTimers());

describe("Habitat", () => {
  it("marks the box for the extension and shows a still picture if no pet arrives", () => {
    vi.useFakeTimers();
    renderWithStudium(<Habitat projectId="webDev" justHatched={false} onOpenShop={vi.fn()} />);
    expect(document.querySelector('[data-pet-habitat="webDev"]')).not.toBeNull();
    expect(screen.queryByRole("img")).toBeNull();
    act(() => {
      vi.advanceTimersByTime(HABITAT_FALLBACK_MS);
    });
    screen.getByRole("img", { name: "webDev's pigeon" });
  });

  it("shows no still picture when the extension attaches a pet", () => {
    vi.useFakeTimers();
    renderWithStudium(<Habitat projectId="webDev" justHatched={false} onOpenShop={vi.fn()} />);
    document.querySelector('[data-pet-habitat="webDev"]')?.setAttribute("data-pet-attached", "");
    act(() => {
      vi.advanceTimersByTime(HABITAT_FALLBACK_MS);
    });
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("shows mood, plan gap, attention and estimate accuracy", () => {
    renderWithStudium(<Habitat projectId="seniorCap" justHatched={false} onOpenShop={vi.fn()} />);
    expect(screen.getAllByText("Sick").length).toBeGreaterThan(0);
    screen.getByText(/points? behind plan|On plan/);
    screen.getByText("Prototype v1: 16 days idle");
    screen.getByText(/Your seniorCap tasks take about/);
  });

  it("hides estimate accuracy until there are enough timed tasks", () => {
    const data = buildSeed(NOW);
    data.tasks = data.tasks.map((t) => (t.projectId === "webDev" ? { ...t, actualMin: null } : t));
    renderWithStudium(<Habitat projectId="webDev" justHatched={false} onOpenShop={vi.fn()} />, { data });
    screen.getByText(/Finish a few tasks with a time/);
  });

  it("sends you to the shop when a sick pet needs medicine you don't have", async () => {
    const onOpenShop = vi.fn();
    renderWithStudium(<Habitat projectId="seniorCap" justHatched={false} onOpenShop={onOpenShop} />);
    await userEvent.click(screen.getByRole("button", { name: "Buy medicine in the Shop" }));
    expect(onOpenShop).toHaveBeenCalled();
  });

  it("gives medicine and starts recovery", async () => {
    const data = buildSeed(NOW);
    data.events.push({ type: "purchase", at: NOW.toISOString(), productId: "medicine", price: 80 });
    renderWithStudium(<Habitat projectId="seniorCap" justHatched={false} onOpenShop={vi.fn()} />, { data });
    await userEvent.click(screen.getByRole("button", { name: "Give medicine (1 left)" }));
    expect(screen.queryByText("Sick")).toBeNull();
    screen.getByText(/Recovering/);
  });

  it("celebrates a fresh hatch", () => {
    renderWithStudium(<Habitat projectId="petExt" justHatched onOpenShop={vi.fn()} />);
    screen.getByText("It hatched: a turtle!");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/Habitat.test.tsx`
Expected: FAIL — `Cannot find module './Habitat'`.

- [ ] **Step 3: Write `web/src/components/Habitat.tsx`**

```tsx
import { useEffect, useRef, useState } from "react";
import { inventory } from "../planner/history";
import { MEDICINE_PRODUCT_ID } from "../planner/tuning";
import { useStudiumContext } from "../store/useStudium";
import { summarizeProject } from "../ui/derive";
import { MOOD_COLORS, accuracyLabel, attentionLabel, gapLabel } from "../ui/format";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, CARD, LABEL, SERIF } from "../ui/styles";

/** How long to wait for the extension to put a pet in the box before showing a still picture. */
export const HABITAT_FALLBACK_MS = 1000;

type Props = { projectId: string; justHatched: boolean; onOpenShop: () => void };

export default function Habitat({ projectId, justHatched, onOpenShop }: Props) {
  const s = useStudiumContext();
  const boxRef = useRef<HTMLDivElement>(null);
  const [showStill, setShowStill] = useState(false);

  // The extension (Plan 3) finds this box, puts the project's pet in it and sets data-pet-attached.
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    setShowStill(false);
    const timer = setTimeout(() => setShowStill(!box.hasAttribute("data-pet-attached")), HABITAT_FALLBACK_MS);
    const observer = new MutationObserver(() => {
      if (box.hasAttribute("data-pet-attached")) setShowStill(false);
    });
    observer.observe(box, { attributes: true, attributeFilter: ["data-pet-attached"] });
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [projectId]);

  const project = s.data.projects.find((p) => p.id === projectId);
  if (!project) return null;
  const summary = summarizeProject(project, s.data, s.now);
  const medicine = inventory(s.data.events)[MEDICINE_PRODUCT_ID] ?? 0;
  const accuracy = accuracyLabel(project.shortName, summary.multiplier, summary.samples);
  const sick = summary.mood === "Sick";

  return (
    <section aria-label={`${project.shortName} habitat`} className={CARD}>
      <div className="flex items-center justify-between gap-4 border-b border-[var(--color-border)] px-6 py-3">
        <div>
          <p className={LABEL}>Project Companion</p>
          <h2 style={SERIF} className="text-xl">
            Habitat
          </h2>
        </div>
        <span className="text-xs font-mono uppercase tracking-widest" style={{ color: MOOD_COLORS[summary.mood] }}>
          {summary.mood}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_20rem]">
        <div ref={boxRef} data-pet-habitat={project.id} className="relative h-56 overflow-hidden bg-[var(--color-muted)]">
          <div className="absolute inset-x-0 bottom-0 h-10 border-t border-[var(--color-border)] bg-[var(--color-card)]" />
          {justHatched && (
            <p className="absolute top-3 inset-x-0 text-center text-sm font-semibold" style={{ color: project.color }}>
              It hatched: a {project.petKind}!
            </p>
          )}
          {showStill && (
            <img
              src={`${import.meta.env.BASE_URL}pets/${project.petKind}.png`}
              alt={`${project.shortName}'s ${project.petKind}`}
              className="absolute bottom-6 left-1/2 -translate-x-1/2 h-24"
              style={{ filter: `drop-shadow(0 0 2px ${project.color})${sick ? " saturate(0.5) hue-rotate(40deg)" : ""}` }}
            />
          )}
        </div>

        <div className="border-t sm:border-t-0 sm:border-l border-[var(--color-border)] p-5 space-y-4 text-sm">
          <div>
            <p className={LABEL}>Mood</p>
            <p>
              <span className="font-semibold" style={{ color: MOOD_COLORS[summary.mood] }}>
                {summary.mood}
              </span>{" "}
              · {gapLabel(summary.gap)}
            </p>
            {summary.health.recovering && (
              <p className="text-xs text-[var(--color-muted-foreground)] mt-1">
                Recovering: mood stays at Worried or below until the neglected requirements move again.
              </p>
            )}
          </div>
          <div>
            <p className={LABEL}>Attention</p>
            <p className={summary.neglected.length > 0 ? "text-[var(--color-accent)]" : ""}>{attentionLabel(summary.neglected)}</p>
          </div>
          <div>
            <p className={LABEL}>Estimate accuracy</p>
            <p>{accuracy ?? "Finish a few tasks with a time to see how your estimates compare."}</p>
          </div>
          {sick &&
            (medicine > 0 ? (
              <button type="button" onClick={() => s.giveMedicine(project.id)} className={BUTTON_PRIMARY}>
                Give medicine ({medicine} left)
              </button>
            ) : (
              <button type="button" onClick={onOpenShop} className={BUTTON_SECONDARY}>
                Buy medicine in the Shop
              </button>
            ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run tests and the build**

Run: `npx vitest run src/components/Habitat.test.tsx`
Expected: PASS (7 tests).
Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/components/Habitat.tsx src/components/Habitat.test.tsx
git commit -m "feat(ui): add habitat with mood, attention, accuracy and medicine" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Project page

**Files:**
- Create: `web/src/components/ProjectDetail.tsx`
- Test: `web/src/components/ProjectDetail.test.tsx`

**Interfaces:**
- Consumes: `RequirementsSection`, `Habitat`, `ui/derive.ts` (`summarizeProject`), `ui/format.ts` (`daysUntil`, `deadlineLabel`, `formatDate`, `gapLabel`, `percent`), `ui/styles.ts`, `useStudiumContext`, `store/actions.ts` (`createProject`, test).
- Produces: `ProjectDetail({ projectId; justHatched; onRequestComplete; onEditProject; onOpenShop })` — heading = project name, button `"Edit project"`, progressbar `"Overall progress"`. Returns `null` for a missing project.

- [ ] **Step 1: Write the failing test `web/src/components/ProjectDetail.test.tsx`**

```tsx
// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NOW, dayKey } from "../planner/testData";
import { createProject } from "../store/actions";
import { buildSeed } from "../store/seed";
import { renderWithStudium, savedData } from "../test/render";
import ProjectDetail from "./ProjectDetail";

const props = { justHatched: false, onRequestComplete: vi.fn(), onEditProject: vi.fn(), onOpenShop: vi.fn() };

describe("ProjectDetail", () => {
  it("shows the project, its requirements and its habitat", () => {
    renderWithStudium(<ProjectDetail projectId="webDev" {...props} />);
    screen.getByRole("heading", { name: "Web Development Portfolio" });
    screen.getByRole("progressbar", { name: "Overall progress" });
    screen.getByRole("article", { name: "Case studies" });
    screen.getByRole("region", { name: "webDev habitat" });
  });

  it("adds a requirement", async () => {
    const { storage } = renderWithStudium(<ProjectDetail projectId="webDev" {...props} />);
    await userEvent.click(screen.getByRole("button", { name: "+ Add requirement" }));
    await userEvent.type(screen.getByLabelText("Requirement title"), "Blog");
    await userEvent.click(screen.getByRole("button", { name: "Add requirement" }));
    screen.getByRole("article", { name: "Blog" });
    expect(savedData(storage).requirements.some((r) => r.title === "Blog" && r.projectId === "webDev")).toBe(true);
  });

  it("shows the Unlinked group after unlinking a requirement's tasks", async () => {
    renderWithStudium(<ProjectDetail projectId="webDev" {...props} />);
    await userEvent.click(screen.getByRole("button", { name: "Delete Case studies" }));
    await userEvent.click(screen.getByRole("button", { name: "Move tasks to Unlinked" }));
    screen.getByRole("region", { name: "Unlinked tasks" });
  });

  it("explains what to do in an empty project", () => {
    const { data } = createProject(
      buildSeed(NOW),
      { name: "Blank", shortName: "blank", color: "#2d3a8c", deadline: dayKey(30), description: "", petKind: "cat" },
      NOW,
    );
    const id = data.projects[data.projects.length - 1].id;
    renderWithStudium(<ProjectDetail projectId={id} {...props} />, { data });
    screen.getByText(/No requirements yet/);
  });

  it("opens the project editor", async () => {
    const onEditProject = vi.fn();
    renderWithStudium(<ProjectDetail projectId="webDev" {...props} onEditProject={onEditProject} />);
    await userEvent.click(screen.getByRole("button", { name: "Edit project" }));
    expect(onEditProject).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/ProjectDetail.test.tsx`
Expected: FAIL — `Cannot find module './ProjectDetail'`.

- [ ] **Step 3: Write `web/src/components/ProjectDetail.tsx`**

```tsx
import { useStudiumContext } from "../store/useStudium";
import { summarizeProject } from "../ui/derive";
import { daysUntil, deadlineLabel, formatDate, gapLabel, percent } from "../ui/format";
import { BUTTON_SMALL, LABEL, SERIF } from "../ui/styles";
import Habitat from "./Habitat";
import RequirementsSection from "./RequirementsSection";

type Props = {
  projectId: string;
  justHatched: boolean;
  onRequestComplete: (taskId: string) => void;
  onEditProject: () => void;
  onOpenShop: () => void;
};

export default function ProjectDetail({ projectId, justHatched, onRequestComplete, onEditProject, onOpenShop }: Props) {
  const s = useStudiumContext();
  const project = s.data.projects.find((p) => p.id === projectId);
  if (!project) return null;
  const summary = summarizeProject(project, s.data, s.now);
  const soon = daysUntil(project.deadline, s.now) < 30;

  return (
    <div className="space-y-8">
      <div className="border-l-4 pl-5" style={{ borderColor: project.color }}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className={LABEL}>{project.shortName}</p>
            <h1 style={SERIF} className="text-3xl text-[var(--color-foreground)] break-words">
              {project.name}
            </h1>
            {project.description && <p className="text-[var(--color-muted-foreground)] text-sm mt-1 max-w-xl">{project.description}</p>}
            <button type="button" onClick={onEditProject} className={`${BUTTON_SMALL} mt-3`}>
              Edit project
            </button>
          </div>
          <div className="text-right flex-shrink-0">
            <p className={LABEL}>Deadline</p>
            <p style={SERIF} className="text-2xl">
              {formatDate(project.deadline)}
            </p>
            <p className={`text-xs font-mono mt-0.5 ${soon ? "text-[var(--color-accent)]" : "text-[var(--color-muted-foreground)]"}`}>
              {deadlineLabel(project.deadline, s.now)}
            </p>
          </div>
        </div>
        <div className="mt-5">
          <div className="flex justify-between items-baseline mb-2">
            <span className={LABEL}>Overall Progress</span>
            <span className="font-mono text-sm font-medium">{percent(summary.progress)}%</span>
          </div>
          <div
            className="h-2.5 bg-[var(--color-muted)] overflow-hidden"
            role="progressbar"
            aria-label="Overall progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent(summary.progress)}
          >
            <div className="h-full transition-all duration-500" style={{ width: `${percent(summary.progress)}%`, backgroundColor: project.color }} />
          </div>
          <p className="text-xs text-[var(--color-muted-foreground)] mt-1">
            {summary.tasksDone} of {summary.tasksTotal} tasks complete · {gapLabel(summary.gap)}
          </p>
        </div>
      </div>

      <RequirementsSection projectId={project.id} onRequestComplete={onRequestComplete} />
      <Habitat projectId={project.id} justHatched={justHatched} onOpenShop={onOpenShop} />
    </div>
  );
}
```

- [ ] **Step 4: Run tests and the build**

Run: `npx vitest run src/components/ProjectDetail.test.tsx`
Expected: PASS (5 tests).
Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/components/ProjectDetail.tsx src/components/ProjectDetail.test.tsx
git commit -m "feat(ui): add the project page" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Overview with Priority Focus

**Files:**
- Create: `web/src/components/Overview.tsx`
- Test: `web/src/components/Overview.test.tsx`

**Interfaces:**
- Consumes: `ui/derive.ts` (`summarizeAll`), `planner/suggest.ts` (`suggestNext`, `todayTaskIds`), `planner/blocking.ts` (`isBlocked`), `ui/format.ts` (`MOOD_COLORS`, `daysUntil`, `deadlineLabel`, `formatDate`, `gapLabel`, `percent`), `ui/styles.ts`, `useStudiumContext`.
- Produces: `Overview({ onSelect: (projectId: string) => void; onRequestComplete: (taskId: string) => void })` — heading `"Your Projects"`, regions `"Today"` and `"Suggested next"`; Today items have checkbox `"Complete <title>"` / `"Reopen <title>"` and button `"Remove <title> from today"`; suggestions have button `"Add <title> to today"`; project cards are buttons whose name includes the project name and mood.

- [ ] **Step 1: Write the failing test `web/src/components/Overview.test.tsx`**

```tsx
// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithStudium, savedData } from "../test/render";
import Overview from "./Overview";

describe("Overview", () => {
  it("shows today's plan from the saved data", () => {
    renderWithStudium(<Overview onSelect={vi.fn()} onRequestComplete={vi.fn()} />);
    const today = screen.getByRole("region", { name: "Today" });
    within(today).getByText("Write case study #3");
    within(today).getByText("Weight paint character");
  });

  it("moves a suggestion into today", async () => {
    const { storage } = renderWithStudium(<Overview onSelect={vi.fn()} onRequestComplete={vi.fn()} />);
    const suggested = screen.getByRole("region", { name: "Suggested next" });
    const add = within(suggested).getAllByRole("button", { name: /^Add .* to today$/ })[0];
    const title = (add.getAttribute("aria-label") ?? "").replace(/^Add /, "").replace(/ to today$/, "");
    await userEvent.click(add);
    within(screen.getByRole("region", { name: "Today" })).getByText(title);
    expect(savedData(storage).today.taskIds.length).toBe(3);
  });

  it("completes from Today through the prompt and can remove items", async () => {
    const onRequestComplete = vi.fn();
    const { storage } = renderWithStudium(<Overview onSelect={vi.fn()} onRequestComplete={onRequestComplete} />);
    await userEvent.click(screen.getByRole("checkbox", { name: "Complete Write case study #3" }));
    expect(onRequestComplete).toHaveBeenCalledWith("webDev-t5");
    await userEvent.click(screen.getByRole("button", { name: "Remove Weight paint character from today" }));
    expect(savedData(storage).today.taskIds).toEqual(["webDev-t5"]);
  });

  it("shows each project's mood and opens it", async () => {
    const onSelect = vi.fn();
    renderWithStudium(<Overview onSelect={onSelect} onRequestComplete={vi.fn()} />);
    const card = screen.getByRole("button", { name: /Senior Capstone Project/ });
    within(card).getByText("Sick");
    await userEvent.click(card);
    expect(onSelect).toHaveBeenCalledWith("seniorCap");
  });

  it("shows total progress", () => {
    renderWithStudium(<Overview onSelect={vi.fn()} onRequestComplete={vi.fn()} />);
    screen.getByText("Total Progress — All Projects");
    screen.getByRole("heading", { name: "Your Projects" });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/Overview.test.tsx`
Expected: FAIL — `Cannot find module './Overview'`.

- [ ] **Step 3: Write `web/src/components/Overview.tsx`**

```tsx
import { isBlocked } from "../planner/blocking";
import { suggestNext, todayTaskIds } from "../planner/suggest";
import type { Task } from "../planner/types";
import { useStudiumContext } from "../store/useStudium";
import { summarizeAll } from "../ui/derive";
import { MOOD_COLORS, daysUntil, deadlineLabel, formatDate, gapLabel, percent } from "../ui/format";
import { CARD, LABEL, SERIF } from "../ui/styles";

type Props = { onSelect: (projectId: string) => void; onRequestComplete: (taskId: string) => void };

function Ring({ value, color, radius, strokeWidth }: { value: number; color: string; radius: number; strokeWidth: number }) {
  return (
    <g>
      <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--color-muted)" strokeWidth={strokeWidth} />
      <circle
        cx="50"
        cy="50"
        r={radius}
        pathLength="100"
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={`${value} ${100 - value}`}
        strokeLinecap="round"
        className="transition-all duration-700"
      />
    </g>
  );
}

export default function Overview({ onSelect, onRequestComplete }: Props) {
  const s = useStudiumContext();
  const dash = summarizeAll(s.data, s.now);
  const total = percent(dash.total);
  const projectsById = new Map(s.data.projects.map((p) => [p.id, p]));
  const todayTasks = todayTaskIds(s.data, s.now)
    .map((id) => s.data.tasks.find((t) => t.id === id))
    .filter((t): t is Task => t !== undefined);
  const suggestions = suggestNext(s.data, s.now);
  const count = dash.summaries.length;

  return (
    <div className="space-y-8">
      <div>
        <h1 style={SERIF} className="text-4xl text-[var(--color-foreground)]">
          Your Projects
        </h1>
        <p className="text-[var(--color-muted-foreground)] mt-1 text-sm">
          {count} active {count === 1 ? "project" : "projects"} · {todayTasks.filter((t) => !t.done).length} tasks planned
          today
        </p>
      </div>

      {/* Total progress */}
      <div className={`${CARD} p-6`}>
        <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
          <div>
            <p className={LABEL}>Total Progress — All Projects</p>
            <p style={SERIF} className="text-5xl">
              {total}
              <span className="text-2xl text-[var(--color-muted-foreground)]">%</span>
            </p>
          </div>
          <div className="text-right">
            <p className={LABEL}>Tasks</p>
            <p style={SERIF} className="text-2xl">
              {dash.tasksDone}
              <span className="text-base text-[var(--color-muted-foreground)]"> / {dash.tasksTotal}</span>
            </p>
          </div>
        </div>
        <div className="flex flex-col md:flex-row items-center gap-8 border-t border-[var(--color-border)] pt-6">
          <div className="relative w-44 h-44 flex-shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100" aria-label={`${total}% total progress`}>
              {dash.summaries.map((sum, i) => (
                <Ring
                  key={sum.project.id}
                  value={percent(sum.progress)}
                  color={sum.project.color}
                  radius={44 - i * (30 / Math.max(count - 1, 1))}
                  strokeWidth={Math.min(5, 26 / Math.max(count, 1))}
                />
              ))}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span style={SERIF} className="text-xl leading-none">
                {total}
              </span>
              <span className="text-xs font-mono text-[var(--color-muted-foreground)]">%</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-3 flex-1 w-full">
            {dash.summaries.map((sum) => (
              <button key={sum.project.id} type="button" onClick={() => onSelect(sum.project.id)} className="flex items-center gap-3 text-left group">
                <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: sum.project.color }} />
                <span className="text-xs font-mono text-[var(--color-muted-foreground)] group-hover:text-[var(--color-foreground)]">
                  {sum.project.shortName} · {percent(sum.progress)}%
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Priority focus */}
      <section
        aria-labelledby="priority-focus"
        className="bg-[var(--color-inverse)] text-[var(--color-inverse-foreground)] border-l-4 border-[var(--color-accent)] p-6 space-y-6"
      >
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-white/55 mb-1">Priority Focus</p>
          <h2 id="priority-focus" style={SERIF} className="text-2xl">
            What matters next
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <section aria-labelledby="today-heading">
            <h3 id="today-heading" className="text-xs font-mono uppercase tracking-widest text-white/55 mb-3">
              Today
            </h3>
            {todayTasks.length === 0 ? (
              <p className="text-sm text-white/55">Nothing planned yet. Add tasks from Suggested next.</p>
            ) : (
              <ul className="space-y-3">
                {todayTasks.map((t) => {
                  const p = projectsById.get(t.projectId);
                  return (
                    <li key={t.id} className="flex items-start gap-3">
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={t.done}
                        aria-label={t.done ? `Reopen ${t.title}` : `Complete ${t.title}`}
                        disabled={!t.done && isBlocked(t, s.data.tasks)}
                        onClick={() => (t.done ? s.reopenTask(t.id) : onRequestComplete(t.id))}
                        className="mt-0.5 w-5 h-5 flex-shrink-0 border border-white/40 hover:border-white flex items-center justify-center text-xs disabled:opacity-40"
                      >
                        {t.done ? "✓" : ""}
                      </button>
                      <button type="button" onClick={() => p && onSelect(p.id)} className="flex-1 text-left min-w-0">
                        <span className="block text-xs font-mono uppercase tracking-widest text-white/50">{p?.shortName}</span>
                        <span className={`block text-sm break-words ${t.done ? "line-through text-white/50" : ""}`}>{t.title}</span>
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove ${t.title} from today`}
                        onClick={() => s.removeFromToday(t.id)}
                        className="text-white/50 hover:text-white text-lg leading-none"
                      >
                        ×
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
          <section aria-labelledby="suggested-heading">
            <h3 id="suggested-heading" className="text-xs font-mono uppercase tracking-widest text-white/55 mb-3">
              Suggested next
            </h3>
            {suggestions.length === 0 ? (
              <p className="text-sm text-white/55">No open tasks to suggest.</p>
            ) : (
              <ul className="space-y-3">
                {suggestions.map((sg) => (
                  <li key={sg.task.id} className="flex items-start gap-3">
                    <span className="w-4 flex-shrink-0 text-[var(--color-accent)]" aria-hidden="true">
                      {sg.task.priority ? "⚑" : ""}
                    </span>
                    <button type="button" onClick={() => onSelect(sg.project.id)} className="flex-1 text-left min-w-0">
                      <span className="block text-xs font-mono uppercase tracking-widest text-white/50">
                        {sg.project.shortName} · ~{sg.expectedTokens} tokens
                      </span>
                      <span className="block text-sm break-words">{sg.task.title}</span>
                    </button>
                    <button
                      type="button"
                      aria-label={`Add ${sg.task.title} to today`}
                      onClick={() => s.addToToday(sg.task.id)}
                      className="text-xs border border-white/30 hover:border-white px-2 py-1 flex-shrink-0"
                    >
                      + Today
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </section>

      {/* Project cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {dash.summaries.map((sum) => {
          const p = sum.project;
          const soon = daysUntil(p.deadline, s.now) < 30;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelect(p.id)}
              className={`${CARD} p-6 text-left hover:border-[var(--color-foreground)] transition-colors`}
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: p.color }} />
                  <div className="min-w-0">
                    <p className="text-xs font-mono text-[var(--color-muted-foreground)] uppercase tracking-widest">{p.shortName}</p>
                    <p className="font-semibold text-[var(--color-foreground)] leading-tight mt-0.5 break-words">{p.name}</p>
                  </div>
                </div>
                <span className="text-xs font-mono uppercase tracking-widest flex-shrink-0" style={{ color: MOOD_COLORS[sum.mood] }}>
                  {sum.mood}
                </span>
              </div>
              <div className="mb-3">
                <div className="flex justify-between items-baseline mb-1.5 text-xs">
                  <span className="text-[var(--color-muted-foreground)]">
                    {sum.tasksDone} / {sum.tasksTotal} tasks · {gapLabel(sum.gap)}
                  </span>
                  <span className="font-mono font-medium">{percent(sum.progress)}%</span>
                </div>
                <div className="h-1.5 bg-[var(--color-muted)] overflow-hidden">
                  <div className="h-full" style={{ width: `${percent(sum.progress)}%`, backgroundColor: p.color }} />
                </div>
              </div>
              <p className={`text-xs ${soon ? "text-[var(--color-accent)] font-medium" : "text-[var(--color-muted-foreground)]"}`}>
                {deadlineLabel(p.deadline, s.now)} · {formatDate(p.deadline)}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests and the build**

Run: `npx vitest run src/components/Overview.test.tsx`
Expected: PASS (5 tests).
Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/components/Overview.tsx src/components/Overview.test.tsx
git commit -m "feat(ui): add overview with Today and Suggested next" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Shop

**Files:**
- Create: `web/src/components/Shop.tsx`
- Test: `web/src/components/Shop.test.tsx`

**Interfaces:**
- Consumes: `store/products.ts` (`SHOP_PRODUCTS`, `ShopCategory`), `planner/history.ts` (`inventory`, `tokenBalance`), `useStudiumContext`, `ui/styles.ts`.
- Produces: `Shop()` — heading `"Shop"`, balance shown as a number, product buttons `"Buy · <price> tokens"` or `"Need <n> more"` (disabled), `"Owned ×<n>"`.

- [ ] **Step 1: Write the failing test `web/src/components/Shop.test.tsx`**

```tsx
// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { NOW } from "../planner/testData";
import { buildSeed } from "../store/seed";
import { renderWithStudium } from "../test/render";
import Shop from "./Shop";

describe("Shop", () => {
  it("shows the balance and the Care section with Medicine", () => {
    renderWithStudium(<Shop />);
    screen.getByText("650");
    screen.getByRole("heading", { name: "Care" });
    screen.getByText("Medicine");
  });

  it("buys an item", async () => {
    renderWithStudium(<Shop />);
    await userEvent.click(screen.getByRole("button", { name: "Buy · 80 tokens" }));
    screen.getByText("570");
    screen.getByText("Owned ×1");
  });

  it("disables what you can't afford", () => {
    const data = buildSeed(NOW);
    data.events.push({ type: "purchase", at: NOW.toISOString(), productId: "rainy-day-coat", price: 600 });
    renderWithStudium(<Shop />, { data });
    expect((screen.getByRole("button", { name: "Need 30 more" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/Shop.test.tsx`
Expected: FAIL — `Cannot find module './Shop'`.

- [ ] **Step 3: Write `web/src/components/Shop.tsx`**

```tsx
import { inventory, tokenBalance } from "../planner/history";
import { SHOP_PRODUCTS, type ShopCategory } from "../store/products";
import { useStudiumContext } from "../store/useStudium";
import { CARD, SERIF } from "../ui/styles";

const CATEGORIES: { category: ShopCategory; blurb: string }[] = [
  { category: "Care", blurb: "Health & recovery" },
  { category: "Food", blurb: "Care & energy" },
  { category: "Clothes", blurb: "Companion style" },
  { category: "Toys", blurb: "Play & enrichment" },
];

function ProductIcon({ category }: { category: ShopCategory }) {
  const common = { className: "w-16 h-16", viewBox: "0 0 64 64", fill: "none", stroke: "currentColor", "aria-hidden": true } as const;
  if (category === "Care") {
    return (
      <svg {...common}>
        <path d="M24 10h16v8H24zM20 18h24v36H20z" strokeWidth="2" strokeLinejoin="round" />
        <path d="M32 28v16M24 36h16" strokeWidth="3" strokeLinecap="round" />
      </svg>
    );
  }
  if (category === "Food") {
    return (
      <svg {...common}>
        <path d="M14 28h36l-4 22H18l-4-22Z" strokeWidth="2" strokeLinejoin="round" />
        <path d="M21 28c1-8 6-13 11-13s10 5 11 13M26 20c-2-5 1-9 6-10" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  if (category === "Clothes") {
    return (
      <svg {...common}>
        <path d="m22 14-12 9 7 10 6-4v22h18V29l6 4 7-10-12-9c-2 4-5 6-10 6s-8-2-10-6Z" strokeWidth="2" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M18 41c0-12 7-22 14-22s14 10 14 22" strokeWidth="2" strokeLinecap="round" />
      <circle cx="18" cy="43" r="7" strokeWidth="2" />
      <circle cx="46" cy="43" r="7" strokeWidth="2" />
    </svg>
  );
}

export default function Shop() {
  const s = useStudiumContext();
  const balance = tokenBalance(s.data.events);
  const owned = inventory(s.data.events);
  const ownedCount = Object.values(owned).reduce((n, c) => n + c, 0);

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-5 border-b border-[var(--color-border)] pb-7">
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-[var(--color-accent)] mb-2">Companion Supplies</p>
          <h1 style={SERIF} className="text-4xl text-[var(--color-foreground)]">
            Shop
          </h1>
          <p className="text-sm text-[var(--color-muted-foreground)] mt-2 max-w-lg">
            Spend study tokens on care, treats, outfits and toys for your project companions.
          </p>
        </div>
        <div className="bg-[var(--color-inverse)] text-[var(--color-inverse-foreground)] px-5 py-3 min-w-44">
          <p className="text-xs font-mono uppercase tracking-widest text-white/55">Your Balance</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span style={SERIF} className="text-3xl">
              {balance}
            </span>
            <span className="text-xs font-mono uppercase tracking-widest text-white/65">Study Tokens</span>
          </div>
        </div>
      </div>

      {CATEGORIES.map(({ category, blurb }) => (
        <section key={category} aria-labelledby={`shop-${category}`}>
          <div className="flex items-baseline justify-between gap-4 mb-4">
            <h2 id={`shop-${category}`} style={SERIF} className="text-2xl">
              {category}
            </h2>
            <p className="text-xs font-mono uppercase tracking-widest text-[var(--color-muted-foreground)]">{blurb}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {SHOP_PRODUCTS.filter((p) => p.category === category).map((product) => {
              const count = owned[product.id] ?? 0;
              const canAfford = balance >= product.price;
              return (
                <article key={product.id} className={`${CARD} p-5 flex gap-5`}>
                  <div className="w-24 h-24 flex-shrink-0 bg-[var(--color-muted)] text-[var(--color-primary)] flex items-center justify-center">
                    <ProductIcon category={product.category} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-[var(--color-foreground)]">{product.name}</h3>
                        <p className="text-xs text-[var(--color-muted-foreground)] leading-relaxed mt-1">{product.description}</p>
                      </div>
                      {count > 0 && <span className="text-xs font-mono text-[var(--color-accent)] whitespace-nowrap">Owned ×{count}</span>}
                    </div>
                    <button
                      type="button"
                      onClick={() => s.purchase(product.id)}
                      disabled={!canAfford}
                      className="mt-4 w-full px-3 py-2 text-xs font-mono uppercase tracking-widest bg-[var(--color-primary)] text-[var(--color-primary-foreground)] hover:bg-[var(--color-primary-hover)] disabled:bg-[var(--color-muted)] disabled:text-[var(--color-muted-foreground)] disabled:cursor-not-allowed transition-colors"
                    >
                      {canAfford ? `Buy · ${product.price} tokens` : `Need ${product.price - balance} more`}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}

      <div className="border-t border-[var(--color-border)] pt-4 flex justify-between text-xs font-mono uppercase tracking-widest text-[var(--color-muted-foreground)]">
        <span>Inventory</span>
        <span>{ownedCount} items owned</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests and the build**

Run: `npx vitest run src/components/Shop.test.tsx`
Expected: PASS (3 tests).
Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/components/Shop.tsx src/components/Shop.test.tsx
git commit -m "feat(ui): add shop with Care and saved purchases" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Project modal (new, edit, delete)

**Files:**
- Create: `web/src/components/ProjectModal.tsx`
- Test: `web/src/components/ProjectModal.test.tsx`

**Interfaces:**
- Consumes: `EggPicker`, `useStudiumContext`, `planner/time.ts` (`isDateKey`), `planner/types.ts` (`PetKind`, `Project`), `ui/styles.ts` (incl. `PROJECT_COLORS`).
- Produces: `ProjectModal({ project?: Project; onClose; onCreated?: (project: Project) => void; onDeleted?: () => void })` — dialog `"New Project"` or `"Edit Project"`; fields labelled `"Project name"`, `"Short label"`, `"Deadline"`, `"Description"`; buttons `"Create project"` / `"Save project"`, `"Cancel"`, `"Delete project"` then confirm `"Delete"` / `"Keep"`; errors `"Add a project name."`, `"Pick a deadline."`, `"Choose an egg."`; Escape closes.

- [ ] **Step 1: Write the failing test `web/src/components/ProjectModal.test.tsx`**

```tsx
// @vitest-environment jsdom
import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NOW, dayKey } from "../planner/testData";
import { PET_KINDS } from "../planner/types";
import { buildSeed } from "../store/seed";
import { renderWithStudium, savedData } from "../test/render";
import ProjectModal from "./ProjectModal";

const webDev = () => buildSeed(NOW).projects[0];

describe("ProjectModal", () => {
  it("requires a name, a deadline and an egg", async () => {
    const onCreated = vi.fn();
    renderWithStudium(<ProjectModal onClose={vi.fn()} onCreated={onCreated} />);
    await userEvent.click(screen.getByRole("button", { name: "Create project" }));
    screen.getByText("Add a project name.");
    screen.getByText("Pick a deadline.");
    screen.getByText("Choose an egg.");
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("creates a project with the chosen egg", async () => {
    const onCreated = vi.fn();
    const onClose = vi.fn();
    const { storage } = renderWithStudium(<ProjectModal onClose={onClose} onCreated={onCreated} />);
    await userEvent.type(screen.getByLabelText("Project name"), "Thesis Website");
    fireEvent.change(screen.getByLabelText("Deadline"), { target: { value: dayKey(40) } });
    await userEvent.click(screen.getAllByRole("radio", { name: /^Egg / })[2]);
    await userEvent.click(screen.getByRole("button", { name: "Create project" }));
    const created = savedData(storage).projects.find((p) => p.name === "Thesis Website");
    expect(created).toBeDefined();
    expect(PET_KINDS).toContain(created?.petKind);
    expect(created?.shortName).toBe("Thesis");
    expect(onCreated).toHaveBeenCalledWith(created);
    expect(onClose).toHaveBeenCalled();
  });

  it("edits a project without changing its pet", async () => {
    const { storage } = renderWithStudium(<ProjectModal project={webDev()} onClose={vi.fn()} />);
    screen.getByText(/Companion: pigeon/);
    expect(screen.queryAllByRole("radio", { name: /^Egg / })).toHaveLength(0);
    await userEvent.clear(screen.getByLabelText("Project name"));
    await userEvent.type(screen.getByLabelText("Project name"), "Portfolio Site");
    await userEvent.click(screen.getByRole("button", { name: "Save project" }));
    expect(savedData(storage).projects.find((p) => p.id === "webDev")).toMatchObject({ name: "Portfolio Site", petKind: "pigeon" });
  });

  it("deletes a project after confirming", async () => {
    const onDeleted = vi.fn();
    const { storage } = renderWithStudium(<ProjectModal project={webDev()} onClose={vi.fn()} onDeleted={onDeleted} />);
    await userEvent.click(screen.getByRole("button", { name: "Delete project" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(savedData(storage).projects.some((p) => p.id === "webDev")).toBe(false);
    expect(onDeleted).toHaveBeenCalled();
  });

  it("closes on Escape", async () => {
    const onClose = vi.fn();
    renderWithStudium(<ProjectModal onClose={onClose} />);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/ProjectModal.test.tsx`
Expected: FAIL — `Cannot find module './ProjectModal'`.

- [ ] **Step 3: Write `web/src/components/ProjectModal.tsx`**

```tsx
import { useEffect, useState, type FormEvent } from "react";
import { isDateKey } from "../planner/time";
import type { PetKind, Project } from "../planner/types";
import { useStudiumContext } from "../store/useStudium";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, CARD, INPUT, LABEL, PROJECT_COLORS, SERIF } from "../ui/styles";
import EggPicker from "./EggPicker";

type Props = {
  project?: Project; // set = edit mode
  onClose: () => void;
  onCreated?: (project: Project) => void;
  onDeleted?: () => void;
};

export default function ProjectModal({ project, onClose, onCreated, onDeleted }: Props) {
  const s = useStudiumContext();
  const [name, setName] = useState(project?.name ?? "");
  const [shortName, setShortName] = useState(project?.shortName ?? "");
  const [deadline, setDeadline] = useState(project?.deadline ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [color, setColor] = useState(project?.color ?? PROJECT_COLORS[0]);
  const [petKind, setPetKind] = useState<PetKind | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const problems: string[] = [];
    if (!name.trim()) problems.push("Add a project name.");
    if (!isDateKey(deadline)) problems.push("Pick a deadline.");
    if (!project && !petKind) problems.push("Choose an egg.");
    setErrors(problems);
    if (problems.length > 0) return;

    const fields = {
      name: name.trim(),
      shortName: shortName.trim() || name.trim().split(/\s+/)[0],
      color,
      deadline,
      description: description.trim(),
    };
    if (project) {
      s.updateProject(project.id, fields);
    } else if (petKind) {
      onCreated?.(s.createProject({ ...fields, petKind }));
    }
    onClose();
  }

  const title = project ? "Edit Project" : "New Project";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-overlay)] overflow-y-auto py-8">
      <div role="dialog" aria-modal="true" aria-labelledby="project-modal-title" className={`${CARD} w-full max-w-lg mx-4 p-8`}>
        <div className="flex items-center justify-between mb-6">
          <h2 id="project-modal-title" style={SERIF} className="text-2xl">
            {title}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] text-xl leading-none">
            ×
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <label className={LABEL}>
            Project Name *
            <input aria-label="Project name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Senior Capstone Project" className={`${INPUT} mt-1 normal-case tracking-normal font-sans`} />
          </label>
          <label className={LABEL}>
            Short Label
            <input aria-label="Short label" value={shortName} onChange={(e) => setShortName(e.target.value)} placeholder="e.g. seniorCap" className={`${INPUT} mt-1 normal-case tracking-normal font-sans`} />
          </label>
          <label className={LABEL}>
            Deadline *
            <input aria-label="Deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={`${INPUT} mt-1`} />
          </label>
          <label className={LABEL}>
            Description
            <textarea aria-label="Description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="What is this project about?" className={`${INPUT} mt-1 resize-none normal-case tracking-normal font-sans`} />
          </label>
          <fieldset>
            <legend className={LABEL}>Color</legend>
            <div className="flex gap-2" role="radiogroup" aria-label="Color">
              {PROJECT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={color === c}
                  aria-label={`Color ${c}`}
                  onClick={() => setColor(c)}
                  className="w-7 h-7 rounded-sm"
                  style={{ backgroundColor: c, outline: color === c ? `2px solid ${c}` : "none", outlineOffset: "2px" }}
                />
              ))}
            </div>
          </fieldset>
          {project ? (
            <p className="text-sm text-[var(--color-muted-foreground)]">
              Companion: {project.petKind} (it has hatched, so it can't be changed).
            </p>
          ) : (
            <fieldset>
              <legend className={LABEL}>Companion egg *</legend>
              <EggPicker value={petKind} onChange={setPetKind} />
            </fieldset>
          )}
          {errors.length > 0 && (
            <ul role="alert" className="text-sm text-[var(--color-accent)] space-y-0.5">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className={`flex-1 ${BUTTON_SECONDARY}`}>
              Cancel
            </button>
            <button type="submit" className={`flex-1 ${BUTTON_PRIMARY}`}>
              {project ? "Save project" : "Create project"}
            </button>
          </div>
        </form>
        {project && (
          <div className="mt-6 border-t border-[var(--color-border)] pt-4">
            {confirmDelete ? (
              <div className="space-y-2 text-sm">
                <p>Delete “{project.name}” and all its requirements and tasks? Your tokens and purchases stay.</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      s.deleteProject(project.id);
                      onDeleted?.();
                      onClose();
                    }}
                    className={BUTTON_PRIMARY}
                  >
                    Delete
                  </button>
                  <button type="button" onClick={() => setConfirmDelete(false)} className={BUTTON_SECONDARY}>
                    Keep
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)} className="text-sm text-[var(--color-accent)] hover:underline">
                Delete project
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests and the build**

Run: `npx vitest run src/components/ProjectModal.test.tsx`
Expected: PASS (5 tests).
Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/components/ProjectModal.tsx src/components/ProjectModal.test.tsx
git commit -m "feat(ui): add project modal with egg picker, edit and delete" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: App shell and notices

**Files:**
- Create: `web/src/components/NoticeBanner.tsx`
- Modify (replace): `web/src/App.tsx`
- Test: `web/src/App.test.tsx`

**Interfaces:**
- Consumes: every component above, `useStudiumContext`, `StudiumProvider`, `planner/history.ts` (`tokenBalance`).
- Produces:
  - `NoticeBanner({ notice: Notice; onDismiss })` — `role="alert"`, button `"Dismiss notice"`.
  - `App.tsx`: named export `StudiumApp` (needs a provider; used by tests) and default export `App` (wraps `StudiumApp` in `StudiumProvider` with browser storage).

- [ ] **Step 1: Write the failing test `web/src/App.test.tsx`**

```tsx
// @vitest-environment jsdom
import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { dayKey } from "./planner/testData";
import { StudiumApp } from "./App";
import { renderWithStudium, savedData } from "./test/render";

describe("StudiumApp", () => {
  it("navigates between overview, a project and the shop", async () => {
    renderWithStudium(<StudiumApp />);
    screen.getByRole("heading", { name: "Your Projects" });
    await userEvent.click(screen.getAllByRole("button", { name: /appDev/ })[0]);
    screen.getByRole("heading", { name: "Mobile App — Habit Tracker" });
    await userEvent.click(screen.getAllByRole("button", { name: "Shop" })[0]);
    screen.getByRole("heading", { name: "Shop" });
    await userEvent.click(screen.getAllByRole("button", { name: "All Projects" })[0]);
    screen.getByRole("heading", { name: "Your Projects" });
  });

  it("completes from Today, then reopens on the project page", async () => {
    const { storage } = renderWithStudium(<StudiumApp />);
    await userEvent.click(screen.getByRole("checkbox", { name: "Complete Write case study #3" }));
    await userEvent.click(screen.getByRole("button", { name: "Save and complete" }));
    expect(screen.getByRole("status").textContent).toMatch(/\+\d+ tokens/);
    const balanceAfter = savedData(storage).events.filter((e) => e.type === "task_completed").length;
    await userEvent.click(screen.getAllByRole("button", { name: /webDev/ })[0]);
    await userEvent.click(screen.getByRole("checkbox", { name: "Reopen Write case study #3" }));
    expect(savedData(storage).tasks.find((t) => t.id === "webDev-t5")?.done).toBe(false);
    expect(savedData(storage).events.filter((e) => e.type === "task_completed").length).toBe(balanceAfter);
  });

  it("creates a project and shows it hatching", async () => {
    renderWithStudium(<StudiumApp />);
    await userEvent.click(screen.getByRole("button", { name: "+ New Project" }));
    await userEvent.type(screen.getByLabelText("Project name"), "Thesis Website");
    fireEvent.change(screen.getByLabelText("Deadline"), { target: { value: dayKey(40) } });
    await userEvent.click(screen.getAllByRole("radio", { name: /^Egg / })[0]);
    await userEvent.click(screen.getByRole("button", { name: "Create project" }));
    screen.getByRole("heading", { name: "Thesis Website" });
    screen.getByText(/^It hatched: a /);
  });

  it("returns to the overview when the open project is deleted", async () => {
    renderWithStudium(<StudiumApp />);
    await userEvent.click(screen.getAllByRole("button", { name: /webDev/ })[0]);
    await userEvent.click(screen.getByRole("button", { name: "Edit project" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete project" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    screen.getByRole("heading", { name: "Your Projects" });
  });

  it("warns when changes can't be saved", async () => {
    renderWithStudium(<StudiumApp />, { storage: null });
    const alert = screen.getByRole("alert");
    within(alert).getByText(/won't be saved/);
    await userEvent.click(within(alert).getByRole("button", { name: "Dismiss notice" }));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows the token balance in the header", () => {
    renderWithStudium(<StudiumApp />);
    screen.getByText("650 tokens");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/App.test.tsx`
Expected: FAIL — `StudiumApp` is not exported (`does not provide an export named 'StudiumApp'` or `Element type is invalid`).

- [ ] **Step 3: Write `web/src/components/NoticeBanner.tsx`**

```tsx
import type { Notice } from "../store/useStudium";

const MESSAGES: Record<Exclude<Notice, null>, string> = {
  "damaged-data":
    "Your saved data couldn't be read, so Studium started fresh with the example projects. The old data was kept as a backup in this browser.",
  "storage-unavailable": "This browser isn't letting Studium save, so changes won't be saved after you close the tab.",
  "save-failed": "Studium couldn't save your last change (storage may be full). Changes won't be saved until this is fixed.",
};

export default function NoticeBanner({ notice, onDismiss }: { notice: Notice; onDismiss: () => void }) {
  if (!notice) return null;
  return (
    <div role="alert" className="bg-[var(--color-accent)] text-[var(--color-accent-foreground)]">
      <div className="max-w-6xl mx-auto px-6 py-2 flex items-start gap-3 text-sm">
        <span className="flex-1">{MESSAGES[notice]}</span>
        <button type="button" onClick={onDismiss} aria-label="Dismiss notice" className="opacity-80 hover:opacity-100">
          ×
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Replace `web/src/App.tsx`**

```tsx
// App shell: navigation, theme, modals and toasts. Screens live in components/,
// data and actions come from the Studium provider (store/useStudium.tsx).
import { useCallback, useLayoutEffect, useState } from "react";
import CompletionPrompt from "./components/CompletionPrompt";
import NoticeBanner from "./components/NoticeBanner";
import Overview from "./components/Overview";
import ProjectDetail from "./components/ProjectDetail";
import ProjectModal from "./components/ProjectModal";
import Shop from "./components/Shop";
import Toast from "./components/Toast";
import { tokenBalance } from "./planner/history";
import { StudiumProvider, useStudiumContext } from "./store/useStudium";
import { SERIF } from "./ui/styles";

type Theme = "light" | "dark";
type Modal = null | { mode: "create" } | { mode: "edit"; projectId: string };

function initialTheme(): Theme {
  try {
    const saved = window.localStorage.getItem("studium-theme");
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // Storage blocked; fall through to the system preference.
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

const NAV_ACTIVE = "bg-[var(--color-inverse)] text-[var(--color-inverse-foreground)]";
const NAV_IDLE = "text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]";

export function StudiumApp() {
  const s = useStudiumContext();
  const [page, setPage] = useState<"projects" | "shop">("projects");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [justHatchedId, setJustHatchedId] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      window.localStorage.setItem("studium-theme", theme);
    } catch {
      // Not saved; the theme still applies for this visit.
    }
  }, [theme]);

  const dismissToast = useCallback(() => setToast(null), []);
  const closeModal = useCallback(() => setModal(null), []);
  const closePrompt = useCallback(() => setCompletingId(null), []);

  const selected = s.data.projects.find((p) => p.id === selectedId) ?? null;
  const editing = modal?.mode === "edit" ? s.data.projects.find((p) => p.id === modal.projectId) : undefined;
  const onProjects = page === "projects";

  function openProjects() {
    setSelectedId(null);
    setPage("projects");
  }

  function openProject(id: string) {
    if (id !== justHatchedId) setJustHatchedId(null);
    setSelectedId(id);
    setPage("projects");
  }

  const navButton = (label: string, active: boolean, onClick: () => void, color?: string, small = false) => (
    <button
      key={label}
      type="button"
      onClick={onClick}
      className={`${small ? "px-3 py-1 text-xs whitespace-nowrap" : "px-3 py-1.5 text-sm"} transition-colors flex items-center gap-1.5 ${active ? NAV_ACTIVE : NAV_IDLE}`}
    >
      {color && <span className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: active ? "white" : color }} />}
      {label}
    </button>
  );

  const navItems = (small: boolean) => [
    navButton(small ? "All" : "All Projects", onProjects && !selected, openProjects, undefined, small),
    ...s.data.projects.map((p) => navButton(p.shortName, onProjects && selected?.id === p.id, () => openProject(p.id), p.color, small)),
    navButton("Shop", page === "shop", () => setPage("shop"), undefined, small),
  ];

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "var(--color-background)" }}>
      <header className="bg-[var(--color-card)] border-b border-[var(--color-border)] sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6 min-w-0">
            <span style={SERIF} className="text-lg italic text-[var(--color-foreground)]">
              Studium
            </span>
            <nav aria-label="Main" className="hidden sm:flex items-center gap-1 overflow-x-auto">
              {navItems(false)}
            </nav>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs font-mono text-[var(--color-muted-foreground)] whitespace-nowrap">
              {tokenBalance(s.data.events)} tokens
            </span>
            <button
              type="button"
              onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
              className="w-8 h-8 border border-[var(--color-border)] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:border-[var(--color-foreground)] transition-colors flex items-center justify-center"
              aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
              title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
            >
              {theme === "light" ? "☾" : "☀"}
            </button>
            <button
              type="button"
              onClick={() => setModal({ mode: "create" })}
              className="text-sm px-4 py-1.5 bg-[var(--color-primary)] text-[var(--color-primary-foreground)] hover:bg-[var(--color-primary-hover)] transition-colors whitespace-nowrap"
            >
              + New Project
            </button>
          </div>
        </div>
      </header>

      <nav aria-label="Main (mobile)" className="sm:hidden bg-[var(--color-card)] border-b border-[var(--color-border)] px-4 py-2 flex gap-2 overflow-x-auto">
        {navItems(true)}
      </nav>

      <NoticeBanner notice={s.notice} onDismiss={s.dismissNotice} />

      <main className="max-w-6xl mx-auto w-full px-6 py-10">
        {page === "shop" ? (
          <Shop />
        ) : selected ? (
          <>
            <button
              type="button"
              onClick={openProjects}
              className="flex items-center gap-1 text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] transition-colors mb-6"
            >
              ‹ All Projects
            </button>
            <ProjectDetail
              projectId={selected.id}
              justHatched={selected.id === justHatchedId}
              onRequestComplete={setCompletingId}
              onEditProject={() => setModal({ mode: "edit", projectId: selected.id })}
              onOpenShop={() => setPage("shop")}
            />
          </>
        ) : (
          <Overview onSelect={openProject} onRequestComplete={setCompletingId} />
        )}
      </main>

      {modal && (
        <ProjectModal
          project={editing}
          onClose={closeModal}
          onCreated={(p) => {
            setJustHatchedId(p.id);
            setSelectedId(p.id);
            setPage("projects");
          }}
          onDeleted={openProjects}
        />
      )}
      {completingId && <CompletionPrompt taskId={completingId} onClose={closePrompt} onDone={setToast} />}
      <Toast message={toast} onDismiss={dismissToast} />
    </div>
  );
}

export default function App() {
  return (
    <StudiumProvider>
      <StudiumApp />
    </StudiumProvider>
  );
}
```

Note on the navigation test: the "All Projects" back link renders as `‹ All Projects`; `getAllByRole("button", { name: "All Projects" })` matches the header button exactly. If the test's `name: /appDev/` also matches the overview's ring legend and Suggested items, `[0]` (the header tab) is the intended target.

- [ ] **Step 5: Run tests and the build**

Run: `npx vitest run src/App.test.tsx`
Expected: PASS (6 tests).
Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/App.test.tsx src/components/NoticeBanner.tsx
git commit -m "feat(ui): rebuild the Studium shell on the saved planner data" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Docs and full check in a browser

**Files:**
- Modify: `README.md`, `HANDOFF.md`

**Interfaces:**
- Consumes: everything above.
- Produces: documentation only.

- [ ] **Step 1: Update `README.md`** — in the "Where to change things" table, replace the two Studium rows with:

```markdown
| Studium screens | `web/src/components/` (one file per piece; `App.tsx` is just the shell) |
| Wording shown in Studium (labels, token messages) | `web/src/ui/format.ts` |
| Egg looks and descriptions | `web/src/pets/eggs.ts` |
| Studium colors, fonts, dark mode | `web/src/index.css` |
```

and change the "Planner core" paragraph's second sentence to: `The Studium screens use them through web/src/store/useStudium.tsx, which saves every change in this browser.`

- [ ] **Step 2: Update `HANDOFF.md`** (the briefing for the next Claude session)

- "Start here": replace the Plan 2 instructions with the next step (write and implement Plan 3 from spec section 5), and note which branch Plan 2 ended on and whether it was pushed or merged.
- "Status" table: mark Plan 2 done with its branch and final test count.
- "The project" and "Code map": `web/src/App.tsx` is now the shell; add `src/components/`, `src/ui/` (format, derive, styles), `src/pets/eggs.ts`, `src/store/useStudium.tsx`, `src/test/render.tsx`, `public/pets/`.
- "Decisions made after the spec" and "Gotchas": add any rulings from this plan's ledger and anything that surprised you.

- [ ] **Step 3: Run the full suite and the build**

Run: `npm test`
Expected: all test files pass (Plan 1's 101 tests plus this plan's).
Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Check it in a real browser**

Run: `npm run dev` and open http://localhost:5173 (or run a scratch Playwright script against `npx vite preview`, as in earlier sessions, without adding Playwright to the repo). Check, in light and dark mode and at 390 px wide:
- the overview shows five projects with moods, Today and Suggested next;
- completing a task from Today asks for the time and shows a token message;
- a project page shows requirement cards with planned ticks, idle days on Animation's Rigging, and the habitat (still image after a second when the extension isn't installed);
- seniorCap is Sick; buying Medicine in the Shop and giving it changes the mood;
- New Project shows five eggs with descriptions and hatches a pet;
- refreshing the page keeps every change.

Fix anything broken (with a failing test first) before continuing.

- [ ] **Step 5: Commit**

```bash
git add ../README.md ../HANDOFF.md
git commit -m "docs: describe the new Studium screens and saved data" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Coverage map (spec section 4 and 7 → task)

| Spec item | Task |
|---|---|
| Requirement cards: title, weight, dates, progress with planned tick, idle days | 6 |
| Tasks: checkbox, estimate, lock + "waiting on", flag, add to today | 5 |
| Unlinked group with link control | 5, 6 |
| Add requirement (title, weight, start, due) | 6 |
| Add task (title, requirement, estimate quick buttons, blocked by) | 5, 6 |
| Edit/delete requirements (delete asks: delete tasks or unlink) and tasks | 5, 6 |
| Completion prompt with time, skip, token message | 7, 13 |
| Un-check = reopen, no tokens change | 5, 13 |
| Habitat box + `data-pet-attached` fallback image, Mood/Attention/Accuracy, Give medicine, hatch message | 8 |
| Overview: weighted totals and rings, Priority Focus Today + Suggested (top 6, pinned first, add to today), project cards with mood | 10 |
| Shop: Care/Medicine, calculated balance | 11 |
| New Project: egg picker (shuffled, vague descriptions, arrow keys, required), hatch now; edit/delete projects, pet kind fixed | 4, 12, 13 |
| Notices: damaged data, storage unavailable (+ save failed) | 3, 13 |

Not in this plan (Plan 3): publishing `studium-pets-v1`, the extension reading it, habitat mode in the extension, mood-driven pet behavior.

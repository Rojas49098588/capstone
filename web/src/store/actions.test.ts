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
  updateProject,
  updateRequirement,
  updateTask,
} from "./actions";
import { isValidData } from "./storage";

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
    expect(data.events.slice(-1)[0]).toMatchObject({ type: "requirement_created", requirementId: requirement.id });
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
    expect(data.events.slice(-1)[0]).toMatchObject({ type: "task_completed", taskId: "A", actualMin: 45, tokens: payout?.tokens });
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

describe("keeping saved data loadable", () => {
  const roundTrip = (d: unknown) => JSON.parse(JSON.stringify(d));

  it("treats cleared or malformed dates as empty and ignores undefined changes", () => {
    const { data, requirement } = createRequirement(
      makeData(),
      { projectId: "p1", title: "R", weight: 3, startDate: "", dueDate: "soon" },
      NOW,
    );
    expect(requirement).toMatchObject({ startDate: null, dueDate: null });
    const edited = updateRequirement(data, requirement.id, { startDate: undefined, dueDate: "" }, NOW);
    expect(isValidData(roundTrip(edited))).toBe(true);
    const project = updateProject(edited, "p1", { deadline: "", name: undefined });
    expect(project.projects[0].deadline).toBe(edited.projects[0].deadline);
    expect(isValidData(roundTrip(project))).toBe(true);
  });

  it("refuses a task for an unknown project", () => {
    expect(() =>
      createTask(makeData(), { projectId: "nope", requirementId: null, title: "x", estimateMin: 30 }, NOW),
    ).toThrow();
  });
});

describe("farming", () => {
  it("can't farm tokens by creating, completing and deleting tasks", () => {
    let data = makeData({ requirements: [makeRequirement({ weight: 10 })] });
    let total = 0;
    for (let i = 0; i < 3; i++) {
      const created = createTask(data, { projectId: "p1", requirementId: "r1", title: "x", estimateMin: 15 }, NOW);
      const done = completeTask(created.data, created.task.id, 15, NOW);
      total += done.payout?.tokens ?? 0;
      data = deleteTask(done.data, created.task.id);
    }
    // First round: (700 × 1.25 neglect + 300 finish) × 0.3 = 352.5 → 353. Later rounds pay nothing.
    expect(total).toBe(353);
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

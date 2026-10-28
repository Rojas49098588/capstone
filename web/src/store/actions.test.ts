import { describe, expect, it } from "vitest";
import { paidCompletionsOnDay, tokenBalance, inventory } from "../planner/history";
import { NOW, completed, dayKey, daysAgo, makeData, makeRequirement, makeTask } from "../planner/testData";
import { addDays } from "../planner/time";
import {
  addToToday,
  clampWeight,
  completeTask,
  createProject,
  createRequirement,
  createTask,
  deleteRequirement,
  deleteTask,
  giveMedicine,
  purchase,
  recordFocusSessions,
  reopenTask,
  updateProject,
  updateRequirement,
  updateTask,
} from "./actions";
import { petStage } from "../planner/lifecycle";
import { isValidData } from "./storage";
import { buildSeed } from "./seed";

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

  it("doesn't give medicine to an egg", () => {
    const egg = { ...sick(), projects: [{ ...sick().projects[0], stage: "egg" as const, hatchedAt: null }] };
    const stocked = purchase(egg, "medicine", NOW).data;
    expect(giveMedicine(stocked, "p1", NOW).ok).toBe(false);
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

describe("recordFocusSessions", () => {
  const s = (o: Record<string, unknown> = {}) => ({
    id: "s1",
    projectId: "webDev",
    taskId: "webDev-t5",
    startedAt: new Date(NOW.getTime() - 15 * 60_000).toISOString(),
    at: NOW.toISOString(),
    minutes: 15,
    ...o,
  }) as Parameters<typeof recordFocusSessions>[1][number];
  const focusEvents = (d: ReturnType<typeof buildSeed>) => d.events.filter((e) => e.type === "focus_session");

  it("records new sessions as events and reports them handled", () => {
    const seed = buildSeed(NOW);
    const r = recordFocusSessions(seed, [s()], NOW);
    expect(r.handled).toEqual(["s1"]);
    expect(r.data.events.slice(-1)[0]).toEqual({ type: "focus_session", ...s() });
    expect(tokenBalance(r.data.events)).toBe(tokenBalance(seed.events));
    expect(isValidData(r.data)).toBe(true);
  });

  it("skips ids already in the log, also within one batch", () => {
    const first = recordFocusSessions(buildSeed(NOW), [s(), s()], NOW);
    expect(first.handled).toEqual(["s1", "s1"]);
    expect(focusEvents(first.data)).toHaveLength(1);
    const second = recordFocusSessions(first.data, [s()], NOW);
    expect(second.handled).toEqual(["s1"]);
    expect(second.data).toBe(first.data);
  });

  it("drops sessions for deleted projects but still reports them handled", () => {
    const r = recordFocusSessions(buildSeed(NOW), [s({ projectId: "gone" })], NOW);
    expect(r.handled).toEqual(["s1"]);
    expect(focusEvents(r.data)).toHaveLength(0);
  });

  it("records taskId null when the task no longer exists", () => {
    const r = recordFocusSessions(buildSeed(NOW), [s({ taskId: "gone" })], NOW);
    expect(focusEvents(r.data)[0]).toMatchObject({ taskId: null });
  });

  it("rounds and clamps minutes", () => {
    const r = recordFocusSessions(buildSeed(NOW), [s({ id: "a", minutes: 14.6 }), s({ id: "b", minutes: -3 }), s({ id: "c", minutes: 500 })], NOW);
    expect(focusEvents(r.data).map((e) => (e.type === "focus_session" ? e.minutes : null))).toEqual([15, 0, 240]);
  });
});

describe("buying decor", () => {
  it("buys decor like any product", () => {
    const seed = buildSeed(NOW);
    const r = purchase(seed, "pet-bed", NOW);
    expect(r.ok).toBe(true);
    expect(tokenBalance(r.data.events)).toBe(tokenBalance(seed.events) - 150);
    expect(inventory(r.data.events)["pet-bed"]).toBe(1);
  });

  it("refuses decor it can't afford", () => {
    const seed = buildSeed(NOW);
    seed.events.push({ type: "purchase", at: NOW.toISOString(), productId: "rainy-day-coat", price: tokenBalance(seed.events) - 199 });
    expect(purchase(seed, "log", NOW).ok).toBe(false);
  });
});

describe("pet lifecycle", () => {
  const input = { name: "Novel", shortName: "novel", color: "#2d3a8c", deadline: dayKey(30), description: "", petKind: "cat" as const };
  const newEgg = () => createProject(makeData({ projects: [] }), input, NOW);
  const addReq = (data: ReturnType<typeof newEgg>["data"], projectId: string, title = "R") =>
    createRequirement(data, { projectId, title, weight: 3 }, NOW);

  it("starts new projects as an egg that hasn't hatched", () => {
    const { project } = newEgg();
    expect(project.stage).toBe("egg");
    expect(project.hatchedAt).toBeNull();
  });

  it("hatches on the 3rd requirement, not the 1st or 2nd", () => {
    const { data, project } = newEgg();
    const one = addReq(data, project.id);
    expect(one.hatched).toBe(false);
    const two = addReq(one.data, project.id);
    expect(two.hatched).toBe(false);
    expect(petStage(two.data.projects[0])).toBe("egg");
    const three = addReq(two.data, project.id);
    expect(three.hatched).toBe(true);
    expect(three.data.projects[0].stage).toBe("juvenile");
    expect(three.data.projects[0].hatchedAt).toBe(NOW.toISOString());
  });

  it("counts the requirements the project has now, after deletions", () => {
    const { data, project } = newEgg();
    const two = addReq(addReq(data, project.id).data, project.id);
    const afterDelete = deleteRequirement(two.data, two.requirement.id, "unlinkTasks");
    const backToTwo = addReq(afterDelete, project.id);
    expect(backToTwo.hatched).toBe(false);
    const three = addReq(backToTwo.data, project.id);
    expect(three.hatched).toBe(true);
  });

  it("stays hatched when requirements are deleted afterwards", () => {
    const { data, project } = newEgg();
    let d = data;
    for (let i = 0; i < 3; i++) d = addReq(d, project.id).data;
    for (const r of d.requirements) d = deleteRequirement(d, r.id, "unlinkTasks");
    expect(d.requirements).toHaveLength(0);
    expect(d.projects[0].stage).toBe("juvenile");
  });

  it("never hatches or changes an adult project", () => {
    let d = makeData();
    let last = { hatched: true };
    for (let i = 0; i < 4; i++) {
      const r = addReq(d, "p1");
      d = r.data;
      last = r;
    }
    expect(last.hatched).toBe(false);
    expect(d.projects[0].stage).toBeUndefined();
  });
});

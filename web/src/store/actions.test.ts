import { describe, expect, it } from "vitest";
import { paidCompletionsOnDay, tokenBalance, inventory } from "../planner/history";
import { NOW, completed, dayKey, daysAgo, makeData, makePet, makeProject, makeRequirement, makeTask } from "../planner/testData";
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
  duplicateRequirement,
  feedPet,
  nextRequirementTitle,
  giveMedicine,
  purchase,
  recordFocusSessions,
  reopenTask,
  updateProject,
  updateRequirement,
  updateTask,
} from "./actions";
import { petStage } from "../planner/lifecycle";
import { projectHealth } from "../planner/mood";
import type { StudiumEvent } from "../planner/types";
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
    expect(tokenBalance(data)).toBe(650 + (payout?.tokens ?? 0));
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
    expect(tokenBalance(r.data)).toBe(tokenBalance(seed));
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
    expect(tokenBalance(r.data)).toBe(tokenBalance(seed) - 150);
    expect(inventory(r.data.events)["pet-bed"]).toBe(1);
  });

  it("refuses decor it can't afford", () => {
    const seed = buildSeed(NOW);
    seed.events.push({ type: "purchase", at: NOW.toISOString(), productId: "rainy-day-coat", price: tokenBalance(seed) - 199 });
    expect(purchase(seed, "log", NOW).ok).toBe(false);
  });
});

describe("pet lifecycle", () => {
  const input = { name: "Novel", shortName: "novel", color: "#2d3a8c", deadline: dayKey(30), description: "", petKind: "cat" as const };
  const newEgg = () => createProject(makeData({ projects: [] }), input, NOW);
  const addReq = (data: ReturnType<typeof newEgg>["data"], projectId: string, title = "R") =>
    createRequirement(data, { projectId, title, weight: 3 }, NOW);

  it("a new project keeps its type and difficulty", () => {
    const { project } = createProject(makeData({ projects: [] }), { ...input, type: "art", difficulty: "gentle" }, NOW);
    expect(project).toMatchObject({ type: "art", difficulty: "gentle" });
    expect("type" in newEgg().project).toBe(false); // none given: an old-style School / Steady project
  });

  it("updateProject changes type and difficulty and ignores unknown values", () => {
    const { data, project } = newEgg();
    const music = updateProject(data, project.id, { type: "music", difficulty: "strict" });
    expect(music.projects[0]).toMatchObject({ type: "music", difficulty: "strict" });
    const same = updateProject(music, project.id, { difficulty: "brutal" as never, type: "poetry" as never });
    expect(same.projects[0]).toMatchObject({ type: "music", difficulty: "strict" });
  });

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

// Prototype 9 (two commits) and Prototype 10 (one commit). P10 waits on P9 where a test says so.
function prototypes(p10BlockedBy: string[] = ["P9"]) {
  return makeData({
    requirements: [
      makeRequirement({ id: "P9", title: "Prototype 9" }),
      makeRequirement({ id: "P10", title: "Prototype 10", blockedBy: p10BlockedBy }),
    ],
    tasks: [
      makeTask({ id: "c9a", requirementId: "P9" }),
      makeTask({ id: "c9b", requirementId: "P9" }),
      makeTask({ id: "c10", requirementId: "P10" }),
    ],
  });
}
const reqOf = (data: ReturnType<typeof makeData>, id: string) => data.requirements.find((r) => r.id === id);

describe("requirement blockers", () => {
  it("saves a requirement's blockers, dropping unknown, other-project and looping ones", () => {
    const d = prototypes([]);
    d.projects.push({ ...d.projects[0], id: "p2" });
    d.requirements.push(makeRequirement({ id: "X", projectId: "p2" }));
    const next = updateRequirement(d, "P10", { blockedBy: ["P9", "gone", "X", "P10"] }, NOW);
    expect(reqOf(next, "P10")?.blockedBy).toEqual(["P9"]);
    // P9 waiting on P10 would loop now.
    expect(reqOf(updateRequirement(next, "P9", { blockedBy: ["P10"] }, NOW), "P9")?.blockedBy).toEqual([]);
    const created = createRequirement(next, { projectId: "p1", title: "Prototype 11", weight: 5, blockedBy: ["P10", "X"] }, NOW);
    expect(created.requirement.blockedBy).toEqual(["P10"]);
    expect(isValidData(created.data)).toBe(true);
  });

  it("sets blockedByAll only when allowed, and clears it with false", () => {
    const d = updateRequirement(prototypes([]), "P10", { blockedByAll: true, blockedBy: ["P9"] }, NOW);
    expect(reqOf(d, "P10")).toMatchObject({ blockedByAll: true, blockedBy: [] });
    // Only one per project.
    expect(reqOf(updateRequirement(d, "P9", { blockedByAll: true }, NOW), "P9")?.blockedByAll).toBeUndefined();
    const cleared = updateRequirement(d, "P10", { blockedByAll: false }, NOW);
    expect(reqOf(cleared, "P10")).not.toHaveProperty("blockedByAll");
    expect(isValidData(cleared)).toBe(true);
  });

  it("won't let Prototype 10's tasks be completed until Prototype 9 is finished", () => {
    let d = prototypes();
    expect(completeTask(d, "c10", null, NOW).payout).toBeNull();
    d = completeTask(d, "c9a", null, NOW).data;
    d = completeTask(d, "c9b", null, NOW).data;
    expect(completeTask(d, "c10", null, NOW).payout).not.toBeNull();
  });

  it("relocks after reopening a blocker's task but keeps done tasks done", () => {
    let d = prototypes();
    d = completeTask(d, "c9a", null, NOW).data;
    d = completeTask(d, "c9b", null, NOW).data;
    d = completeTask(d, "c10", null, NOW).data;
    d = createTask(d, { projectId: "p1", requirementId: "P10", title: "Commit 2", estimateMin: 30 }, NOW).data;
    d = reopenTask(d, "c9a", NOW);
    expect(d.tasks.find((t) => t.id === "c10")?.done).toBe(true);
    const later = d.tasks.find((t) => t.title === "Commit 2")!;
    expect(completeTask(d, later.id, null, NOW).payout).toBeNull();
  });

  it("refuses a requirement change that would loop, and keeps the old requirement", () => {
    // X is unlinked and c9a (in P9) waits on it. In P10, X would wait on P9, which waits on c9a, which waits on X.
    let d = prototypes();
    d = createTask(d, { projectId: "p1", requirementId: null, title: "X", estimateMin: 30 }, NOW).data;
    const x = d.tasks.find((t) => t.title === "X")!;
    d = updateTask(d, "c9a", { blockedBy: [x.id] }, NOW);
    expect(d.tasks.find((t) => t.id === "c9a")?.blockedBy).toEqual([x.id]);
    const next = updateTask(d, x.id, { requirementId: "P10" }, NOW);
    expect(next.tasks.find((t) => t.id === x.id)?.requirementId).toBeNull();
    expect(updateTask(d, x.id, { requirementId: "P9" }, NOW).tasks.find((t) => t.id === x.id)?.requirementId).toBe("P9");
  });

  it("drops a task's own blockers that would loop after its requirement changes", () => {
    // c9x waits on c10; moved into P9 that wait would loop (P10 waits on P9), so the wait is dropped.
    let d = prototypes();
    d = createTask(d, { projectId: "p1", requirementId: null, title: "c9x", estimateMin: 30, blockedBy: ["c10"] }, NOW).data;
    const c9x = d.tasks.find((t) => t.title === "c9x")!;
    expect(c9x.blockedBy).toEqual(["c10"]);
    const next = updateTask(d, c9x.id, { requirementId: "P9" }, NOW);
    expect(next.tasks.find((t) => t.id === c9x.id)).toMatchObject({ requirementId: "P9", blockedBy: [] });
    // c9b moving into P10 may wait on c10 there: no loop once it has left P9.
    const kept = updateTask(prototypes(), "c9b", { requirementId: "P10", blockedBy: ["c10"] }, NOW);
    expect(kept.tasks.find((t) => t.id === "c9b")).toMatchObject({ requirementId: "P10", blockedBy: ["c10"] });
  });

  it("removes a deleted requirement from other requirements' blockers", () => {
    for (const mode of ["deleteTasks", "unlinkTasks"] as const) {
      const d = deleteRequirement(prototypes(), "P9", mode);
      expect(reqOf(d, "P10")?.blockedBy).toEqual([]);
      expect(completeTask(d, "c10", null, NOW).payout).not.toBeNull();
    }
  });
});

describe("duplicating a requirement", () => {
  it("names the copy with the next number", () => {
    expect(nextRequirementTitle("Prototype 9")).toBe("Prototype 10");
    expect(nextRequirementTitle("Week 09")).toBe("Week 10");
    expect(nextRequirementTitle("Sprint 1.5")).toBe("Sprint 1.6");
    expect(nextRequirementTitle("Final report")).toBe("Final report (copy)");
    // Skips names already used in the project.
    expect(nextRequirementTitle("Prototype 9", ["Prototype 10", "prototype 11"])).toBe("Prototype 12");
    expect(nextRequirementTitle("Final report", ["Final report (copy)"])).toBe("Final report (copy 2)");
  });

  function series() {
    return makeData({
      requirements: [
        makeRequirement({ id: "P9", title: "Prototype 9", weight: 4, startDate: "2026-10-26", dueDate: "2026-11-01", blockedBy: ["P8"] }),
        makeRequirement({ id: "P8", title: "Prototype 8" }),
        makeRequirement({ id: "Z", title: "Elsewhere" }),
      ],
      tasks: [
        makeTask({ id: "x", requirementId: "Z", title: "Outside" }),
        makeTask({ id: "c9a", requirementId: "P9", title: "Git commit", estimateMin: 30, done: true, actualMin: 25, priority: true }),
        makeTask({ id: "c9b", requirementId: "P9", title: "EAS build", estimateMin: 90, blockedBy: ["c9a", "x"] }),
      ],
    });
  }

  it("copies a requirement with fresh tasks, right after the original, blocked by it", () => {
    const { data, requirement } = duplicateRequirement(series(), "P9", NOW);
    expect(requirement).toMatchObject({ title: "Prototype 10", weight: 4, blockedBy: ["P9"], startDate: "2026-11-02", dueDate: "2026-11-08" });
    expect(requirement).not.toHaveProperty("blockedByAll");
    expect(data.requirements.map((r) => r.id)).toEqual(["P9", requirement!.id, "P8", "Z"]);
    const copies = data.tasks.filter((t) => t.requirementId === requirement!.id);
    expect(copies.map((t) => [t.title, t.estimateMin, t.priority, t.done, t.actualMin])).toEqual([
      ["Git commit", 30, true, false, null],
      ["EAS build", 90, false, false, null],
    ]);
    expect(copies.every((t) => !["c9a", "c9b"].includes(t.id))).toBe(true);
    expect(copies[1].blockedBy).toEqual([copies[0].id, "x"]);
    const added = data.events.slice(-3);
    expect(added.map((e) => e.type)).toEqual(["requirement_created", "task_created", "task_created"]);
    expect(isValidData(data)).toBe(true);
  });

  it("shifts by 7 days when a date is missing, and leaves unset dates unset", () => {
    const d = series();
    d.requirements[0] = { ...d.requirements[0], startDate: null, dueDate: "2026-11-01" };
    expect(duplicateRequirement(d, "P9", NOW).requirement).toMatchObject({ startDate: null, dueDate: "2026-11-08" });
    d.requirements[0] = { ...d.requirements[0], startDate: null, dueDate: null };
    expect(duplicateRequirement(d, "P9", NOW).requirement).toMatchObject({ startDate: null, dueDate: null });
  });

  it("does nothing for an unknown requirement", () => {
    const d = series();
    expect(duplicateRequirement(d, "nope", NOW)).toEqual({ data: d, requirement: null, hatched: false });
  });

  it("counts toward hatching", () => {
    let data = createProject(makeData({ projects: [] }), { name: "App", shortName: "app", color: "#2d3a8c", deadline: dayKey(30), description: "", petKind: "cat" }, NOW).data;
    const pid = data.projects[0].id;
    const first = createRequirement(data, { projectId: pid, title: "Prototype 1", weight: 5 }, NOW);
    data = createRequirement(first.data, { projectId: pid, title: "Prototype 2", weight: 5 }, NOW).data;
    const r = duplicateRequirement(data, first.requirement.id, NOW);
    expect(r.hatched).toBe(true);
    expect(petStage(r.data.projects[0])).not.toBe("egg");
  });
});

describe("review fixes: creating tasks", () => {
  it("drops a new task's blocker that would deadlock its requirement", () => {
    // P10 waits on P9; a new P9 task waiting on c10 could never be checked off.
    const { task } = createTask(prototypes(), { projectId: "p1", requirementId: "P9", title: "X", estimateMin: 30, blockedBy: ["c10", "c9a"] }, NOW);
    expect(task.blockedBy).toEqual(["c9a"]);
  });
});

describe("pets growing up and caring", () => {
  const juvenile = () =>
    makeData({
      projects: [makeProject({ stage: "juvenile", hatchedAt: daysAgo(2), pets: [makePet({ id: "x1", stage: "adult", caresFor: "r2" })] })],
      requirements: [makeRequirement({ id: "r1" }), makeRequirement({ id: "r2" })],
      tasks: [makeTask({ id: "a" }), makeTask({ id: "e", requirementId: "r2" })],
    });

  it("completing a task reports a pet growing up", () => {
    const r = completeTask(juvenile(), "a", null, NOW);
    expect(r.data.projects[0].stage).toBe("adult");
    expect(r.news).toEqual([{ kind: "grewUp", projectId: "p1", habitatId: "p1" }]);
  });

  it("completing a task with nothing new for the pets reports no news", () => {
    const data = juvenile();
    data.tasks.push(makeTask({ id: "c" }), makeTask({ id: "d" }));
    expect(completeTask(data, "a", null, NOW).news).toEqual([]);
  });

  it("deleting a looked-after requirement sends its pet back to sharing", () => {
    expect(deleteRequirement(juvenile(), "r2", "deleteTasks").projects[0].pets?.[0].caresFor).toBeNull();
  });

  it("deleting open tasks can let a pet grow up", () => {
    const data = juvenile();
    data.events.push(completed("a", daysAgo(1), { requirementId: "r1" }));
    data.tasks = data.tasks.map((t) => (t.id === "a" ? { ...t, done: true } : t));
    data.tasks.push(makeTask({ id: "c" }), makeTask({ id: "d" }));
    expect(deleteTask(data, "d").projects[0].stage).toBe("juvenile");
    expect(deleteTask(deleteTask(data, "d"), "c").projects[0].stage).toBe("adult");
  });
});

describe("feedPet", () => {
  const HOUR = 3_600_000;
  const stock = (productId: string): StudiumEvent => ({ type: "purchase", at: daysAgo(2), productId, price: 0 });
  // r1 is half planned with 4 of 10 tasks done: a Worried steady project. p1 also has a bought pet x1.
  function worried(events: StudiumEvent[] = [], o: { stocked?: boolean; createdDaysAgo?: number } = {}) {
    const ids = Array.from({ length: 10 }, (_, i) => `t${i}`);
    const stocked = o.stocked ?? true;
    return makeData({
      projects: [makeProject({ pets: [makePet()] })],
      requirements: [makeRequirement({ id: "r1", startDate: dayKey(-10), dueDate: dayKey(10), createdAt: daysAgo(o.createdDaysAgo ?? 10) })],
      tasks: ids.map((id, i) => makeTask({ id, requirementId: "r1", done: i < 4 })),
      events: [
        ...ids.slice(0, 4).map((id) => completed(id, daysAgo(1), { requirementId: "r1" })),
        ...(stocked ? [stock("berry-bites"), stock("berry-bites"), stock("power-bento"), stock("power-bento")] : []),
        ...events,
      ],
    });
  }
  const later = (ms: number) => new Date(NOW.getTime() + ms);

  it("feeds a worried pet a snack and uses it up", () => {
    const r = feedPet(worried(), "p1", "x1", "berry-bites", NOW);
    expect(r.ok).toBe(true);
    expect(r.data.events[r.data.events.length - 1]).toEqual({ type: "fed", at: NOW.toISOString(), projectId: "p1", petId: "x1", productId: "berry-bites" });
    expect(inventory(r.data.events)["berry-bites"]).toBe(1);
  });

  it("refuses what canFeed refuses and changes nothing", () => {
    const none = worried([], { stocked: false });
    expect(feedPet(none, "p1", "p1", "berry-bites", NOW)).toEqual({ data: none, ok: false });
    const snacked = feedPet(worried(), "p1", "p1", "berry-bites", NOW).data;
    expect(feedPet(snacked, "p1", "p1", "berry-bites", later(HOUR / 2)).ok).toBe(false);
    const dined = feedPet(worried(), "p1", "p1", "power-bento", NOW).data;
    expect(feedPet(dined, "p1", "p1", "power-bento", later(HOUR)).ok).toBe(false);
  });

  it("doesn't feed a sick pet or an egg", () => {
    const sickData = worried([], { createdDaysAgo: 10 });
    sickData.events = sickData.events.filter((e) => e.type !== "task_completed");
    sickData.requirements = [makeRequirement({ id: "r1", startDate: dayKey(-20), dueDate: dayKey(10) })];
    expect(projectHealth("p1", sickData, NOW).sick).toBe(true);
    expect(feedPet(sickData, "p1", "p1", "power-bento", NOW).ok).toBe(false);
    const egg = worried();
    egg.projects = [makeProject({ pets: [makePet({ stage: "egg", hatchedAt: null, name: null })] })];
    expect(feedPet(egg, "p1", "x1", "power-bento", NOW).ok).toBe(false);
  });

  it("only feeds food, and only to a pet of that project", () => {
    expect(feedPet(worried([stock("medicine")]), "p1", "p1", "medicine", NOW).ok).toBe(false);
    expect(feedPet(worried(), "p2", "x1", "berry-bites", NOW).ok).toBe(false);
  });
});

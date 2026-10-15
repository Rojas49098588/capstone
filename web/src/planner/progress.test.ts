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

describe("plan with bad dates", () => {
  it("is a number, not NaN, when a date is empty", () => {
    const req = makeRequirement({ startDate: dayKey(-10), dueDate: null });
    expect(plannedProgress(req, makeProject({ deadline: "" }), NOW)).toBe(0);
  });
});

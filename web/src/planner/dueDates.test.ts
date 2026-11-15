import { describe, expect, it } from "vitest";
import { dayKey, makeData, makeProject, makeRequirement, makeTask } from "./testData";
import { taskDueDate, taskDueLimit } from "./dueDates";

describe("task due dates", () => {
  it("a task without its own date uses its requirement's, then the project's deadline", () => {
    const data = makeData({
      projects: [makeProject({ id: "p1", deadline: dayKey(30) })],
      requirements: [makeRequirement({ id: "r1", projectId: "p1", dueDate: dayKey(10) }), makeRequirement({ id: "r2", projectId: "p1", dueDate: null })],
    });
    expect(taskDueDate(makeTask({ projectId: "p1", requirementId: "r1" }), data)).toBe(dayKey(10));
    expect(taskDueDate(makeTask({ projectId: "p1", requirementId: "r2" }), data)).toBe(dayKey(30));
    expect(taskDueDate(makeTask({ projectId: "p1", requirementId: null }), data)).toBe(dayKey(30));
  });

  it("a task's own date wins when earlier, and is capped when its requirement's moves earlier", () => {
    const data = makeData({ projects: [makeProject({ id: "p1" })], requirements: [makeRequirement({ id: "r1", projectId: "p1", dueDate: dayKey(10) })] });
    expect(taskDueDate(makeTask({ projectId: "p1", requirementId: "r1", dueDate: dayKey(4) }), data)).toBe(dayKey(4));
    expect(taskDueDate(makeTask({ projectId: "p1", requirementId: "r1", dueDate: dayKey(12) }), data)).toBe(dayKey(10));
  });

  it("a requirement that's gone falls back to the project deadline; a missing project gives no limit", () => {
    const data = makeData({ projects: [makeProject({ id: "p1", deadline: dayKey(30) })], requirements: [] });
    expect(taskDueLimit({ projectId: "p1", requirementId: "gone" }, data)).toBe(dayKey(30));
    expect(taskDueLimit({ projectId: "nope", requirementId: null }, data)).toBeNull();
  });
});

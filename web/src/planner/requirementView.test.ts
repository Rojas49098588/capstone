import { describe, expect, it } from "vitest";
import { NOW, dayKey, makeData, makeProject, makeRequirement, makeTask } from "./testData";
import { VIEW_LABELS, isSoon, viewOf } from "./requirementView";

const project = makeProject();

describe("isSoon", () => {
  const due = (dueDate: string | null) => makeRequirement({ id: "r", dueDate });
  const open = [makeTask({ requirementId: "r" })];
  it("counts requirements due within 3 days, today included, and overdue ones", () => {
    expect(isSoon(due(dayKey(3)), project, open, NOW)).toBe(true);
    expect(isSoon(due(dayKey(4)), project, open, NOW)).toBe(false);
    expect(isSoon(due(dayKey(0)), project, open, NOW)).toBe(true);
    expect(isSoon(due(dayKey(-13)), project, open, NOW)).toBe(true);
  });
  it("leaves out finished ones", () => {
    expect(isSoon(due(dayKey(-13)), project, [makeTask({ requirementId: "r", done: true })], NOW)).toBe(false);
  });
  it("uses the project deadline when the requirement has no due date", () => {
    expect(isSoon(due(null), makeProject({ deadline: dayKey(2) }), open, NOW)).toBe(true);
    expect(isSoon(due(null), project, open, NOW)).toBe(false);
  });
  it("counts a requirement with no tasks (it isn't finished)", () => {
    expect(isSoon(due(dayKey(1)), project, [], NOW)).toBe(true);
  });
});

describe("viewOf", () => {
  const data = () =>
    makeData({
      requirements: [
        makeRequirement({ id: "soon", dueDate: dayKey(1) }),
        makeRequirement({ id: "later", dueDate: dayKey(10) }),
        makeRequirement({ id: "done", dueDate: dayKey(1) }),
        makeRequirement({ id: "empty", dueDate: dayKey(20) }),
      ],
      tasks: [
        makeTask({ id: "s1", requirementId: "soon" }),
        makeTask({ id: "s2", requirementId: "soon", done: true }),
        makeTask({ id: "l1", requirementId: "later" }),
        makeTask({ id: "d1", requirementId: "done", done: true }),
        makeTask({ id: "u1", requirementId: null }),
        makeTask({ id: "u2", requirementId: null, done: true }),
      ],
      today: { date: dayKey(0), taskIds: ["l1", "s2"] },
    });
  const ids = (v: ReturnType<typeof viewOf>) => v.requirements.map((r) => r.id);

  it("Show all shows everything", () => {
    const v = viewOf("p1", data(), "all", NOW);
    expect(ids(v)).toEqual(["soon", "later", "done", "empty"]);
    expect(v.hiddenCount).toBe(0);
    expect(v.showUnlinked).toBe(true);
    expect(v.tasksShown("soon")(makeTask({ id: "s2", done: true }))).toBe(true);
  });

  it("Today's to-do shows requirements with today's tasks, done ones included", () => {
    const v = viewOf("p1", data(), "today", NOW);
    expect(ids(v)).toEqual(["soon", "later"]);
    expect(v.hiddenCount).toBe(2);
    const d = data();
    const shown = (rid: string | null) => d.tasks.filter((t) => t.requirementId === rid && v.tasksShown(rid)(t)).map((t) => t.id);
    expect(shown("soon")).toEqual(["s2"]);
    expect(shown("later")).toEqual(["l1"]);
    expect(v.showUnlinked).toBe(false);
  });

  it("Today's to-do treats yesterday's list as empty", () => {
    const d = { ...data(), today: { date: dayKey(-1), taskIds: ["l1", "s2"] } };
    const v = viewOf("p1", d, "today", NOW);
    expect(ids(v)).toEqual([]);
    expect(v.hiddenCount).toBe(4);
  });

  it("Hide completed hides finished requirements and done tasks, but keeps one with no tasks", () => {
    const v = viewOf("p1", data(), "hideCompleted", NOW);
    expect(ids(v)).toEqual(["soon", "later", "empty"]);
    expect(v.hiddenCount).toBe(1);
    expect(v.tasksShown("soon")(makeTask({ done: true }))).toBe(false);
    expect(v.tasksShown(null)(makeTask({ done: false }))).toBe(true);
    expect(v.showUnlinked).toBe(true);
  });

  it("Soon shows unfinished requirements due within 3 days and hides Unlinked", () => {
    const v = viewOf("p1", data(), "soon", NOW);
    expect(ids(v)).toEqual(["soon"]);
    expect(v.hiddenCount).toBe(3);
    expect(v.showUnlinked).toBe(false);
  });

  it("only counts the project's own requirements", () => {
    const d = data();
    d.projects.push(makeProject({ id: "p2" }));
    d.requirements.push(makeRequirement({ id: "elsewhere", projectId: "p2" }));
    expect(viewOf("p1", d, "soon", NOW).hiddenCount).toBe(3);
  });

  it("has the menu's labels", () => {
    expect(VIEW_LABELS).toEqual({ all: "Show all", today: "Today's to-do", hideCompleted: "Hide completed", soon: "Soon" });
  });
});

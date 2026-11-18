import { describe, expect, it } from "vitest";
import { daysAgo, makeTask } from "./testData";
import { isReordered, listOf, sortListTasks } from "./order";
import type { Task } from "./types";

const ids = (tasks: Task[]) => tasks.map((t) => t.id);

describe("sortListTasks", () => {
  it("keeps today's look for a list nobody reordered", () => {
    const a = makeTask({ id: "a" });
    const b = makeTask({ id: "b", priority: true });
    const c = makeTask({ id: "c" });
    expect(isReordered([a, b, c])).toBe(false);
    expect(ids(sortListTasks([a, b, c]))).toEqual(["b", "a", "c"]);
    expect(ids(sortListTasks([a, b, { ...c, done: true }]))).toEqual(["b", "a", "c"]);
  });

  it("sorts a reordered list by order and ignores ★", () => {
    const list = [makeTask({ id: "a", order: 1 }), makeTask({ id: "b", priority: true, order: 2 }), makeTask({ id: "c", order: 0 })];
    expect(isReordered(list)).toBe(true);
    expect(ids(sortListTasks(list))).toEqual(["c", "a", "b"]);
  });

  it("puts tasks without an order after numbered ones, by createdAt then id", () => {
    const list = [
      makeTask({ id: "late", createdAt: daysAgo(1) }),
      makeTask({ id: "z", createdAt: daysAgo(5) }),
      makeTask({ id: "y", createdAt: daysAgo(5) }),
      makeTask({ id: "first", order: 0 }),
    ];
    expect(ids(sortListTasks(list))).toEqual(["first", "y", "z", "late"]);
  });

  it("a reopened task returns to its old place", () => {
    const a = makeTask({ id: "a", order: 0 });
    const b = makeTask({ id: "b", order: 1, done: true });
    const c = makeTask({ id: "c", order: 2 });
    expect(ids(sortListTasks([a, b, c]))).toEqual(["a", "c", "b"]);
    expect(ids(sortListTasks([a, { ...b, done: false }, c]))).toEqual(["a", "b", "c"]);
  });

  it("done tasks don't make a list count as reordered", () => {
    expect(isReordered([makeTask({ id: "a" }), makeTask({ id: "b", done: true, order: 3 })])).toBe(false);
  });
});

describe("listOf", () => {
  it("separates requirements and Unlinked", () => {
    const tasks = [
      makeTask({ id: "r1a" }),
      makeTask({ id: "u1", requirementId: null }),
      makeTask({ id: "r2a", requirementId: "r2" }),
      makeTask({ id: "u2", requirementId: null }),
      makeTask({ id: "other", projectId: "p2", requirementId: null }),
    ];
    expect(ids(listOf({ projectId: "p1", requirementId: "r1" }, tasks))).toEqual(["r1a"]);
    expect(ids(listOf({ projectId: "p1", requirementId: null }, tasks))).toEqual(["u1", "u2"]);
  });
});

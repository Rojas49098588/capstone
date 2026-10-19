import { describe, expect, it } from "vitest";
import { taskFocusMinutes, focusMinutes } from "./focus";
import { NOW, completed, daysAgo, makeTask } from "./testData";
import { startOfWeek } from "./time";
import type { StudiumEvent } from "./types";

function session(o: Partial<Extract<StudiumEvent, { type: "focus_session" }>> = {}): StudiumEvent {
  return {
    type: "focus_session",
    id: "s1",
    projectId: "p1",
    taskId: "t1",
    startedAt: daysAgo(0),
    at: NOW.toISOString(),
    minutes: 15,
    ...o,
  };
}

describe("focusMinutes", () => {
  it("sums by project, task and since", () => {
    const events = [
      session({ id: "a" }),
      session({ id: "b", taskId: "t2", minutes: 10 }),
      session({ id: "c", projectId: "p2", taskId: null, minutes: 20, at: daysAgo(8) }),
      completed("t1", daysAgo(0)),
    ];
    expect(focusMinutes(events, {})).toBe(45);
    expect(focusMinutes(events, { projectId: "p1" })).toBe(25);
    expect(focusMinutes(events, { taskId: "t1" })).toBe(15);
    expect(focusMinutes(events, { since: startOfWeek(NOW) })).toBe(25);
  });
});

describe("taskFocusMinutes", () => {
  it("counts only since the task was created or last reopened", () => {
    const task = makeTask({ id: "t1", createdAt: daysAgo(10) });
    const before = session({ id: "a", minutes: 30, at: daysAgo(5) });
    const after = session({ id: "b", minutes: 15, at: daysAgo(1) });
    const reopened: StudiumEvent = { type: "task_reopened", at: daysAgo(2), taskId: "t1" };
    expect(taskFocusMinutes(task, [before, reopened, after])).toBe(15);
    expect(taskFocusMinutes(task, [before, after])).toBe(45);
    expect(taskFocusMinutes(makeTask({ id: "t1", createdAt: daysAgo(3) }), [before, after])).toBe(15);
  });
});

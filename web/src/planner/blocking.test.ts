import { describe, expect, it } from "vitest";
import {
  blockerOptions,
  canBlockByAll,
  downstreamOpenCount,
  isBlocked,
  openRequirementBlockers,
  requirementBlockerIds,
  requirementBlockerOptions,
  waitingOn,
  wouldRequirementChangeLoop,
  wouldTaskBlockerLoop,
  type BlockData,
} from "./blocking";
import { makeRequirement, makeTask } from "./testData";
import type { Requirement, Task } from "./types";

const A = makeTask({ id: "A" });
const B = makeTask({ id: "B", blockedBy: ["A"] });
const C = makeTask({ id: "C", blockedBy: ["B"] });
const tasksOnly = (tasks: Task[]): BlockData => ({ tasks, requirements: [] });

describe("task blocking", () => {
  it("is blocked only by open blockers it can find", () => {
    expect(isBlocked(B, tasksOnly([A, B]))).toBe(true);
    expect(isBlocked(B, tasksOnly([{ ...A, done: true }, B]))).toBe(false);
    // A blocker that was deleted must not block forever.
    expect(isBlocked(makeTask({ id: "X", blockedBy: ["gone"] }), tasksOnly([A]))).toBe(false);
    expect(waitingOn(B, tasksOnly([A, B]))).toEqual([{ kind: "task", task: A }]);
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
    expect(wouldTaskBlockerLoop("A", "C", tasksOnly([A, B, C]))).toBe(true); // C already depends on A
    expect(wouldTaskBlockerLoop("A", "A", tasksOnly([A]))).toBe(true);
    expect(wouldTaskBlockerLoop("C", "A", tasksOnly([A, B, C]))).toBe(false);
  });

  it("offers only same-project blockers that don't make loops", () => {
    const other = makeTask({ id: "O", projectId: "p2" });
    expect(blockerOptions("A", tasksOnly([A, B, C, other])).map((t) => t.id)).toEqual([]);
    expect(blockerOptions("C", tasksOnly([A, B, C, other])).map((t) => t.id)).toEqual(["A", "B"]);
  });
});

// Prototype 9 has two commits; Prototype 10 waits on Prototype 9.
const P9 = makeRequirement({ id: "P9", title: "Prototype 9" });
const P10 = makeRequirement({ id: "P10", title: "Prototype 10", blockedBy: ["P9"] });
const c9a = makeTask({ id: "c9a", requirementId: "P9", title: "Git commit" });
const c9b = makeTask({ id: "c9b", requirementId: "P9", title: "Git commit" });
const c10 = makeTask({ id: "c10", requirementId: "P10", title: "Git commit" });
const data: BlockData = { requirements: [P9, P10], tasks: [c9a, c9b, c10] };

function withTasks(d: BlockData, changes: Record<string, Partial<Task>>): BlockData {
  return { ...d, tasks: d.tasks.map((t) => (changes[t.id] ? { ...t, ...changes[t.id] } : t)) };
}
function withRequirements(d: BlockData, ...extra: Requirement[]): BlockData {
  return { ...d, requirements: [...d.requirements, ...extra] };
}

describe("requirement blocking", () => {
  it("locks a requirement's tasks until its blocker is finished", () => {
    expect(isBlocked(c10, data)).toBe(true);
    expect(waitingOn(c10, data)).toEqual([{ kind: "requirement", requirement: P9 }]);
    expect(isBlocked(c10, withTasks(data, { c9a: { done: true } }))).toBe(true);
    const done = withTasks(data, { c9a: { done: true }, c9b: { done: true } });
    expect(isBlocked(c10, done)).toBe(false);
    expect(isBlocked(c9a, data)).toBe(false);
  });

  it("an empty blocker requirement stays unfinished", () => {
    const P8 = makeRequirement({ id: "P8", title: "Prototype 8" });
    const d = withRequirements({ requirements: [{ ...P9, blockedBy: ["P8"] }], tasks: [c9a] }, P8);
    expect(isBlocked(c9a, d)).toBe(true);
    expect(openRequirementBlockers({ ...P9, blockedBy: ["P8"] }, d)).toEqual([P8]);
  });

  it("blockedByAll waits on every other requirement, including ones added later", () => {
    const final = makeRequirement({ id: "F", title: "Final", blockedByAll: true });
    const sub = makeTask({ id: "sub", requirementId: "F" });
    let d: BlockData = { requirements: [P9, final], tasks: [c9a, sub] };
    expect(requirementBlockerIds(final, d.requirements)).toEqual(["P9"]);
    expect(isBlocked(sub, d)).toBe(true);
    d = withTasks(d, { c9a: { done: true } });
    expect(isBlocked(sub, d)).toBe(false);
    const P11 = makeRequirement({ id: "P11", title: "Prototype 11" });
    d = { requirements: [...d.requirements, P11], tasks: [...d.tasks, makeTask({ id: "c11", requirementId: "P11" })] };
    expect(waitingOn(sub, d)).toEqual([{ kind: "requirement", requirement: P11 }]);
    // Requirements in other projects don't count.
    const elsewhere = makeRequirement({ id: "X", projectId: "p2" });
    expect(requirementBlockerIds(final, [...d.requirements, elsewhere])).toEqual(["P9", "P11"]);
  });

  it("combines task and requirement blockers in one list, tasks first", () => {
    const other = makeTask({ id: "o", requirementId: null, title: "Design review" });
    const blocked = { ...c10, blockedBy: ["o"] };
    const d: BlockData = { requirements: [P9, P10], tasks: [c9a, c9b, blocked, other] };
    expect(waitingOn(blocked, d)).toEqual([
      { kind: "task", task: other },
      { kind: "requirement", requirement: P9 },
    ]);
  });

  it("ignores requirement blockers that no longer exist or are in another project", () => {
    const elsewhere = makeRequirement({ id: "X", projectId: "p2" });
    const lonely = { ...P10, blockedBy: ["gone", "X"] };
    const d: BlockData = { requirements: [lonely, elsewhere], tasks: [c10, makeTask({ id: "x1", projectId: "p2", requirementId: "X" })] };
    expect(requirementBlockerIds(lonely, d.requirements)).toEqual([]);
    expect(isBlocked(c10, d)).toBe(false);
  });

  it("finds loops that mix task and requirement blockers", () => {
    // P10 waits on P9; a P9 task waiting on c10 would deadlock.
    expect(wouldTaskBlockerLoop("c9a", "c10", data)).toBe(true);
    expect(blockerOptions("c9a", data).map((t) => t.id)).toEqual(["c9b"]);
    expect(wouldTaskBlockerLoop("c10", "c9a", data)).toBe(false);
  });

  it("doesn't offer a requirement blocker that would loop", () => {
    expect(requirementBlockerOptions("P9", data).map((r) => r.id)).toEqual([]);
    expect(requirementBlockerOptions("P10", data).map((r) => r.id)).toEqual(["P9"]);
    // A loop through a task blocker counts too: c9a waits on c10, so P10 can't wait on P9.
    const viaTask: BlockData = { requirements: [P9, { ...P10, blockedBy: [] }], tasks: [{ ...c9a, blockedBy: ["c10"] }, c9b, c10] };
    expect(requirementBlockerOptions("P10", viaTask)).toEqual([]);
  });

  it("allows only one blockedByAll per project, and never as a blocker", () => {
    const final = makeRequirement({ id: "F", title: "Final", blockedByAll: true });
    const d = withRequirements(data, final);
    expect(canBlockByAll("P9", d)).toBe(false);
    expect(canBlockByAll("F", d)).toBe(true);
    expect(requirementBlockerOptions("P9", d).map((r) => r.id)).not.toContain("F");
    expect(canBlockByAll("P9", data)).toBe(false); // P10 already waits on P9
    expect(canBlockByAll("P10", data)).toBe(true);
  });

  it("detects a requirement change that would loop", () => {
    // c9x is unlinked and waits on c10; moving it into P9 would make P10 wait on itself.
    const c9x = makeTask({ id: "c9x", requirementId: null, blockedBy: ["c10"] });
    const d: BlockData = { ...data, tasks: [...data.tasks, c9x] };
    expect(isBlocked(c9x, d)).toBe(true);
    expect(wouldRequirementChangeLoop("c9x", "P9", d)).toBe(true);
    expect(wouldRequirementChangeLoop("c9x", "P10", d)).toBe(false);
    expect(wouldRequirementChangeLoop("c9x", null, d)).toBe(false);
  });
});

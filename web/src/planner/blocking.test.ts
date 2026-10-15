import { describe, expect, it } from "vitest";
import { blockerOptions, downstreamOpenCount, isBlocked, openBlockers, wouldCreateCycle } from "./blocking";
import { makeTask } from "./testData";

const A = makeTask({ id: "A" });
const B = makeTask({ id: "B", blockedBy: ["A"] });
const C = makeTask({ id: "C", blockedBy: ["B"] });

describe("blocking", () => {
  it("is blocked only by open blockers it can find", () => {
    expect(isBlocked(B, [A, B])).toBe(true);
    expect(isBlocked(B, [{ ...A, done: true }, B])).toBe(false);
    // A blocker that was deleted must not block forever.
    expect(isBlocked(makeTask({ id: "X", blockedBy: ["gone"] }), [A])).toBe(false);
    expect(openBlockers(B, [A, B]).map((t) => t.id)).toEqual(["A"]);
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
    expect(wouldCreateCycle("A", "C", [A, B, C])).toBe(true); // C already depends on A
    expect(wouldCreateCycle("A", "A", [A])).toBe(true);
    expect(wouldCreateCycle("C", "A", [A, B, C])).toBe(false);
  });

  it("offers only same-project blockers that don't make loops", () => {
    const other = makeTask({ id: "O", projectId: "p2" });
    expect(blockerOptions("A", [A, B, C, other]).map((t) => t.id)).toEqual([]);
    expect(blockerOptions("C", [A, B, C, other]).map((t) => t.id)).toEqual(["A", "B"]);
  });
});

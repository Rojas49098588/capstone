import { describe, expect, it } from "vitest";
import { NOW, completed, daysAgo, makeData, makeRequirement, makeTask } from "./testData";
import { ZERO_BREAKDOWN, type StudiumEvent } from "./types";
import { computeCompletionPayout, dailyCurve, expectedTokens, neglectBonus, unblockBonus } from "./value";

/** The spec's worked example: weight 6, tasks of 2 h, 1 h, 3 h; the 1 h task unblocks two tasks; 7 days idle. */
function specExample(extraEvents: StudiumEvent[] = []) {
  return makeData({
    requirements: [
      makeRequirement({ id: "r1", weight: 6, createdAt: daysAgo(7) }),
      makeRequirement({ id: "r2", weight: 4, createdAt: daysAgo(1) }),
    ],
    tasks: [
      makeTask({ id: "t1", estimateMin: 120 }),
      makeTask({ id: "t2", estimateMin: 60 }),
      makeTask({ id: "t3", estimateMin: 180 }),
      makeTask({ id: "x1", requirementId: "r2", blockedBy: ["t2"] }),
      makeTask({ id: "x2", requirementId: "r2", blockedBy: ["t2"] }),
    ],
    events: extraEvents,
  });
}

describe("bonus curves", () => {
  it("gives +15% per unblocked task up to +60%", () => {
    const tasks = [makeTask({ id: "a" }), ...Array.from({ length: 6 }, (_, i) => makeTask({ id: `d${i}`, blockedBy: ["a"] }))];
    expect(unblockBonus("a", tasks)).toBe(0.6);
    expect(unblockBonus("a", tasks.slice(0, 3))).toBeCloseTo(0.3, 6);
  });

  it("gives +5% per idle day beyond 5, up to +50%, doubled while recovering", () => {
    expect(neglectBonus(5, false)).toBe(0);
    expect(neglectBonus(7, false)).toBeCloseTo(0.1, 6);
    expect(neglectBonus(30, false)).toBe(0.5);
    expect(neglectBonus(7, true)).toBeCloseTo(0.2, 6);
    expect(neglectBonus(30, true)).toBe(1);
  });

  it("pays the first 5 completions in full, then decays to a floor", () => {
    expect(dailyCurve(1)).toBe(1);
    expect(dailyCurve(5)).toBe(1);
    expect(dailyCurve(6)).toBeCloseTo(0.8, 6);
    expect(dailyCurve(7)).toBeCloseTo(0.64, 6);
    expect(dailyCurve(20)).toBe(0.25);
  });
});

describe("computeCompletionPayout", () => {
  it("matches the spec's worked example: 29 tokens", () => {
    const payout = computeCompletionPayout(specExample(), "t2", 60, NOW);
    expect(payout.breakdown.base).toBeCloseTo(70, 6);
    expect(payout.breakdown.unblockBonus).toBeCloseTo(0.3, 6);
    expect(payout.breakdown.neglectBonus).toBeCloseTo(0.1, 6);
    expect(payout.breakdown.finish).toBe(0);
    expect(payout.tokens).toBe(29);
  });

  it("pays the finish bonus when the last task is done", () => {
    const data = makeData({
      requirements: [makeRequirement({ weight: 6 })],
      tasks: [makeTask({ id: "a", done: true }), makeTask({ id: "b" })],
      events: [completed("a", daysAgo(1))],
    });
    const payout = computeCompletionPayout(data, "b", 60, NOW);
    expect(payout.breakdown.base).toBeCloseTo(210, 6);
    expect(payout.breakdown.finish).toBeCloseTo(180, 6);
    expect(payout.tokens).toBe(117);
  });

  it("pays the finish bonus only once per requirement", () => {
    const data = makeData({
      requirements: [makeRequirement({ weight: 6 })],
      tasks: [makeTask({ id: "a", done: true }), makeTask({ id: "c" })],
      events: [completed("a", daysAgo(1), { tokens: 117, breakdown: { ...ZERO_BREAKDOWN, finish: 180 } })],
    });
    const payout = computeCompletionPayout(data, "c", 60, NOW);
    expect(payout.breakdown.finish).toBe(0);
    expect(payout.tokens).toBe(63);
  });

  it("pays nothing for a task that was completed before", () => {
    const data = specExample([completed("t2", daysAgo(2), { tokens: 29 })]);
    expect(computeCompletionPayout(data, "t2", 60, NOW)).toEqual({ tokens: 0, breakdown: ZERO_BREAKDOWN });
  });

  it("pays nothing for an unlinked task", () => {
    const data = makeData({ tasks: [makeTask({ id: "u", requirementId: null })] });
    expect(computeCompletionPayout(data, "u", 60, NOW).tokens).toBe(0);
  });

  it("applies the daily curve after 5 paid completions today", () => {
    const earlier = Array.from({ length: 5 }, (_, i) =>
      completed(`other${i}`, new Date(NOW.getTime() - 3_600_000).toISOString(), { tokens: 10 }),
    );
    const payout = computeCompletionPayout(specExample(earlier), "t2", 60, NOW);
    expect(payout.breakdown.dailyCurve).toBeCloseTo(0.8, 6);
    expect(payout.tokens).toBe(24); // 70 × 1.4 × 0.8 × 0.3 = 23.52
  });

  it("halves tokens while the project is sick", () => {
    const data = makeData({
      requirements: [makeRequirement({ weight: 6, createdAt: daysAgo(15) })],
      tasks: [makeTask({ id: "a" }), makeTask({ id: "b" })],
    });
    const payout = computeCompletionPayout(data, "a", 60, NOW);
    expect(payout.breakdown.sickMultiplier).toBe(0.5);
    expect(payout.breakdown.neglectBonus).toBe(0.5);
    expect(payout.tokens).toBe(47); // 210 × 1.5 × 0.5 × 0.3 = 47.25
  });

  it("doubles the neglect bonus while recovering and drops the sick penalty", () => {
    const data = makeData({
      requirements: [makeRequirement({ weight: 6, createdAt: daysAgo(15) })],
      tasks: [makeTask({ id: "a" }), makeTask({ id: "b" })],
      events: [{ type: "medicine_given", at: daysAgo(1), projectId: "p1" }],
    });
    const payout = computeCompletionPayout(data, "a", 60, NOW);
    expect(payout.breakdown.sickMultiplier).toBe(1);
    expect(payout.breakdown.neglectBonus).toBe(1);
    expect(payout.tokens).toBe(126); // 210 × 2 × 0.3
  });
});

describe("expectedTokens", () => {
  it("estimates an open task's tokens without the daily curve", () => {
    // Open t2: effort 60 of 360 → base 70; +30% unblock, +10% neglect → 29.4
    expect(expectedTokens(specExample().tasks[1], specExample(), NOW)).toBe(29);
  });

  it("is 0 for done or unlinked tasks", () => {
    const data = makeData({ tasks: [makeTask({ id: "u", requirementId: null })] });
    expect(expectedTokens(data.tasks[0], data, NOW)).toBe(0);
    expect(expectedTokens(makeTask({ done: true }), specExample(), NOW)).toBe(0);
  });
});

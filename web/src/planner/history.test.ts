import { describe, expect, it } from "vitest";
import {
  finishBonusPaid,
  hasBeenCompleted,
  inventory,
  lastCompletionAt,
  lastMedicineGiven,
  paidCompletionsOnDay,
  tokenBalance,
} from "./history";
import { NOW, completed, daysAgo, dayKey } from "./testData";
import { ZERO_BREAKDOWN, type StudiumEvent } from "./types";

describe("history", () => {
  it("knows whether a task was ever completed", () => {
    const events = [completed("t1", daysAgo(1))];
    expect(hasBeenCompleted(events, "t1")).toBe(true);
    expect(hasBeenCompleted(events, "t2")).toBe(false);
  });

  it("finds the latest completion among some tasks, ignoring events after asOf", () => {
    const events = [completed("t1", daysAgo(5)), completed("t2", daysAgo(2)), completed("t1", daysAgo(-1))];
    expect(lastCompletionAt(events, ["t1", "t2"], NOW)?.toISOString()).toBe(daysAgo(2));
    expect(lastCompletionAt(events, ["t1"], NOW)?.toISOString()).toBe(daysAgo(5));
    expect(lastCompletionAt(events, ["t3"], NOW)).toBeNull();
  });

  it("computes the token balance from completions and purchases", () => {
    const events: StudiumEvent[] = [
      completed("t1", daysAgo(1), { tokens: 30 }),
      { type: "purchase", at: daysAgo(1), productId: "medicine", price: 80 },
      completed("t2", daysAgo(0), { tokens: 12 }),
    ];
    expect(tokenBalance(events)).toBe(650 + 30 - 80 + 12);
  });

  it("counts inventory and uses up medicine when given", () => {
    const events: StudiumEvent[] = [
      { type: "purchase", at: daysAgo(3), productId: "medicine", price: 80 },
      { type: "purchase", at: daysAgo(3), productId: "medicine", price: 80 },
      { type: "purchase", at: daysAgo(2), productId: "focus-ball", price: 75 },
      { type: "medicine_given", at: daysAgo(1), projectId: "p1" },
    ];
    expect(inventory(events)).toEqual({ medicine: 1, "focus-ball": 1 });
  });

  it("counts only paid completions on the given local day", () => {
    const events = [
      completed("a", daysAgo(0.1), { tokens: 10 }),
      completed("b", daysAgo(0.2), { tokens: 0 }), // re-completion, not paid
      completed("c", daysAgo(1), { tokens: 10 }), // yesterday
    ];
    expect(paidCompletionsOnDay(events, dayKey(0))).toBe(1);
  });

  it("finds the last medicine given to a project", () => {
    const events: StudiumEvent[] = [
      { type: "medicine_given", at: daysAgo(5), projectId: "p1" },
      { type: "medicine_given", at: daysAgo(1), projectId: "p2" },
    ];
    expect(lastMedicineGiven(events, "p1", NOW)?.toISOString()).toBe(daysAgo(5));
    expect(lastMedicineGiven(events, "p2", new Date(NOW.getTime() - 3 * 86_400_000))).toBeNull();
  });

  it("knows whether a requirement's finish bonus was already paid", () => {
    const paid = completed("t1", daysAgo(1), { tokens: 50, requirementId: "r1", breakdown: { ...ZERO_BREAKDOWN, finish: 150 } });
    expect(finishBonusPaid([paid], "r1")).toBe(true);
    expect(finishBonusPaid([paid], "r2")).toBe(false);
    expect(finishBonusPaid([completed("t1", daysAgo(1), { requirementId: "r1" })], "r1")).toBe(false);
  });
});

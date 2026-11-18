import { describe, expect, it } from "vitest";
import {
  finishBonusPaid,
  hasBeenCompleted,
  inventory,
  lastCompletionAt,
  lastMedicineGiven,
  paidCompletionsOnDay,
  retiredRefund,
  tokenBalance,
} from "./history";
import { NOW, completed, daysAgo, dayKey } from "./testData";
import { ZERO_BREAKDOWN, type StudiumEvent } from "./types";

describe("removed products and food tokens", () => {
  const buy = (productId: string, price: number): StudiumEvent => ({ type: "purchase", at: daysAgo(3), productId, price });
  const clothes = [buy("scholar-scarf", 120), buy("rainy-day-coat", 180), buy("rainy-day-coat", 180)];

  it("gives back what was paid for clothes and the Puzzle Cube", () => {
    const rest = [buy("medicine", 80)];
    expect(tokenBalance({ events: [...rest, ...clothes, buy("puzzle-cube", 150)] })).toBe(tokenBalance({ events: rest }));
  });
  it("stops listing them in the inventory", () => {
    const counts = inventory([...clothes, buy("puzzle-cube", 150), buy("focus-ball", 75)]);
    expect(counts["scholar-scarf"]).toBeUndefined();
    expect(counts["rainy-day-coat"]).toBeUndefined();
    expect(counts["puzzle-cube"]).toBeUndefined();
    expect(counts["focus-ball"]).toBe(1);
  });
  it("says how much came back", () => {
    expect(retiredRefund(clothes)).toEqual({ tokens: 480, count: 3 });
    expect(retiredRefund([buy("medicine", 80)])).toEqual({ tokens: 0, count: 0 });
  });
  it("pays a feeding's tokens only when a copy was owned, so two offline devices can't both cash one", () => {
    const fed = (petId: string): StudiumEvent => ({ type: "fed", at: daysAgo(1), projectId: "p1", petId, productId: "sour-gummies", tokens: 23 });
    const events: StudiumEvent[] = [buy("sour-gummies", 40), fed("p1"), fed("x1")];
    expect(tokenBalance({ events, startingTokens: 100 })).toBe(100 - 40 + 23);
  });

  it("adds a feeding's tokens, and nothing for older feedings", () => {
    const fed = (o: object = {}): StudiumEvent => ({ type: "fed", at: daysAgo(1), projectId: "p1", petId: "p1", productId: "sour-gummies", ...o });
    const owned = buy("sour-gummies", 0);
    expect(tokenBalance({ events: [owned, fed({ tokens: 23 })], startingTokens: 100 })).toBe(123);
    expect(tokenBalance({ events: [owned, fed()], startingTokens: 100 })).toBe(100);
  });
});

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
    expect(tokenBalance({ events })).toBe(650 + 30 - 80 + 12);
  });

  it("starts new data at 100 and older data at 650", () => {
    expect(tokenBalance({ events: [], startingTokens: 100 })).toBe(100);
    expect(tokenBalance({ events: [] })).toBe(650);
    expect(tokenBalance({ events: [{ type: "purchase", at: NOW.toISOString(), productId: "berry-bites", price: 35 }], startingTokens: 100 })).toBe(65);
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

  it("uses up a food when a pet eats it", () => {
    const events: StudiumEvent[] = [
      { type: "purchase", at: daysAgo(3), productId: "berry-bites", price: 35 },
      { type: "purchase", at: daysAgo(3), productId: "berry-bites", price: 35 },
      { type: "fed", at: daysAgo(1), projectId: "p1", petId: "p1", productId: "berry-bites" },
    ];
    expect(inventory(events)).toEqual({ "berry-bites": 1 });
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

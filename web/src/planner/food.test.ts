import { describe, expect, it } from "vitest";
import { canFeed, foodKind, liftMood, mealBoostUntil, snackLiftUntil, withSnack } from "./food";
import type { ProjectMood } from "./mood";
import { findPet } from "./pets";
import { NOW, makeData, makePet, makeProject } from "./testData";
import { MEAL_PRODUCT_ID, SNACK_PRODUCT_ID } from "./tuning";
import type { Mood, StudiumData, StudiumEvent } from "./types";

const HOUR = 3_600_000;
const at = (ms: number) => new Date(ms).toISOString();
const ago = (ms: number) => at(NOW.getTime() - ms);
const snack = (when: string, petId = "p1"): StudiumEvent => ({ type: "fed", at: when, projectId: "p1", petId, productId: SNACK_PRODUCT_ID });
const meal = (when: string, petId = "p1"): StudiumEvent => ({ type: "fed", at: when, projectId: "p1", petId, productId: MEAL_PRODUCT_ID });
const bought = (productId: string): StudiumEvent => ({ type: "purchase", at: ago(48 * HOUR), productId, price: 0 });

function moodOf(mood: Mood, health: Partial<ProjectMood["health"]> = {}): ProjectMood {
  return { mood, gap: 0, neglected: [], health: { sick: false, recovering: false, recoveringFor: [], ...health }, liftedFrom: null };
}

/** Project p1 with a bought pet x1; both foods owned twice unless `events` says otherwise. */
function data(events: StudiumEvent[] = [], stocked = true, pet = makePet()): StudiumData {
  const stock = stocked ? [bought(SNACK_PRODUCT_ID), bought(SNACK_PRODUCT_ID), bought(MEAL_PRODUCT_ID), bought(MEAL_PRODUCT_ID)] : [];
  return makeData({ projects: [makeProject({ pets: [pet] })], events: [...stock, ...events] });
}

describe("foodKind", () => {
  it("knows the two foods and nothing else", () => {
    expect(foodKind(SNACK_PRODUCT_ID)).toBe("snack");
    expect(foodKind(MEAL_PRODUCT_ID)).toBe("meal");
    expect(foodKind("medicine")).toBeNull();
  });
});

describe("liftMood", () => {
  it("lifts Upset and Worried one step and leaves the rest", () => {
    expect(liftMood("Upset")).toBe("Worried");
    expect(liftMood("Worried")).toBe("Happy");
    for (const m of ["Happy", "Delighted", "Proud", "Sick"] as Mood[]) expect(liftMood(m)).toBe(m);
  });
});

describe("snackLiftUntil", () => {
  it("runs for 2 hours after a snack", () => {
    expect(snackLiftUntil([snack(ago(HOUR))], "p1", NOW)).toEqual(new Date(NOW.getTime() + HOUR));
  });
  it("is over at exactly 2 hours", () => {
    expect(snackLiftUntil([snack(ago(2 * HOUR))], "p1", NOW)).toBeNull();
  });
  it("belongs to the pet that ate it", () => {
    expect(snackLiftUntil([snack(ago(HOUR), "x1")], "p1", NOW)).toBeNull();
  });
  it("ignores a snack stamped in the future", () => {
    expect(snackLiftUntil([snack(at(NOW.getTime() + HOUR))], "p1", NOW)).toBeNull();
  });
});

describe("mealBoostUntil", () => {
  it("runs for 4 hours after a meal", () => {
    expect(mealBoostUntil([meal(ago(HOUR))], "p1", NOW)).toEqual(new Date(NOW.getTime() + 3 * HOUR));
  });
  it("is over at exactly 4 hours", () => {
    expect(mealBoostUntil([meal(ago(4 * HOUR))], "p1", NOW)).toBeNull();
  });
  it("is moved 4 hours later by a second pet's meal while it runs", () => {
    const events = [meal(ago(HOUR)), meal(ago(HOUR / 2), "x1")];
    expect(mealBoostUntil(events, "p1", NOW)).toEqual(new Date(NOW.getTime() + 7 * HOUR));
  });
  it("is for the project the pet belongs to", () => {
    const other: StudiumEvent = { type: "fed", at: ago(HOUR), projectId: "p2", petId: "p2", productId: MEAL_PRODUCT_ID };
    expect(mealBoostUntil([other], "p1", NOW)).toBeNull();
  });
  it("extends across midnight", () => {
    const events = [meal(at(new Date(2026, 9, 13, 23, 30).getTime())), meal(at(new Date(2026, 9, 14, 0, 10).getTime()))];
    expect(mealBoostUntil(events, "p1", new Date(2026, 9, 14, 1, 0))).toEqual(new Date(2026, 9, 14, 7, 30));
  });
});

describe("withSnack", () => {
  it("lifts a Worried pet that ate in the last 2 hours", () => {
    const m = withSnack(moodOf("Worried"), "p1", [snack(ago(HOUR))], NOW);
    expect(m.mood).toBe("Happy");
    expect(m.liftedFrom).toBe("Worried");
  });
  it("changes nothing without a snack", () => {
    expect(withSnack(moodOf("Worried"), "p1", [], NOW)).toEqual(moodOf("Worried"));
  });
  it("never lifts a Sick or Recovering pet", () => {
    const sick = moodOf("Sick", { sick: true });
    const recovering = moodOf("Worried", { recovering: true });
    expect(withSnack(sick, "p1", [snack(ago(HOUR))], NOW)).toEqual(sick);
    expect(withSnack(recovering, "p1", [snack(ago(HOUR))], NOW)).toEqual(recovering);
  });
  it("leaves a pet that is already Happy as it is", () => {
    expect(withSnack(moodOf("Happy"), "p1", [snack(ago(HOUR))], NOW)).toEqual(moodOf("Happy"));
  });
});

describe("canFeed a snack", () => {
  const first = (d: StudiumData) => findPet(d, "p1")!;

  it("refuses an egg", () => {
    const d = data([], true, makePet({ stage: "egg", hatchedAt: null, name: null }));
    expect(canFeed(d, findPet(d, "x1")!, null, "snack", NOW)).toEqual({ ok: false, reason: "egg", nextAt: null });
  });
  it("refuses a Sick pet", () => {
    const d = data();
    expect(canFeed(d, first(d), moodOf("Sick", { sick: true }), "snack", NOW)).toMatchObject({ ok: false, reason: "sick" });
  });
  it("refuses a Recovering pet", () => {
    const d = data();
    expect(canFeed(d, first(d), moodOf("Worried", { recovering: true }), "snack", NOW)).toMatchObject({ ok: false, reason: "recovering" });
  });
  it("makes the pet wait 3 hours between snacks", () => {
    const d = data([snack(ago(HOUR / 2))]);
    const lifted = { ...moodOf("Happy"), liftedFrom: "Worried" as Mood };
    expect(canFeed(d, first(d), lifted, "snack", NOW)).toEqual({
      ok: false,
      reason: "wait",
      nextAt: new Date(NOW.getTime() + 2.5 * HOUR),
    });
  });
  it("is not hungry when Happy", () => {
    const d = data();
    expect(canFeed(d, first(d), moodOf("Happy"), "snack", NOW)).toMatchObject({ ok: false, reason: "not-hungry" });
  });
  it("needs a snack in the inventory", () => {
    const d = data([], false);
    expect(canFeed(d, first(d), moodOf("Worried"), "snack", NOW)).toMatchObject({ ok: false, reason: "none-owned" });
  });
  it("feeds a Worried pet", () => {
    const d = data();
    expect(canFeed(d, first(d), moodOf("Worried"), "snack", NOW)).toEqual({ ok: true, extendsBoost: false });
  });
  it("is refused at 2 hours, once the lift is over, and allowed at exactly 3 hours", () => {
    expect(canFeed(data([snack(ago(2 * HOUR))]), first(data()), moodOf("Upset"), "snack", NOW)).toMatchObject({ ok: false, reason: "wait" });
    const d = data([snack(ago(3 * HOUR))]);
    expect(canFeed(d, first(d), moodOf("Upset"), "snack", NOW)).toEqual({ ok: true, extendsBoost: false });
  });
});

describe("canFeed a meal", () => {
  const first = (d: StudiumData) => findPet(d, "p1")!;

  it("allows one meal a day, again from local midnight", () => {
    const d = data([meal(ago(HOUR))]);
    expect(canFeed(d, first(d), moodOf("Happy"), "meal", NOW)).toEqual({
      ok: false,
      reason: "wait",
      nextAt: new Date(2026, 9, 15),
    });
  });
  it("allows a meal the day after", () => {
    const d = data([meal(ago(24 * HOUR))]);
    expect(canFeed(d, first(d), moodOf("Happy"), "meal", NOW)).toEqual({ ok: true, extendsBoost: false });
  });
  it("allows a meal just after midnight, extending the running boost", () => {
    const d = data([meal(at(new Date(2026, 9, 13, 23, 30).getTime()))]);
    expect(canFeed(d, first(d), moodOf("Happy"), "meal", new Date(2026, 9, 14, 0, 5))).toEqual({ ok: true, extendsBoost: true });
  });
  it("lets another pet eat and says it extends the boost", () => {
    const d = data([meal(ago(HOUR), "x1")]);
    expect(canFeed(d, first(d), moodOf("Happy"), "meal", NOW)).toEqual({ ok: true, extendsBoost: true });
  });
  it("needs a meal in the inventory", () => {
    const d = data([], false);
    expect(canFeed(d, first(d), moodOf("Worried"), "meal", NOW)).toMatchObject({ ok: false, reason: "none-owned" });
  });
});

import { describe, expect, it } from "vitest";
import { canFeed, foodKind, liftMood, mealBoostUntil, mealMultiplier, runningBoosts, snackLiftUntil, snackWaitHours, withSnack } from "./food";
import { FAVORITE_FLAVOR, FOODS, findFood, isFavorite } from "./foods";
import type { ProjectMood } from "./mood";
import { findPet } from "./pets";
import { NOW, makeData, makePet, makeProject, makeRequirement, makeTask } from "./testData";
import { FAVORITE_BONUS_SHARE, MEAL_PRODUCT_ID, SNACK_PRODUCT_ID, SNACK_WAIT_HOURS } from "./tuning";
import type { Mood, PetKind, StudiumData, StudiumEvent } from "./types";
import { computeCompletionPayout } from "./value";

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
  const stock = stocked ? FOODS.flatMap((f) => [bought(f.id), bought(f.id)]) : [];
  return makeData({ projects: [makeProject({ pets: [pet] })], events: [...stock, ...events] });
}

describe("foodKind", () => {
  it("knows the catalog's foods and nothing else", () => {
    expect(foodKind("plain-crackers")).toBe("snack");
    expect(foodKind("meaty-stew")).toBe("meal");
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
    expect(canFeed(d, findPet(d, "x1")!, null, SNACK_PRODUCT_ID, NOW)).toEqual({ ok: false, reason: "egg", nextAt: null });
  });
  it("refuses a Sick pet", () => {
    const d = data();
    expect(canFeed(d, first(d), moodOf("Sick", { sick: true }), SNACK_PRODUCT_ID, NOW)).toMatchObject({ ok: false, reason: "sick" });
  });
  it("refuses a Recovering pet", () => {
    const d = data();
    expect(canFeed(d, first(d), moodOf("Worried", { recovering: true }), SNACK_PRODUCT_ID, NOW)).toMatchObject({ ok: false, reason: "recovering" });
  });
  it("makes the pet wait 3 hours between snacks", () => {
    const d = data([snack(ago(HOUR / 2))]);
    const lifted = { ...moodOf("Happy"), liftedFrom: "Worried" as Mood };
    expect(canFeed(d, first(d), lifted, SNACK_PRODUCT_ID, NOW)).toEqual({
      ok: false,
      reason: "wait",
      nextAt: new Date(NOW.getTime() + 2.5 * HOUR),
    });
  });
  it("is not hungry when Happy", () => {
    const d = data();
    expect(canFeed(d, first(d), moodOf("Happy"), SNACK_PRODUCT_ID, NOW)).toMatchObject({ ok: false, reason: "not-hungry" });
  });
  it("needs a snack in the inventory", () => {
    const d = data([], false);
    expect(canFeed(d, first(d), moodOf("Worried"), SNACK_PRODUCT_ID, NOW)).toMatchObject({ ok: false, reason: "none-owned" });
  });
  it("feeds a Worried pet", () => {
    const d = data();
    expect(canFeed(d, first(d), moodOf("Worried"), SNACK_PRODUCT_ID, NOW)).toEqual({ ok: true, extendsBoost: false });
  });
  it("is refused at 2 hours, once the lift is over, and allowed at exactly 3 hours", () => {
    expect(canFeed(data([snack(ago(2 * HOUR))]), first(data()), moodOf("Upset"), SNACK_PRODUCT_ID, NOW)).toMatchObject({ ok: false, reason: "wait" });
    const d = data([snack(ago(3 * HOUR))]);
    expect(canFeed(d, first(d), moodOf("Upset"), SNACK_PRODUCT_ID, NOW)).toEqual({ ok: true, extendsBoost: false });
  });
});

describe("canFeed a meal", () => {
  const first = (d: StudiumData) => findPet(d, "p1")!;

  it("allows one meal a day, again from local midnight", () => {
    const d = data([meal(ago(HOUR))]);
    expect(canFeed(d, first(d), moodOf("Happy"), MEAL_PRODUCT_ID, NOW)).toEqual({
      ok: false,
      reason: "wait",
      nextAt: new Date(2026, 9, 15),
    });
  });
  it("allows a meal the day after", () => {
    const d = data([meal(ago(24 * HOUR))]);
    expect(canFeed(d, first(d), moodOf("Happy"), MEAL_PRODUCT_ID, NOW)).toEqual({ ok: true, extendsBoost: false });
  });
  it("allows a meal just after midnight, extending the running boost", () => {
    const d = data([meal(at(new Date(2026, 9, 13, 23, 30).getTime()))]);
    expect(canFeed(d, first(d), moodOf("Happy"), MEAL_PRODUCT_ID, new Date(2026, 9, 14, 0, 5))).toEqual({ ok: true, extendsBoost: true });
  });
  it("lets another pet eat and says it extends the boost", () => {
    const d = data([meal(ago(HOUR), "x1")]);
    expect(canFeed(d, first(d), moodOf("Happy"), MEAL_PRODUCT_ID, NOW)).toEqual({ ok: true, extendsBoost: true });
  });
  it("needs a meal in the inventory", () => {
    const d = data([], false);
    expect(canFeed(d, first(d), moodOf("Worried"), MEAL_PRODUCT_ID, NOW)).toMatchObject({ ok: false, reason: "none-owned" });
  });
});

const fedAt = (productId: string, when: Date, petId = "p1", projectId = "p1"): StudiumEvent => ({ type: "fed", at: when.toISOString(), projectId, petId, productId });
const day = (h: number, m = 0, d = 14) => new Date(2026, 9, d, h, m);

describe("the food catalog", () => {
  it("has the 8 foods with the spec's flavors and prices", () => {
    expect(FOODS.map((f) => [f.id, f.kind, f.flavor, f.price])).toEqual([
      ["plain-crackers", "snack", "bland", 10],
      ["berry-bites", "snack", "sweet", 35],
      ["sour-gummies", "snack", "sour", 40],
      ["seed-crunch", "snack", "seedy", 50],
      ["plain-rice", "meal", "bland", 15],
      ["power-bento", "meal", "savory", 60],
      ["garden-salad", "meal", "leafy", 55],
      ["meaty-stew", "meal", "meaty", 50],
    ]);
    expect(findFood("medicine")).toBeUndefined();
  });
  it("gives each kind of pet its favorite flavor, and never bland", () => {
    expect(FAVORITE_FLAVOR).toEqual({ cat: "savory", dog: "meaty", frog: "sour", pigeon: "seedy", turtle: "leafy" });
    expect(isFavorite("sour-gummies", "frog")).toBe(true);
    expect(isFavorite("sour-gummies", "cat")).toBe(false);
    expect(isFavorite("plain-rice", "cat")).toBe(false);
  });
  it("every snack's lift ends before the shortest snack wait", () => {
    for (const f of FOODS) {
      if (f.effect.type !== "lift") continue;
      expect(f.effect.hours).toBeLessThan(2.5);
      expect(f.effect.hours).toBeLessThan(SNACK_WAIT_HOURS);
    }
  });
  it("no food pays back its price", () => {
    const kinds: PetKind[] = ["cat", "dog", "frog", "pigeon", "turtle"];
    for (const f of FOODS) {
      for (const k of kinds) {
        const instant = f.effect.type === "tokens" ? f.effect.tokens : 0;
        const gift = isFavorite(f.id, k) ? Math.floor(f.price * FAVORITE_BONUS_SHARE) : 0;
        expect(instant + gift).toBeLessThan(f.price);
      }
    }
  });
});

describe("the new foods' rules", () => {
  const first = (d: StudiumData) => findPet(d, "p1")!;

  it("bland food uses up the snack and the meal slot", () => {
    const d1 = data([fedAt("plain-crackers", day(9))]);
    expect(canFeed(d1, first(d1), moodOf("Worried"), "berry-bites", day(10))).toEqual({ ok: false, reason: "wait", nextAt: day(12) });
    const d2 = data([fedAt("plain-rice", day(9))]);
    expect(canFeed(d2, first(d2), moodOf("Happy"), "power-bento", day(10))).toEqual({ ok: false, reason: "wait", nextAt: day(0, 0, 15) });
  });
  it("Sour Gummies can be fed to a Happy pet but not a Sick one", () => {
    const d = data();
    expect(canFeed(d, first(d), moodOf("Happy"), "sour-gummies", NOW)).toEqual({ ok: true, extendsBoost: false });
    expect(canFeed(d, first(d), moodOf("Sick", { sick: true }), "sour-gummies", NOW)).toMatchObject({ ok: false, reason: "sick" });
  });
  it("a lifting snack still needs a Worried or Upset pet", () => {
    const d = data();
    expect(canFeed(d, first(d), moodOf("Happy"), "seed-crunch", NOW)).toMatchObject({ ok: false, reason: "not-hungry" });
  });
  it("counts what's owned per food", () => {
    const d = makeData({ projects: [makeProject({ pets: [makePet()] })], events: [bought("berry-bites")] });
    expect(canFeed(d, first(d), moodOf("Worried"), "seed-crunch", NOW)).toMatchObject({ ok: false, reason: "none-owned" });
    expect(canFeed(d, first(d), moodOf("Worried"), "berry-bites", NOW)).toMatchObject({ ok: true });
  });
  it("lift length follows the snack eaten", () => {
    const crackers = [fedAt("plain-crackers", day(9))];
    expect(snackLiftUntil(crackers, "p1", day(9, 59))).not.toBeNull();
    expect(snackLiftUntil(crackers, "p1", day(10))).toBeNull();
    const crunch = [fedAt("seed-crunch", day(9))];
    expect(snackLiftUntil(crunch, "p1", day(11, 14))).not.toBeNull();
    expect(snackLiftUntil(crunch, "p1", day(11, 15))).toBeNull();
  });
  it("Sour Gummies lift nothing", () => {
    expect(snackLiftUntil([fedAt("sour-gummies", day(9))], "p1", day(9, 30))).toBeNull();
  });
  it("Meaty Stew shortens this pet's snack wait until midnight", () => {
    const events = [fedAt("meaty-stew", day(8)), fedAt("berry-bites", day(9))];
    const d = data(events);
    expect(snackWaitHours(events, "p1", day(10))).toBe(2.5);
    expect(canFeed(d, first(d), moodOf("Worried"), "berry-bites", day(11, 29))).toMatchObject({ ok: false, reason: "wait", nextAt: day(11, 30) });
    expect(canFeed(d, first(d), moodOf("Worried"), "berry-bites", day(11, 30))).toMatchObject({ ok: true });
    expect(snackWaitHours(events, "p1", day(23, 59))).toBe(2.5);
    expect(snackWaitHours(events, "p1", day(0, 0, 15))).toBe(3);
    expect(snackWaitHours(events, "x1", day(10))).toBe(3);
  });
  it("the highest running boost counts, not the product", () => {
    const events = [fedAt("garden-salad", day(9)), fedAt("power-bento", day(10), "x1")];
    expect(mealMultiplier(events, "p1", day(11))).toBe(1.1);
    expect(mealMultiplier(events, "p1", day(14, 30))).toBe(1.05);
    expect(mealMultiplier(events, "p1", day(23, 59))).toBe(1.05);
    expect(mealMultiplier(events, "p1", day(0, 0, 15))).toBe(1);
    expect(mealBoostUntil(events, "p1", day(11))).toEqual(day(14));
  });
  it("only Bento extends a running Bento", () => {
    const bentos = [fedAt("power-bento", day(9)), fedAt("power-bento", day(10), "x1")];
    expect(runningBoosts(bentos, "p1", day(11))).toEqual([{ productId: "power-bento", multiplier: 1.1, until: day(17) }]);
    const mixed = [fedAt("plain-rice", day(9)), fedAt("power-bento", day(10), "x1")];
    expect(runningBoosts(mixed, "p1", day(11))).toEqual([
      { productId: "plain-rice", multiplier: 1.03, until: day(13) },
      { productId: "power-bento", multiplier: 1.1, until: day(14) },
    ]);
  });
  it("says a Bento extends only a running Bento", () => {
    const d = data([fedAt("plain-rice", day(9), "x1")]);
    expect(canFeed(d, first(d), moodOf("Happy"), "power-bento", day(10))).toEqual({ ok: true, extendsBoost: false });
  });
  it("an old save's Berry Bites and Power Bento behave as before", () => {
    const old: StudiumEvent[] = [
      { type: "fed", at: day(9).toISOString(), projectId: "p1", petId: "p1", productId: "berry-bites" },
      { type: "fed", at: day(9).toISOString(), projectId: "p1", petId: "p1", productId: "power-bento" },
      { type: "fed", at: day(10).toISOString(), projectId: "p1", petId: "x1", productId: "power-bento" },
    ];
    expect(snackLiftUntil(old, "p1", day(10))).toEqual(day(11));
    expect(mealMultiplier(old, "p1", day(16, 59))).toBe(1.1);
    expect(mealBoostUntil(old, "p1", day(12))).toEqual(day(17));
  });
  it("value uses the meal multiplier", () => {
    const d = makeData({
      requirements: [makeRequirement({ weight: 6 })],
      tasks: [makeTask({ id: "a" }), makeTask({ id: "b" })],
      events: [fedAt("garden-salad", new Date(NOW.getTime() - HOUR))],
    });
    expect(computeCompletionPayout(d, "a", 60, NOW).breakdown.foodMultiplier).toBe(1.05);
  });
});

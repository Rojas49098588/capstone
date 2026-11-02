import { describe, expect, it } from "vitest";
import { giveMedicine } from "../store/actions";
import { lastMedicineGiven } from "./history";
import { projectHealth, projectMood } from "./mood";
import { findPet, petMood } from "./pets";
import { NOW, completed, dayKey, daysAgo, makeData, makePet, makeProject, makeRequirement, makeTask } from "./testData";
import { MEDICINE_PRODUCT_ID } from "./tuning";
import type { StudiumData, StudiumEvent } from "./types";

// r1 is on track (half done, half planned). r2 started 20 days ago and nothing has moved since:
// idle past a steady project's 14 sick days.
function family(pet = makePet({ id: "x1", stage: "adult", caresFor: "r2" }), events: StudiumEvent[] = []): StudiumData {
  return makeData({
    projects: [makeProject({ pets: [pet] })],
    requirements: [
      makeRequirement({ id: "r1", startDate: dayKey(-10), dueDate: dayKey(10) }),
      makeRequirement({ id: "r2", startDate: dayKey(-20), dueDate: dayKey(20) }),
    ],
    tasks: [
      makeTask({ id: "a", requirementId: "r1", done: true }),
      makeTask({ id: "b", requirementId: "r1" }),
      makeTask({ id: "e", requirementId: "r2", createdAt: daysAgo(25) }),
    ],
    events: [completed("a", daysAgo(1), { requirementId: "r1" }), ...events],
  });
}
const bought = (id: string): StudiumEvent => ({ type: "purchase", at: daysAgo(2), productId: id, price: 0 });
const dose = (petId?: string): StudiumEvent => ({ type: "medicine_given", at: daysAgo(1), projectId: "p1", ...(petId ? { petId } : {}) });
const pet = (data: StudiumData, id = "x1") => findPet(data, id)!;

describe("petMood", () => {
  it("is the project's mood for a pet that shares it", () => {
    const data = family(makePet({ id: "x1", stage: "adult", caresFor: null }));
    expect(petMood(pet(data), data, NOW)).toEqual(projectMood("p1", data, NOW));
    expect(petMood(pet(data, "p1"), data, NOW)).toEqual(projectMood("p1", data, NOW));
  });

  it("is null for an egg", () => {
    const data = family(makePet({ id: "x1", stage: "egg", hatchedAt: null, name: null }));
    expect(petMood(pet(data), data, NOW)).toBeNull();
  });

  it("comes from the looked-after requirement alone", () => {
    const data = family();
    const m = petMood(pet(data), data, NOW)!;
    expect(m.mood).toBe("Sick");
    expect(m.neglected.map((n) => n.requirement.id)).toEqual(["r2"]);
  });

  it("is healthy and on track for a requirement that is moving", () => {
    const data = family(makePet({ id: "x1", stage: "adult", caresFor: "r1" }));
    const m = petMood(pet(data), data, NOW)!;
    expect(m.health.sick).toBe(false);
    expect(m.neglected).toEqual([]);
    expect(m.gap).toBeCloseTo(0, 0);
  });
});

describe("medicine for one pet", () => {
  it("a pet's own dose leaves the project's health alone", () => {
    const data = family(undefined, [dose("x1")]);
    expect(projectHealth("p1", data, NOW).sick).toBe(true);
    expect(petMood(pet(data), data, NOW)).toMatchObject({ mood: "Upset", health: { sick: false, recovering: true } }) // far behind; recovery only caps at Worried;
  });

  it("the project's dose leaves a pet with its own health sick", () => {
    const data = family(undefined, [dose()]);
    expect(projectHealth("p1", data, NOW).recovering).toBe(true);
    expect(petMood(pet(data), data, NOW)?.health.sick).toBe(true);
  });

  it("finds doses for the project or for one pet, never mixed up", () => {
    const events = [dose("x1")];
    expect(lastMedicineGiven(events, "p1", NOW)).toBeNull();
    expect(lastMedicineGiven(events, "p1", NOW, "x1")?.toISOString()).toBe(daysAgo(1));
    expect(lastMedicineGiven([dose()], "p1", NOW, "x1")).toBeNull();
  });

  it("giveMedicine for a pet saves its id and uses one dose", () => {
    const data = family(undefined, [bought(MEDICINE_PRODUCT_ID)]);
    const r = giveMedicine(data, "p1", NOW, "x1");
    expect(r.ok).toBe(true);
    expect(r.data.events[r.data.events.length - 1]).toEqual({ type: "medicine_given", at: NOW.toISOString(), projectId: "p1", petId: "x1" });
  });

  it("giveMedicine refuses a pet that isn't sick, or that shares the project's health", () => {
    const healthy = family(makePet({ id: "x1", stage: "adult", caresFor: "r1" }), [bought(MEDICINE_PRODUCT_ID)]);
    expect(giveMedicine(healthy, "p1", NOW, "x1")).toEqual({ data: healthy, ok: false });
    const sharing = family(makePet({ id: "x1", stage: "adult", caresFor: null }), [bought(MEDICINE_PRODUCT_ID)]);
    expect(giveMedicine(sharing, "p1", NOW, "x1")).toEqual({ data: sharing, ok: false });
  });
});

// r1 runs from 10 days ago to 10 days from now (50% planned) and has 10 equal tasks: `done` of them
// were finished yesterday, so 4 done is Worried, 5 Happy and 2 Upset for a steady project.
function scheduled(done: number, events: StudiumEvent[] = [], extra = makePet({ id: "x1", stage: "adult", caresFor: null })): StudiumData {
  const ids = Array.from({ length: 10 }, (_, i) => `t${i}`);
  return makeData({
    projects: [makeProject({ pets: [extra] })],
    requirements: [makeRequirement({ id: "r1", startDate: dayKey(-10), dueDate: dayKey(10) })],
    tasks: ids.map((id, i) => makeTask({ id, requirementId: "r1", done: i < done })),
    events: [...ids.slice(0, done).map((id) => completed(id, daysAgo(1), { requirementId: "r1" })), ...events],
  });
}
const snackFor = (petId: string): StudiumEvent => ({
  type: "fed",
  at: new Date(NOW.getTime() - 3_600_000).toISOString(),
  projectId: "p1",
  petId,
  productId: "berry-bites",
});

describe("petMood with a snack", () => {
  it("lifts only the pet that ate it", () => {
    const data = scheduled(4, [snackFor("x1")]);
    expect(projectMood("p1", data, NOW).mood).toBe("Worried");
    const m = petMood(pet(data), data, NOW)!;
    expect(m.mood).toBe("Happy");
    expect(m.liftedFrom).toBe("Worried");
    expect(petMood(pet(data, "p1"), data, NOW)!.mood).toBe("Worried");
    expect(projectHealth("p1", data, NOW)).toEqual(projectHealth("p1", scheduled(4), NOW));
  });

  it("lifts a pet looking after a requirement", () => {
    const data = scheduled(4, [snackFor("x1")], makePet({ id: "x1", stage: "adult", caresFor: "r1" }));
    expect(petMood(pet(data), data, NOW)).toMatchObject({ mood: "Happy", liftedFrom: "Worried" });
  });

  it("follows the schedule while it lifts: never past Happy, and Upset shows Worried", () => {
    const happy = scheduled(5, [snackFor("x1")]);
    expect(petMood(pet(happy), happy, NOW)).toMatchObject({ mood: "Happy", liftedFrom: null });
    const upset = scheduled(2, [snackFor("x1")]);
    expect(petMood(pet(upset), upset, NOW)).toMatchObject({ mood: "Worried", liftedFrom: "Upset" });
  });
});

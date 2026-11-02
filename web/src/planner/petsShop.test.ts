import { describe, expect, it } from "vitest";
import { buyEgg, purchase, setUpPet } from "../store/actions";
import { DEFAULT_BED, ownedCopies } from "../store/decor";
import { tokenBalance } from "./history";
import { eggProductId, eggRefusal, suggestedPetName } from "./pets";
import { NOW, makeData, makePet, makeProject, makeRequirement, makeTask } from "./testData";
import { EGG_PRICE, MAX_PETS_PER_PROJECT } from "./tuning";
import type { ExtraPet, StudiumData } from "./types";

const egg = (id: string): ExtraPet => makePet({ id, stage: "egg", hatchedAt: null, name: null });
const rich = (o: Partial<StudiumData> = {}) => makeData({ startingTokens: EGG_PRICE, ...o });

describe("egg rules", () => {
  it("prices eggs at 400 and allows 4 pets per project", () => {
    expect(EGG_PRICE).toBe(400);
    expect(MAX_PETS_PER_PROJECT).toBe(4);
    expect(eggProductId("frog")).toBe("egg-frog");
  });

  it("refuses an egg while the first pet is an egg, another egg waits, or the project is full", () => {
    expect(eggRefusal(makeProject({ stage: "egg", hatchedAt: null }))).toBe("firstEgg");
    expect(eggRefusal(makeProject({ pets: [makePet(), egg("x2")] }))).toBe("eggWaiting");
    expect(eggRefusal(makeProject({ pets: [makePet({ id: "a" }), makePet({ id: "b" }), makePet({ id: "c" })] }))).toBe("full");
    expect(eggRefusal(makeProject({ pets: [makePet()] }))).toBeNull();
    expect(eggRefusal(makeProject())).toBeNull();
  });
});

describe("suggestedPetName", () => {
  it("numbers a name already taken in the project", () => {
    expect(suggestedPetName(makeProject(), "frog")).toBe("Frog");
    expect(suggestedPetName(makeProject({ pets: [makePet({ name: "frog" })] }), "frog")).toBe("Frog 2");
    expect(suggestedPetName(makeProject({ pets: [makePet({ id: "a", name: "Frog" }), makePet({ id: "b", name: "Frog 2" })] }), "frog")).toBe("Frog 3");
    expect(suggestedPetName(makeProject({ shortName: "Cat" }), "cat")).toBe("Cat 2");
  });
});

describe("buyEgg", () => {
  it("spends 400 tokens and adds an egg with its own habitat and bed", () => {
    const data = rich();
    const r = buyEgg(data, "p1", "dog", NOW);
    expect(r.ok).toBe(true);
    expect(tokenBalance(r.data)).toBe(0);
    const bought = r.data.projects[0].pets?.[0];
    expect(bought).toEqual({ id: r.habitatId, kind: "dog", stage: "egg", boughtAt: NOW.toISOString(), hatchedAt: null, name: null, caresFor: null });
    expect(r.data.decor?.[r.habitatId as string]).toEqual({ floorMiddle: DEFAULT_BED.id });
    expect(ownedCopies(r.data, DEFAULT_BED.id)).toBe(ownedCopies(data, DEFAULT_BED.id) + 1);
    expect(r.data.events[r.data.events.length - 1]).toEqual({ type: "purchase", at: NOW.toISOString(), productId: "egg-dog", price: 400 });
  });

  it("refuses without spending anything", () => {
    const poor = makeData({ startingTokens: EGG_PRICE - 1 });
    const refusals: StudiumData[] = [
      poor,
      rich({ projects: [makeProject({ stage: "egg", hatchedAt: null })] }),
      rich({ projects: [makeProject({ pets: [egg("x2")] })] }),
      rich({ projects: [makeProject({ pets: [makePet({ id: "a" }), makePet({ id: "b" }), makePet({ id: "c" })] })] }),
    ];
    for (const data of refusals) expect(buyEgg(data, "p1", "cat", NOW)).toEqual({ data, ok: false, habitatId: null });
    const data = rich();
    expect(buyEgg(data, "nope", "cat", NOW)).toEqual({ data, ok: false, habitatId: null });
  });

  it("can't be bought as a plain product", () => {
    const data = rich();
    expect(purchase(data, "egg-cat", NOW)).toEqual({ data, ok: false });
  });
});

describe("setUpPet", () => {
  const hatched = () =>
    makeData({
      projects: [makeProject({ pets: [makePet({ id: "x1", name: null })] }), makeProject({ id: "p2" })],
      requirements: [makeRequirement({ id: "r1" }), makeRequirement({ id: "rDone" }), makeRequirement({ id: "rOther", projectId: "p2" })],
      tasks: [makeTask({ id: "a" }), makeTask({ id: "z", requirementId: "rDone", done: true })],
    });
  const pet = (data: StudiumData) => data.projects[0].pets?.[0];

  it("names a pet and chooses its requirement", () => {
    expect(pet(setUpPet(hatched(), "p1", "x1", { name: "  Ribbit ", caresFor: "r1" }))).toMatchObject({ name: "Ribbit", caresFor: "r1" });
  });

  it("uses the suggested name for a blank one and cuts long names to 20", () => {
    expect(pet(setUpPet(hatched(), "p1", "x1", { name: "   " }))?.name).toBe("Frog");
    expect(pet(setUpPet(hatched(), "p1", "x1", { name: "x".repeat(30) }))?.name).toBe("x".repeat(20));
  });

  it("shares the project's mood for a finished or another project's requirement", () => {
    expect(pet(setUpPet(hatched(), "p1", "x1", { caresFor: "rDone" }))?.caresFor).toBeNull();
    expect(pet(setUpPet(hatched(), "p1", "x1", { caresFor: "rOther" }))?.caresFor).toBeNull();
  });

  it("changes only what it's given", () => {
    const named = setUpPet(hatched(), "p1", "x1", { name: "Ribbit", caresFor: "r1" });
    expect(pet(setUpPet(named, "p1", "x1", { caresFor: null }))).toMatchObject({ name: "Ribbit", caresFor: null });
  });

  it("refuses an egg, the first pet, and unknown pets", () => {
    const data = makeData({ projects: [makeProject({ pets: [egg("x1")] })] });
    expect(setUpPet(data, "p1", "x1", { name: "Early" })).toBe(data);
    expect(setUpPet(data, "p1", "p1", { name: "First" })).toBe(data);
    expect(setUpPet(data, "p1", "ghost", { name: "Who" })).toBe(data);
  });
});

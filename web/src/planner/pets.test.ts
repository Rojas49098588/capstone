import { describe, expect, it } from "vitest";
import { findPet, habitatIds, petsOf } from "./pets";
import { makeData, makePet, makeProject } from "./testData";

describe("petsOf", () => {
  it("is just the first pet for a project without bought pets", () => {
    expect(petsOf(makeProject())).toEqual([
      {
        projectId: "p1",
        petId: "p1",
        habitatId: "p1",
        kind: "cat",
        stage: "adult",
        name: "proj",
        caresFor: null,
        hatchedAt: makeProject().hatchedAt,
        first: true,
      },
    ]);
  });

  it("lists bought pets after the first, each with its own habitat", () => {
    const pets = petsOf(makeProject({ pets: [makePet({ id: "x1", stage: "egg", hatchedAt: null, name: null })] }));
    expect(pets).toHaveLength(2);
    expect(pets[1]).toMatchObject({ projectId: "p1", petId: "x1", habitatId: "x1", kind: "frog", stage: "egg", first: false });
  });
});

describe("habitatIds and findPet", () => {
  const data = makeData({
    projects: [makeProject({ pets: [makePet({ id: "x1" })] }), makeProject({ id: "p2" })],
  });

  it("lists every habitat in project order", () => {
    expect(habitatIds(data)).toEqual(["p1", "x1", "p2"]);
  });

  it("finds a pet by its habitat id", () => {
    expect(findPet(data, "x1")).toMatchObject({ projectId: "p1", first: false });
    expect(findPet(data, "p2")).toMatchObject({ projectId: "p2", first: true });
    expect(findPet(data, "ghost")).toBeUndefined();
  });
});

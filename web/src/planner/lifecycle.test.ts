import { describe, expect, it } from "vitest";
import { hatchIfReady, petStage, requirementsToHatch } from "./lifecycle";
import { NOW, makeData, makeProject, makeRequirement } from "./testData";
import type { PetStage } from "./types";

const reqs = (n: number) => Array.from({ length: n }, (_, i) => makeRequirement({ id: `r${i}` }));
const withStage = (stage: PetStage | undefined, n: number) =>
  makeData({
    projects: [makeProject(stage === "egg" ? { stage, hatchedAt: null } : stage ? { stage } : {})],
    requirements: reqs(n),
  });

describe("petStage", () => {
  it("is adult for projects saved before stages existed", () => {
    expect(petStage(makeProject())).toBe("adult");
  });

  it("is the saved stage when there is one", () => {
    expect(petStage(makeProject({ stage: "egg", hatchedAt: null }))).toBe("egg");
    expect(petStage(makeProject({ stage: "juvenile" }))).toBe("juvenile");
  });
});

describe("requirementsToHatch", () => {
  it("counts down to 3 requirements for an egg", () => {
    const data0 = withStage("egg", 0);
    expect(requirementsToHatch(data0.projects[0], data0)).toBe(3);
    const data2 = withStage("egg", 2);
    expect(requirementsToHatch(data2.projects[0], data2)).toBe(1);
  });

  it("is 0 for an egg that already has 3 or more", () => {
    const data = withStage("egg", 4);
    expect(requirementsToHatch(data.projects[0], data)).toBe(0);
  });

  it("is 0 for hatched pets, whatever the count", () => {
    for (const stage of ["juvenile", "adult", undefined] as const) {
      const data = withStage(stage, 0);
      expect(requirementsToHatch(data.projects[0], data)).toBe(0);
    }
  });
});

describe("hatchIfReady", () => {
  it("hatches an egg with 3 requirements into a juvenile", () => {
    const r = hatchIfReady(withStage("egg", 3), "p1", NOW);
    expect(r.hatched).toBe(true);
    expect(r.data.projects[0].stage).toBe("juvenile");
    expect(r.data.projects[0].hatchedAt).toBe(NOW.toISOString());
  });

  it("leaves an egg with 2 requirements alone", () => {
    const data = withStage("egg", 2);
    const r = hatchIfReady(data, "p1", NOW);
    expect(r.hatched).toBe(false);
    expect(r.data).toBe(data);
  });

  it("never re-hatches a juvenile or an adult", () => {
    expect(hatchIfReady(withStage("juvenile", 5), "p1", NOW).hatched).toBe(false);
    expect(hatchIfReady(withStage(undefined, 5), "p1", NOW).hatched).toBe(false);
  });
});

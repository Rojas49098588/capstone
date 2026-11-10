import { describe, expect, it } from "vitest";
import { tokenBalance } from "../planner/history";
import { NOW } from "../planner/testData";
import type { ExtraPet, Project, StudiumData, Task } from "../planner/types";
import { emptyData } from "../store/seed";
import { hasMoreProgress, summarize, type SaveSummary } from "./saveSummary";

const at = NOW.toISOString();
const project = (id: string, shortName: string, stage: Project["stage"], pets: ExtraPet[] = []): Project => ({
  id, name: id, shortName, color: "#000000", deadline: "2026-12-01", description: "", petKind: "cat", stage, hatchedAt: null, createdAt: at, pets,
});
const pet = (id: string, stage: ExtraPet["stage"], name: string | null): ExtraPet => ({ id, kind: "frog", stage, boughtAt: at, hatchedAt: null, name, caresFor: null });
const task = (id: string, done: boolean): Task => ({
  id, projectId: "a", requirementId: null, title: id, estimateMin: 5, blockedBy: [], priority: false, done, actualMin: null, createdAt: at,
});

describe("summarize", () => {
  it("counts projects, tokens, done tasks and adult pets, lists 3 pets and how many more", () => {
    const data: StudiumData = {
      ...emptyData(NOW),
      startingTokens: 40,
      projects: [project("a", "Ada", undefined, [pet("a2", "adult", "Fern"), pet("a3", "egg", null)]), project("b", "Bo", "juvenile", [pet("b2", "adult", "Moss")])],
      tasks: [task("t1", true), task("t2", true), task("t3", false)],
      events: [{ type: "purchase", at, productId: "berry-bites", price: 35 }],
    };
    const s = summarize(data, { savedAt: at, savedBy: "Laptop" });
    expect(s).toMatchObject({ savedAt: at, savedBy: "Laptop", projects: 2, tokens: tokenBalance(data), tasksDone: 2, petsGrownUp: 3, more: 2 });
    expect(s.tokens).toBe(5);
    expect(s.pets).toEqual([
      { name: "Ada", kind: "cat", stage: "adult" },
      { name: "Fern", kind: "frog", stage: "adult" },
      { name: "Unnamed", kind: "frog", stage: "egg" },
    ]);
    expect(summarize(data, null)).toMatchObject({ savedAt: null, savedBy: null });
  });
});

describe("hasMoreProgress", () => {
  const summary = (tasksDone: number, tokens: number, projects: number): SaveSummary => ({
    savedAt: null, savedBy: null, projects, tokens, tasksDone, petsGrownUp: 0, pets: [],
  });

  it("the save with more done tasks has more progress", () => {
    expect(hasMoreProgress(summary(3, 0, 1), summary(2, 999, 9))).toBe(true);
    expect(hasMoreProgress(summary(2, 999, 9), summary(3, 0, 1))).toBe(false);
    // Then tokens, then projects; a tie is not more.
    expect(hasMoreProgress(summary(2, 10, 1), summary(2, 5, 9))).toBe(true);
    expect(hasMoreProgress(summary(2, 5, 2), summary(2, 5, 1))).toBe(true);
    expect(hasMoreProgress(summary(2, 5, 1), summary(2, 5, 1))).toBe(false);
  });
});

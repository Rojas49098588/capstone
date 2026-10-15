import { describe, expect, it } from "vitest";
import { tokenBalance } from "../planner/history";
import { projectMood } from "../planner/mood";
import { NOW } from "../planner/testData";
import { buildSeed } from "./seed";
import { isValidData } from "./storage";

const LATE = new Date(2026, 9, 14, 23, 30);
const EARLY = new Date(2026, 9, 14, 0, 5);

describe.each([
  ["noon", NOW],
  ["late evening", LATE],
  ["just after midnight", EARLY],
])("buildSeed at %s", (_label, now) => {
  const seed = buildSeed(now);
  const mood = (id: string) => projectMood(id, seed, now);

  it("is valid, fully linked data with a 650-token balance", () => {
    expect(isValidData(seed)).toBe(true);
    expect(seed.projects.map((p) => p.id)).toEqual(["webDev", "appDev", "Animation", "seniorCap", "petExt"]);
    expect(seed.tasks.every((t) => t.requirementId !== null)).toBe(true);
    const ids = new Set(seed.tasks.map((t) => t.id));
    expect(seed.tasks.flatMap((t) => t.blockedBy).every((id) => ids.has(id))).toBe(true);
    expect(seed.tasks.some((t) => t.blockedBy.length > 0)).toBe(true);
    expect(tokenBalance(seed.events)).toBe(650);
  });

  it("starts with a mix of moods", () => {
    expect(["Happy", "Delighted"]).toContain(mood("webDev").mood);
    expect(["Worried", "Upset"]).toContain(mood("appDev").mood);
    expect(mood("appDev").neglected).toEqual([]);
    expect(mood("Animation").neglected.length).toBeGreaterThan(0);
    expect(mood("Animation").mood).not.toBe("Sick");
    expect(mood("seniorCap").mood).toBe("Sick");
    expect(mood("petExt").mood).toBe("Happy");
  });

  it("puts only open tasks in today's plan", () => {
    const open = new Set(seed.tasks.filter((t) => !t.done).map((t) => t.id));
    expect(seed.today.taskIds.length).toBeGreaterThan(0);
    expect(seed.today.taskIds.every((id) => open.has(id))).toBe(true);
  });
});

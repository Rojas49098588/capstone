import { describe, expect, it } from "vitest";
import { moodFromGap, neglectedRequirements, projectHealth, projectMood, requirementIdleDays } from "./mood";
import { NOW, completed, dayKey, daysAgo, makeData, makeProject, makeRequirement, makeTask } from "./testData";
import type { StudiumData, StudiumEvent } from "./types";

/** One weight-5 requirement with 8 one-hour tasks; `done` of them finished `lastDoneDaysAgo` days ago. */
function moodData(o: {
  done: number;
  lastDoneDaysAgo?: number;
  startDate?: string;
  dueDate?: string;
  extraEvents?: StudiumEvent[];
}): StudiumData {
  const requirement = makeRequirement({ startDate: o.startDate ?? dayKey(-10), dueDate: o.dueDate ?? dayKey(9) });
  const tasks = Array.from({ length: 8 }, (_, i) => makeTask({ id: `t${i + 1}`, done: i < o.done }));
  const events = tasks.filter((t) => t.done).map((t) => completed(t.id, daysAgo(o.lastDoneDaysAgo ?? 1)));
  return makeData({ requirements: [requirement], tasks, events: [...events, ...(o.extraEvents ?? [])] });
}

// With start day -10 and due day +9, planned progress at NOW is 52.5%.
describe("mood from the plan", () => {
  it("maps gaps to moods", () => {
    expect(moodFromGap(10)).toBe("Delighted");
    expect(moodFromGap(9.9)).toBe("Happy");
    expect(moodFromGap(-9.9)).toBe("Happy");
    expect(moodFromGap(-10)).toBe("Worried");
    expect(moodFromGap(-24.9)).toBe("Worried");
    expect(moodFromGap(-25)).toBe("Upset");
  });

  it("follows actual vs planned progress", () => {
    expect(projectMood("p1", moodData({ done: 3 }), NOW).mood).toBe("Worried"); // 37.5 − 52.5
    expect(projectMood("p1", moodData({ done: 4 }), NOW).mood).toBe("Happy"); // 50 − 52.5
    expect(projectMood("p1", moodData({ done: 6 }), NOW).mood).toBe("Delighted"); // 75 − 52.5
    expect(projectMood("p1", moodData({ done: 8 }), NOW).mood).toBe("Proud");
  });

  it("is Upset when nothing is done, and neglect cannot lower Upset further", () => {
    const m = projectMood("p1", moodData({ done: 0 }), NOW);
    expect(m.mood).toBe("Upset");
    expect(m.neglected).toHaveLength(1);
  });

  it("does not count activity, only progress against the plan", () => {
    // Same progress, one finished today vs a week ago (both under the neglect limit).
    expect(projectMood("p1", moodData({ done: 4, lastDoneDaysAgo: 0 }), NOW).mood).toBe("Happy");
    expect(projectMood("p1", moodData({ done: 4, lastDoneDaysAgo: 6 }), NOW).mood).toBe("Happy");
  });
});

describe("neglect", () => {
  it("counts idle days from the later of the start and the last completion", () => {
    const data = moodData({ done: 2, lastDoneDaysAgo: 3 });
    expect(requirementIdleDays(data.requirements[0], data, NOW)).toBe(3);
    const fresh = moodData({ done: 0 });
    expect(requirementIdleDays(fresh.requirements[0], fresh, NOW)).toBe(10);
  });

  it("never neglects a requirement that hasn't started", () => {
    const data = moodData({ done: 0, startDate: dayKey(5), dueDate: dayKey(20) });
    expect(requirementIdleDays(data.requirements[0], data, NOW)).toBe(0);
    expect(neglectedRequirements("p1", data, NOW)).toEqual([]);
    expect(projectMood("p1", data, NOW).mood).toBe("Happy");
  });

  it("lowers mood one level after 7 idle days", () => {
    expect(projectMood("p1", moodData({ done: 4, lastDoneDaysAgo: 8 }), NOW).mood).toBe("Worried");
  });

  it("lists the longest idle requirement first", () => {
    const data = makeData({
      requirements: [
        makeRequirement({ id: "r1", startDate: dayKey(-9), dueDate: dayKey(20) }),
        makeRequirement({ id: "r2", startDate: dayKey(-12), dueDate: dayKey(20) }),
      ],
      tasks: [makeTask({ id: "a", requirementId: "r1" }), makeTask({ id: "b", requirementId: "r2" })],
    });
    expect(neglectedRequirements("p1", data, NOW).map((n) => [n.requirement.id, n.idleDays])).toEqual([
      ["r2", 12],
      ["r1", 9],
    ]);
  });
});

describe("sick, medicine and recovery", () => {
  // Start day -20, due day +19: planned is 51.25% at NOW.
  const base = { startDate: dayKey(-20), dueDate: dayKey(19) };
  const medicine = (days: number): StudiumEvent => ({ type: "medicine_given", at: daysAgo(days), projectId: "p1" });

  it("is Sick after 14 idle days", () => {
    const data = moodData({ ...base, done: 4, lastDoneDaysAgo: 15 });
    expect(projectHealth("p1", data, NOW).sick).toBe(true);
    expect(projectMood("p1", data, NOW).mood).toBe("Sick");
  });

  it("is Recovering after medicine, capped at Worried", () => {
    const data = moodData({ ...base, done: 6, lastDoneDaysAgo: 15, extraEvents: [medicine(1)] });
    const health = projectHealth("p1", data, NOW);
    expect(health).toEqual({ sick: false, recovering: true, recoveringFor: ["r1"] });
    expect(projectMood("p1", data, NOW).mood).toBe("Worried"); // Delighted → neglect → Happy → cap
  });

  it("ends recovery early once the neglected requirement moves", () => {
    // t7 is finished for the first time after the medicine (a real step forward).
    const start = moodData({ ...base, done: 6, lastDoneDaysAgo: 15, extraEvents: [medicine(1), completed("t7", daysAgo(0.5))] });
    const data = { ...start, tasks: start.tasks.map((t) => (t.id === "t7" ? { ...t, done: true } : t)) };
    expect(projectHealth("p1", data, NOW).recovering).toBe(false);
    expect(projectMood("p1", data, NOW).mood).toBe("Delighted");
  });

  it("does not let re-checking an old task cure a sick pet", () => {
    const data = moodData({ ...base, done: 4, lastDoneDaysAgo: 15, extraEvents: [completed("t1", daysAgo(0.5))] });
    expect(projectMood("p1", data, NOW).mood).toBe("Sick");
  });

  it("does not let re-checking an old task end recovery", () => {
    const data = moodData({ ...base, done: 6, lastDoneDaysAgo: 15, extraEvents: [medicine(1), completed("t1", daysAgo(0.5))] });
    expect(projectHealth("p1", data, NOW).recovering).toBe(true);
  });

  it("gets sick again when recovery runs out without progress", () => {
    const data = moodData({ ...base, done: 4, lastDoneDaysAgo: 15, extraEvents: [medicine(4)] });
    expect(projectHealth("p1", data, NOW)).toEqual({ sick: true, recovering: false, recoveringFor: [] });
  });
});

describe("difficulty", () => {
  const withDifficulty = (data: StudiumData, difficulty?: "gentle" | "steady" | "strict") => ({
    ...data,
    projects: data.projects.map((p) => ({ ...p, difficulty })),
  });
  // Start day -40, due day +40, so planned progress is about half and the requirement has started long ago.
  const idleFor = (days: number) => moodData({ done: 4, lastDoneDaysAgo: days, startDate: dayKey(-40), dueDate: dayKey(40) });

  it("each difficulty has its own Worried and Upset lines", () => {
    expect(moodFromGap(-15, "gentle")).toBe("Happy");
    expect(moodFromGap(-15)).toBe("Worried");
    expect(moodFromGap(-15, "strict")).toBe("Upset");
    expect(moodFromGap(-30, "gentle")).toBe("Worried");
    expect(moodFromGap(-6, "strict")).toBe("Worried");
    expect(moodFromGap(-41, "gentle")).toBe("Upset");
  });

  it("a strict pet gets neglected and sick sooner", () => {
    const strict4 = withDifficulty(idleFor(4), "strict");
    expect(neglectedRequirements("p1", strict4, NOW)).toHaveLength(1);
    expect(projectHealth("p1", strict4, NOW).sick).toBe(false);
    expect(projectHealth("p1", withDifficulty(idleFor(7), "strict"), NOW).sick).toBe(true);
    const steady4 = withDifficulty(idleFor(4), "steady");
    expect(neglectedRequirements("p1", steady4, NOW)).toHaveLength(0);
    const steady7 = withDifficulty(idleFor(7), "steady");
    expect(neglectedRequirements("p1", steady7, NOW)).toHaveLength(1);
    expect(projectHealth("p1", steady7, NOW).sick).toBe(false);
  });

  it("a gentle pet isn't sick after 14 idle days", () => {
    expect(projectHealth("p1", withDifficulty(idleFor(15), "gentle"), NOW).sick).toBe(false);
    expect(neglectedRequirements("p1", withDifficulty(idleFor(13), "gentle"), NOW)).toHaveLength(0);
    expect(projectHealth("p1", withDifficulty(idleFor(29), "gentle"), NOW).sick).toBe(true);
  });

  it("a project with no difficulty behaves exactly as before", () => {
    for (const days of [3, 8, 15]) {
      const data = idleFor(days);
      expect(projectMood("p1", data, NOW)).toEqual(projectMood("p1", withDifficulty(data, "steady"), NOW));
    }
  });
});

describe("pet lifecycle and health", () => {
  // Requirement started 20 days ago, due in 19; nothing completed since.
  const idle = { startDate: dayKey(-20), dueDate: dayKey(19), done: 0 };
  const withProject = (o: Parameters<typeof makeProject>[0]) => ({ ...moodData(idle), projects: [makeProject(o)] });

  it("never makes an egg sick", () => {
    const data = withProject({ stage: "egg", hatchedAt: null });
    expect(projectHealth("p1", data, NOW).sick).toBe(false);
    expect(projectMood("p1", data, NOW).mood).not.toBe("Sick");
  });

  it("counts a just-hatched pet's idle days from the hatch", () => {
    const data = withProject({ stage: "juvenile", hatchedAt: daysAgo(2) });
    expect(requirementIdleDays(data.requirements[0], data, NOW)).toBe(2);
    expect(neglectedRequirements("p1", data, NOW)).toHaveLength(0);
    expect(projectHealth("p1", data, NOW).sick).toBe(false);
  });

  it("lets a juvenile get sick once it has been idle 14 days since hatching", () => {
    const data = withProject({ stage: "juvenile", hatchedAt: daysAgo(15) });
    expect(projectHealth("p1", data, NOW).sick).toBe(true);
  });

  it("keeps the old rules for adults saved before the lifecycle", () => {
    const data = withProject({ hatchedAt: daysAgo(1) });
    expect(projectHealth("p1", data, NOW).sick).toBe(true);
  });
});

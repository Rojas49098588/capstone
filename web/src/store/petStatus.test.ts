// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { NOW, dayKey, makeData, makeRequirement, makeTask } from "../planner/testData";
import { memoryStorage } from "../test/render";
import { completeTask, giveMedicine, placeDecor, purchase, reopenTask } from "./actions";
import { PET_STATUS_EVENT, PET_STATUS_KEY, buildPetStatuses, publishPetStatuses } from "./petStatus";
import { buildSeed } from "./seed";

describe("pet statuses", () => {
  it("describes every project's pet", () => {
    const s = buildPetStatuses(buildSeed(NOW), NOW);
    expect(s.updatedAt).toBe(NOW.toISOString());
    expect(s.pets.map((p) => [p.projectId, p.petKind])).toEqual([
      ["webDev", "pigeon"],
      ["appDev", "dog"],
      ["Animation", "frog"],
      ["seniorCap", "cat"],
      ["petExt", "turtle"],
    ]);
    expect(s.pets[3]).toMatchObject({
      shortName: "seniorCap",
      name: "Senior Capstone Project",
      mood: "Sick",
      recovering: false,
      idleRequirement: { title: "Prototype v1", days: 16 },
    });
    expect(s.pets[2].idleRequirement).toEqual({ title: "Rigging", days: 9 });
  });

  it("marks a pet that is recovering", () => {
    let data = purchase(buildSeed(NOW), "medicine", NOW).data;
    data = giveMedicine(data, "seniorCap", NOW).data;
    const cap = buildPetStatuses(data, NOW).pets[3];
    expect(cap.recovering).toBe(true);
    expect(cap.mood).not.toBe("Sick");
  });

  it("saves them for the extension and announces it", () => {
    const storage = memoryStorage();
    const onUpdate = vi.fn();
    window.addEventListener(PET_STATUS_EVENT, onUpdate);
    expect(publishPetStatuses(storage, buildSeed(NOW), NOW)).toBe(true);
    window.removeEventListener(PET_STATUS_EVENT, onUpdate);
    expect(JSON.parse(storage.getItem(PET_STATUS_KEY) ?? "null").pets).toHaveLength(5);
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it("reports when it can't save", () => {
    const data = buildSeed(NOW);
    expect(publishPetStatuses(null, data, NOW)).toBe(false);
    const full = memoryStorage();
    full.setItem = () => {
      throw new Error("QuotaExceededError");
    };
    expect(publishPetStatuses(full, data, NOW)).toBe(false);
  });
});

// The same tasks as suggest.test.ts: a unblocks c, d done, e unlinked, f in today, g pinned.
function suggestData(todayIds = ["f"]) {
  return makeData({
    requirements: [makeRequirement()],
    tasks: [
      makeTask({ id: "a" }),
      makeTask({ id: "b" }),
      makeTask({ id: "c", blockedBy: ["a"] }),
      makeTask({ id: "d", done: true }),
      makeTask({ id: "e", requirementId: null }),
      makeTask({ id: "f" }),
      makeTask({ id: "g", priority: true }),
    ],
    today: { date: dayKey(0), taskIds: todayIds },
  });
}

describe("pet suggestions", () => {
  it("suggests today's tasks for the project first", () => {
    expect(buildPetStatuses(suggestData(), NOW).pets[0].suggestion).toEqual({ taskId: "f", title: "Task", estimateMin: 60 });
  });

  it("then follows Suggested next", () => {
    expect(buildPetStatuses(suggestData([]), NOW).pets[0].suggestion?.taskId).toBe("g");
  });

  it("skips today's tasks that are done, blocked or unlinked", () => {
    expect(buildPetStatuses(suggestData(["d", "c", "e", "b"]), NOW).pets[0].suggestion?.taskId).toBe("b");
  });

  it("suggests nothing when every task is done, blocked or unlinked", () => {
    const data = makeData({
      requirements: [makeRequirement()],
      tasks: [makeTask({ id: "x", done: true }), makeTask({ id: "y", blockedBy: ["z"] }), makeTask({ id: "z", requirementId: null }), makeTask({ id: "w", requirementId: null })],
    });
    // z is unlinked, so y waits on it and nothing is left to suggest.
    expect(buildPetStatuses(data, NOW).pets[0].suggestion).toBeNull();
  });
});

describe("pet celebrations", () => {
  const hours = (n: number) => new Date(NOW.getTime() + n * 3_600_000);
  const three = () =>
    makeData({ requirements: [makeRequirement()], tasks: [makeTask({ id: "a" }), makeTask({ id: "b" }), makeTask({ id: "c" })] });
  const celebration = (data: ReturnType<typeof makeData>) => buildPetStatuses(data, hours(6)).pets[0].celebration;

  it("no completion, no celebration", () => {
    expect(celebration(three())).toBeNull();
  });

  it("celebrates the project's first completed task bigger, then every completion", () => {
    let data = completeTask(three(), "a", 60, NOW).data;
    expect(celebration(data)).toEqual({ at: NOW.toISOString(), kind: "firstTask" });
    data = completeTask(data, "b", 60, hours(1)).data;
    expect(celebration(data)).toEqual({ at: hours(1).toISOString(), kind: "task" });
  });

  it("re-checks celebrate too", () => {
    let data = completeTask(three(), "a", 60, NOW).data;
    data = completeTask(data, "b", 60, hours(1)).data;
    data = reopenTask(data, "b", hours(2));
    data = completeTask(data, "b", 60, hours(3)).data;
    expect(celebration(data)).toEqual({ at: hours(3).toISOString(), kind: "task" });
  });

  it("finishing a requirement is the biggest, even as the first completion", () => {
    let data = completeTask(three(), "a", 60, NOW).data;
    data = completeTask(data, "b", 60, hours(1)).data;
    data = completeTask(data, "c", 60, hours(2)).data;
    expect(celebration(data)).toEqual({ at: hours(2).toISOString(), kind: "requirement" });
    const single = makeData({ requirements: [makeRequirement()], tasks: [makeTask({ id: "a" })] });
    expect(celebration(completeTask(single, "a", 60, NOW).data)?.kind).toBe("requirement");
  });
});

describe("pet furniture", () => {
  it("lists the bed and the pet's own furniture", () => {
    let data = buildSeed(NOW);
    for (const productId of ["pet-bed", "scratching-post", "perch"]) data.events.push({ type: "purchase", at: NOW.toISOString(), productId, price: 0 });
    data = placeDecor(data, "seniorCap", "floorLeft", "pet-bed");
    data = placeDecor(data, "seniorCap", "floorRight", "scratching-post");
    data = placeDecor(data, "seniorCap", "wallLeft", "perch"); // the pigeon's, so the cat ignores it
    const cap = buildPetStatuses(data, NOW).pets.find((p) => p.projectId === "seniorCap");
    expect(cap?.furniture).toEqual([
      { use: "bed", slot: "floorLeft" },
      { use: "scratch", slot: "floorRight" },
    ]);
  });

  it("no decor, no furniture", () => {
    expect(buildPetStatuses({ ...buildSeed(NOW), decor: {} }, NOW).pets.every((p) => p.furniture.length === 0)).toBe(true);
  });

  it("every pet can use its habitat's built-in bed", () => {
    for (const p of buildPetStatuses(buildSeed(NOW), NOW).pets) expect(p.furniture).toEqual([{ use: "bed", slot: "floorLeft" }]);
  });
});

// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { NOW, completed, dayKey, daysAgo, makeData, makePet, makeProject, makeRequirement, makeTask } from "../planner/testData";
import { findPet, petMood } from "../planner/pets";
import type { ExtraPet, StudiumData } from "../planner/types";
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

describe("nap choices", () => {
  const choices = (data: ReturnType<typeof makeData>) => buildPetStatuses(data, NOW).pets[0].napTasks;

  it("lists the project's Today tasks first, then its suggestions", () => {
    const list = choices(suggestData(["f"]));
    expect(list[0]).toEqual({ taskId: "f", title: "Task", estimateMin: 60, group: "today" });
    expect(list.filter((t) => t.group === "today").map((t) => t.taskId)).toEqual(["f"]);
    const suggested = list.filter((t) => t.group === "suggested").map((t) => t.taskId);
    expect(suggested[0]).toBe("g"); // pinned first, as in Suggested next
    expect([...suggested].sort()).toEqual(["a", "b", "g"]);
  });

  it("keeps Today's order and leaves out done, blocked and unlinked tasks", () => {
    const today = choices(suggestData(["b", "d", "c", "e", "f"])).filter((t) => t.group === "today");
    expect(today.map((t) => t.taskId)).toEqual(["b", "f"]);
  });

  it("offers at most 5 suggestions", () => {
    const tasks = Array.from({ length: 8 }, (_, i) => makeTask({ id: `t${i}` }));
    const data = makeData({ requirements: [makeRequirement()], tasks, today: { date: dayKey(0), taskIds: [] } });
    expect(choices(data).filter((t) => t.group === "suggested")).toHaveLength(5);
  });

  it("only offers the pet's own project's tasks", () => {
    const other = makeProject({ id: "other" });
    const data = makeData({
      projects: [makeProject(), other],
      requirements: [makeRequirement(), makeRequirement({ id: "r-other", projectId: "other" })],
      tasks: [makeTask({ id: "mine" }), makeTask({ id: "theirs", projectId: "other", requirementId: "r-other" })],
      today: { date: dayKey(0), taskIds: ["theirs", "mine"] },
    });
    const pets = buildPetStatuses(data, NOW).pets;
    expect(pets[0].napTasks.map((t) => t.taskId)).toEqual(["mine"]);
    expect(pets[1].napTasks.map((t) => t.taskId)).toEqual(["theirs"]);
  });

  it("is empty when there's nothing to work on", () => {
    const data = makeData({ requirements: [makeRequirement()], tasks: [makeTask({ id: "x", done: true })] });
    expect(choices(data)).toEqual([]);
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
    data = placeDecor(data, "seniorCap", "floorMiddle", "pet-bed");
    data = placeDecor(data, "seniorCap", "floorRight", "scratching-post");
    data = placeDecor(data, "seniorCap", "wallLeft", "perch"); // the pigeon's, so the cat ignores it
    const cap = buildPetStatuses(data, NOW).pets.find((p) => p.projectId === "seniorCap");
    expect(cap?.furniture).toEqual([
      { use: "bed", slot: "floorMiddle" },
      { use: "scratch", slot: "floorRight" },
    ]);
  });

  it("no decor, no furniture", () => {
    expect(buildPetStatuses({ ...buildSeed(NOW), decor: {} }, NOW).pets.every((p) => p.furniture.length === 0)).toBe(true);
  });

  it("every pet can use its habitat's built-in bed", () => {
    for (const p of buildPetStatuses(buildSeed(NOW), NOW).pets) expect(p.furniture).toEqual([{ use: "bed", slot: "floorMiddle" }]);
  });
});

describe("pet due dates", () => {
  it("publishes each project's due date, for Which pets show first", () => {
    const data = buildSeed(NOW);
    const pets = buildPetStatuses(data, NOW).pets;
    expect(pets.map((p) => p.deadline)).toEqual(data.projects.map((p) => p.deadline));
  });
});

describe("pet stages", () => {
  it("leaves eggs out and tells the extension which pets are juveniles", () => {
    const data = makeData({
      projects: [
        makeProject({ id: "egg", stage: "egg", hatchedAt: null }),
        makeProject({ id: "young", stage: "juvenile" }),
        makeProject({ id: "old" }),
      ],
    });
    const pets = buildPetStatuses(data, NOW).pets;
    expect(pets.map((p) => [p.projectId, p.stage])).toEqual([
      ["young", "juvenile"],
      ["old", "adult"],
    ]);
  });
});

describe("bought pets", () => {
  // r1 has a, b (today: a); r2 has e, f. The first pet and sharing pets see both; a pet looking after r2 sees r2 only.
  function family(pet: Partial<ExtraPet> = {}): StudiumData {
    return makeData({
      projects: [makeProject({ pets: [makePet({ id: "x1", ...pet }), makePet({ id: "x2", stage: "egg", hatchedAt: null, name: null })] })],
      requirements: [makeRequirement({ id: "r1" }), makeRequirement({ id: "r2" })],
      tasks: [makeTask({ id: "a" }), makeTask({ id: "b" }), makeTask({ id: "e", requirementId: "r2" }), makeTask({ id: "f", requirementId: "r2", done: true })],
      events: [completed("a0", daysAgo(2), { requirementId: "r1" }), completed("f", daysAgo(3), { requirementId: "r2" })],
      today: { date: dayKey(0), taskIds: ["a"] },
    });
  }
  const statusOf = (data: StudiumData, petId: string) => buildPetStatuses(data, NOW).pets.find((p) => p.petId === petId);

  it("sends one status per hatched pet, keyed by pet id", () => {
    expect(buildPetStatuses(family(), NOW).pets).toMatchObject([
      { petId: "p1", projectId: "p1" },
      { petId: "x1", projectId: "p1" },
    ]);
  });

  it("labels a pet with its name, or its suggested name until it's named", () => {
    expect(statusOf(family({ name: "Ribbit" }), "x1")?.shortName).toBe("Ribbit");
    expect(statusOf(family({ name: null }), "x1")?.shortName).toBe("Frog");
    expect(statusOf(family(), "x1")).toMatchObject({ petKind: "frog", stage: "juvenile", name: "Project", color: "#2d3a8c" });
  });

  it("a pet looking after a requirement suggests, offers and celebrates only that requirement", () => {
    const data = family({ caresFor: "r2" });
    const s = statusOf(data, "x1");
    expect(s?.suggestion?.taskId).toBe("e");
    expect(s?.napTasks.map((t) => t.taskId)).toEqual(["e"]);
    expect(s?.celebration?.at).toBe(daysAgo(3));
    expect(s?.mood).toBe(petMood(findPet(data, "x1")!, data, NOW)?.mood);
  });

  it("a sharing pet gets what the first pet gets", () => {
    const data = family();
    const { petId: _a, shortName: _b, petKind: _c, stage: _d, furniture: _e, ...first } = statusOf(data, "p1")!;
    const { petId: _f, shortName: _g, petKind: _h, stage: _i, furniture: _j, ...shared } = statusOf(data, "x1")!;
    expect(shared).toEqual(first);
  });

  it("reads furniture from the pet's own habitat", () => {
    const owned = family();
    owned.events.push({ type: "purchase", at: NOW.toISOString(), productId: "log", price: 0 });
    const data = placeDecor(owned, "x1", "floorLeft", "log");
    expect(statusOf(data, "x1")?.furniture).toEqual([{ use: "lounge", slot: "floorLeft" }]);
    expect(statusOf(data, "p1")?.furniture).toEqual([]);
  });
});

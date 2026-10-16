// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { NOW } from "../planner/testData";
import { memoryStorage } from "../test/render";
import { giveMedicine, purchase } from "./actions";
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

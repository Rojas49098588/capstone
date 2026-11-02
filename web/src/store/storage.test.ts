import { describe, expect, it } from "vitest";
import { NOW, makeData, makePet, makeProject, makeRequirement, makeTask } from "../planner/testData";
import { BACKUP_PREFIX, STORAGE_KEY, isValidData, loadData, parseFocusSessions, saveData } from "./storage";

function memoryStorage(failWrites = false): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (k: string) => void map.delete(k),
    setItem: (k: string, v: string) => {
      if (failWrites) throw new Error("QuotaExceededError");
      map.set(k, String(v));
    },
  } as Storage;
}

const valid = () =>
  makeData({ requirements: [makeRequirement()], tasks: [makeTask()] });

describe("isValidData", () => {
  it("accepts requirements with or without blockers, and rejects damaged ones", () => {
    const withReq = (extra: object) => makeData({ requirements: [{ ...makeRequirement(), ...extra }], tasks: [makeTask()] });
    expect(isValidData(withReq({ blockedBy: ["x"] }))).toBe(true);
    expect(isValidData(withReq({ blockedByAll: true }))).toBe(true);
    expect(isValidData(withReq({ blockedBy: "x" }))).toBe(false);
    expect(isValidData(withReq({ blockedBy: [1] }))).toBe(false);
    expect(isValidData(withReq({ blockedByAll: false }))).toBe(false);
  });

  it("accepts data with or without startingTokens, and rejects a non-number", () => {
    expect(isValidData(valid())).toBe(true);
    expect(isValidData({ ...valid(), startingTokens: 100 })).toBe(true);
    expect(isValidData({ ...valid(), startingTokens: "100" })).toBe(false);
  });

  it("accepts good data, including unknown event types from a newer version", () => {
    const data = { ...valid(), events: [{ type: "something_new", at: NOW.toISOString(), extra: 1 }] };
    expect(isValidData(data)).toBe(true);
  });

  it("rejects broken references and wrong shapes", () => {
    expect(isValidData({ ...valid(), tasks: [makeTask({ projectId: "missing" })] })).toBe(false);
    expect(isValidData({ ...valid(), tasks: [makeTask({ requirementId: "missing" })] })).toBe(false);
    expect(isValidData({ ...valid(), version: 2 })).toBe(false);
    expect(isValidData({ ...valid(), events: [{ type: "task_completed", at: NOW.toISOString(), taskId: "t1" }] })).toBe(false);
    expect(isValidData(null)).toBe(false);
  });

  it("accepts feedings and rejects damaged ones", () => {
    const fed = (o: object = {}) => ({ type: "fed", at: NOW.toISOString(), projectId: "p1", petId: "p1", productId: "berry-bites", ...o });
    expect(isValidData({ ...valid(), events: [fed()] })).toBe(true);
    expect(isValidData({ ...valid(), events: [fed({ petId: undefined })] })).toBe(false);
    expect(isValidData({ ...valid(), events: [fed({ productId: 3 })] })).toBe(false);
  });

  it("loads completions saved before the meal boost existed", () => {
    const breakdown = { base: 10, unblockBonus: 0, neglectBonus: 0, finish: 0, dailyCurve: 1, sickMultiplier: 1 };
    const old = { type: "task_completed", at: NOW.toISOString(), taskId: "t1", requirementId: "r1", actualMin: null, tokens: 3, breakdown };
    expect(isValidData({ ...valid(), events: [old] })).toBe(true);
  });
});

describe("loadData / saveData", () => {
  it("starts with no projects and saves that when nothing is stored", () => {
    const storage = memoryStorage();
    const result = loadData(storage, NOW);
    expect(result).toMatchObject({ persistent: true, notice: null });
    expect(result.data).toMatchObject({ version: 1, projects: [], requirements: [], tasks: [], events: [], defaultBeds: true });
    expect(isValidData(result.data)).toBe(true);
    expect(storage.getItem(STORAGE_KEY)).not.toBeNull();
  });

  it("round-trips saved data", () => {
    const storage = memoryStorage();
    const data = { ...valid(), defaultBeds: true as const };
    expect(saveData(storage, data)).toBe(true);
    expect(loadData(storage, NOW).data).toEqual(data);
  });

  it("keeps a backup and falls back when the saved data is damaged", () => {
    const storage = memoryStorage();
    storage.setItem(STORAGE_KEY, "{not json");
    const result = loadData(storage, NOW);
    expect(result.notice).toBe("damaged-data");
    expect(storage.getItem(`${BACKUP_PREFIX}${NOW.toISOString()}`)).toBe("{not json");
    expect(isValidData(JSON.parse(storage.getItem(STORAGE_KEY) as string))).toBe(true);
  });

  it("works from memory when storage is unavailable", () => {
    expect(loadData(null, NOW)).toMatchObject({ persistent: false, notice: "storage-unavailable" });
    expect(saveData(null, valid())).toBe(false);
  });

  it("reports a failed save instead of throwing", () => {
    expect(saveData(memoryStorage(true), valid())).toBe(false);
  });
});

describe("isValidData dates", () => {
  it("rejects malformed date keys", () => {
    expect(isValidData({ ...valid(), projects: [{ ...valid().projects[0], deadline: "soon" }] })).toBe(false);
    expect(isValidData({ ...valid(), requirements: [makeRequirement({ dueDate: "" })] })).toBe(false);
  });
});

const focusEvent = (o: Record<string, unknown> = {}) => ({
  type: "focus_session",
  at: NOW.toISOString(),
  id: "s1",
  projectId: "p1",
  taskId: "t1",
  startedAt: NOW.toISOString(),
  minutes: 15,
  ...o,
});

describe("focus sessions", () => {
  it("accepts focus sessions and rejects damaged ones", () => {
    expect(isValidData({ ...valid(), events: [focusEvent(), focusEvent({ taskId: null })] })).toBe(true);
    for (const bad of [{ minutes: -1 }, { minutes: Number.NaN }, { taskId: 5 }, { startedAt: undefined }, { id: 7 }]) {
      expect(isValidData({ ...valid(), events: [focusEvent(bad)] })).toBe(false);
    }
  });

  it("parseFocusSessions keeps valid sessions only", () => {
    expect(parseFocusSessions("{broken")).toEqual([]);
    expect(parseFocusSessions('{"a":1}')).toEqual([]);
    const good = { ...focusEvent(), type: undefined };
    delete good.type;
    const bad = { ...good, minutes: "5" };
    expect(parseFocusSessions(JSON.stringify([good, bad]))).toEqual([good]);
  });
});

describe("saved decor", () => {
  it("loads data saved before decor existed", () => {
    const storage = memoryStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify(valid()));
    const result = loadData(storage, NOW);
    expect(result.notice).toBeNull();
    // Unchanged except that each habitat is given its built-in bed.
    const id = valid().projects[0].id;
    expect(result.data).toEqual({ ...valid(), decor: { [id]: { floorMiddle: "default-bed" } }, defaultBeds: true });
  });

  it("cleans damaged decor instead of resetting the data", () => {
    const storage = memoryStorage();
    const data = { ...valid(), decor: { p1: { floorLeft: "pet-bed" }, junk: 5 } };
    storage.setItem(STORAGE_KEY, JSON.stringify(data));
    const result = loadData(storage, NOW);
    expect(result.notice).toBeNull();
    expect(result.data.tasks).toHaveLength(1);
    expect(result.data.decor).toEqual({}); // the bed was never bought
  });
});

describe("pet stages in saved data", () => {
  it("loads projects saved before stages existed unchanged", () => {
    const storage = memoryStorage();
    const data = valid();
    storage.setItem(STORAGE_KEY, JSON.stringify(data));
    const loaded = loadData(storage, NOW).data;
    expect(loaded.projects[0]).toEqual(data.projects[0]);
    expect("stage" in loaded.projects[0]).toBe(false);
  });

  it("loads projects saved before types existed unchanged", () => {
    const storage = memoryStorage();
    const data = valid();
    storage.setItem(STORAGE_KEY, JSON.stringify(data));
    const loaded = loadData(storage, NOW).data.projects[0];
    expect("type" in loaded || "difficulty" in loaded).toBe(false);
    const typed = makeData({ projects: [makeProject({ type: "code", difficulty: "gentle" })] });
    expect(isValidData(typed)).toBe(true);
  });

  it("rejects an unknown type or difficulty", () => {
    expect(isValidData(makeData({ projects: [{ ...makeProject(), type: "poetry" } as never] }))).toBe(false);
    expect(isValidData(makeData({ projects: [{ ...makeProject(), difficulty: "brutal" } as never] }))).toBe(false);
  });

  it("round-trips an egg that hasn't hatched", () => {
    const egg = makeData({ projects: [makeProject({ stage: "egg", hatchedAt: null })] });
    expect(isValidData(egg)).toBe(true);
    const storage = memoryStorage();
    saveData(storage, egg);
    expect(loadData(storage, NOW).data.projects[0]).toEqual(egg.projects[0]);
  });

  it("rejects an unknown stage or a non-string hatch time", () => {
    expect(isValidData(makeData({ projects: [{ ...makeProject(), stage: "chick" } as never] }))).toBe(false);
    expect(isValidData(makeData({ projects: [{ ...makeProject(), hatchedAt: 5 } as never] }))).toBe(false);
  });
});

describe("bought pets in saved data", () => {
  const withPets = (pets: unknown) => makeData({ projects: [{ ...makeProject(), pets } as never] });

  it("round-trips bought pets", () => {
    const data = withPets([makePet(), makePet({ id: "x2", stage: "egg", hatchedAt: null, name: null, caresFor: null })]);
    expect(isValidData(data)).toBe(true);
    const storage = memoryStorage();
    saveData(storage, data);
    expect(loadData(storage, NOW).data.projects[0]).toEqual(data.projects[0]);
  });

  it("rejects damaged bought pets", () => {
    expect(isValidData(withPets("x1"))).toBe(false);
    expect(isValidData(withPets([{ ...makePet(), kind: "dragon" }]))).toBe(false);
    expect(isValidData(withPets([{ ...makePet(), stage: "chick" }]))).toBe(false);
    expect(isValidData(withPets([{ ...makePet(), id: 7 }]))).toBe(false);
    expect(isValidData(withPets([{ ...makePet(), name: 7 }]))).toBe(false);
    expect(isValidData(withPets([{ ...makePet(), caresFor: 7 }]))).toBe(false);
    expect(isValidData(withPets([{ ...makePet(), boughtAt: null }]))).toBe(false);
  });

  it("accepts medicine for one pet and rejects a damaged pet id", () => {
    const dose = (petId: unknown) => makeData({ events: [{ type: "medicine_given", at: NOW.toISOString(), projectId: "p1", petId } as never] });
    expect(isValidData(dose("x1"))).toBe(true);
    expect(isValidData(dose(7))).toBe(false);
  });

  it("loads data saved before bought pets unchanged", () => {
    const storage = memoryStorage();
    const data = makeData({ events: [{ type: "medicine_given", at: NOW.toISOString(), projectId: "p1" }] });
    storage.setItem(STORAGE_KEY, JSON.stringify(data));
    const loaded = loadData(storage, NOW).data;
    expect(loaded.projects).toEqual(data.projects);
    expect(loaded.events).toEqual(data.events);
  });
});

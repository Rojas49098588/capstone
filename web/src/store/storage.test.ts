import { describe, expect, it } from "vitest";
import { NOW, makeData, makeRequirement, makeTask } from "../planner/testData";
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
});

describe("loadData / saveData", () => {
  it("starts with the example data and saves it when nothing is stored", () => {
    const storage = memoryStorage();
    const result = loadData(storage, NOW);
    expect(result).toMatchObject({ persistent: true, notice: null });
    expect(storage.getItem(STORAGE_KEY)).not.toBeNull();
  });

  it("round-trips saved data", () => {
    const storage = memoryStorage();
    expect(saveData(storage, valid())).toBe(true);
    expect(loadData(storage, NOW).data).toEqual(valid());
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
    expect(result.data).toEqual(valid()); // unchanged: no decor added
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

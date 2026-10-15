import { describe, expect, it } from "vitest";
import { NOW, makeData, makeRequirement, makeTask } from "../planner/testData";
import { BACKUP_PREFIX, STORAGE_KEY, isValidData, loadData, saveData } from "./storage";

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

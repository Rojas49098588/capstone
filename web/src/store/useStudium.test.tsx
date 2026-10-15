// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NOW, dayKey } from "../planner/testData";
import { memoryStorage, savedData } from "../test/render";
import { PET_STATUS_EVENT, PET_STATUS_KEY, PET_STATUS_REFRESH_MS } from "./petStatus";
import { STORAGE_KEY } from "./storage";
import { NOW_REFRESH_MS, useStudium } from "./useStudium";

afterEach(() => vi.useRealTimers());

describe("useStudium", () => {
  it("loads the example data and saves it on the first visit", () => {
    const storage = memoryStorage();
    const { result } = renderHook(() => useStudium({ storage, clock: () => NOW }));
    expect(result.current.data.projects).toHaveLength(5);
    expect(storage.getItem(STORAGE_KEY)).not.toBeNull();
    expect(result.current.notice).toBeNull();
  });

  it("applies actions with the clock's time and saves them", () => {
    const storage = memoryStorage();
    const { result } = renderHook(() => useStudium({ storage, clock: () => NOW }));
    let payout: ReturnType<typeof result.current.completeTask> = null;
    act(() => {
      payout = result.current.completeTask("webDev-t5", 180);
    });
    expect(payout).not.toBeNull();
    const saved = savedData(storage);
    expect(saved.tasks.find((t) => t.id === "webDev-t5")?.done).toBe(true);
    expect(saved.events.slice(-1)[0].at).toBe(NOW.toISOString());
    expect(result.current.data).toEqual(saved);
  });

  it("reports a failed save but keeps working", () => {
    const storage = memoryStorage();
    const { result } = renderHook(() => useStudium({ storage, clock: () => NOW }));
    storage.setItem = () => {
      throw new Error("QuotaExceededError");
    };
    act(() => {
      result.current.addToToday("webDev-t6");
    });
    expect(result.current.notice).toBe("save-failed");
    expect(result.current.data.today.taskIds).toContain("webDev-t6");
  });

  it("works without storage", () => {
    const { result } = renderHook(() => useStudium({ storage: null, clock: () => NOW }));
    expect([result.current.notice, result.current.persistent]).toEqual(["storage-unavailable", false]);
    act(() => {
      result.current.togglePriority("webDev-t6");
    });
    expect(result.current.data.tasks.find((t) => t.id === "webDev-t6")?.priority).toBe(true);
  });

  it('refreshes "now" every minute so day changes show up', () => {
    vi.useFakeTimers();
    let time = NOW;
    const { result } = renderHook(() => useStudium({ storage: memoryStorage(), clock: () => time }));
    time = new Date(NOW.getTime() + 24 * 3_600_000);
    act(() => {
      vi.advanceTimersByTime(NOW_REFRESH_MS);
    });
    expect(result.current.now).toEqual(time);
  });
});

describe("useStudium with two tabs", () => {
  it("picks up changes another tab saved instead of overwriting them", () => {
    const storage = memoryStorage();
    const { result } = renderHook(() => useStudium({ storage, clock: () => NOW }));
    // The other tab completes a task and saves.
    const other = { ...savedData(storage) };
    other.tasks = other.tasks.map((t) => (t.id === "webDev-t5" ? { ...t, done: true } : t));
    storage.setItem(STORAGE_KEY, JSON.stringify(other));
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY, newValue: JSON.stringify(other) }));
    });
    expect(result.current.data.tasks.find((t) => t.id === "webDev-t5")?.done).toBe(true);
    // This tab's next change builds on the other tab's data.
    act(() => {
      result.current.togglePriority("webDev-t6");
    });
    expect(savedData(storage).tasks.find((t) => t.id === "webDev-t5")?.done).toBe(true);
  });

  it("ignores damaged data from another tab", () => {
    const storage = memoryStorage();
    const { result } = renderHook(() => useStudium({ storage, clock: () => NOW }));
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY, newValue: "{broken" }));
    });
    expect(result.current.data.projects).toHaveLength(5);
  });
});

describe("useStudium and the browser extension", () => {
  const published = (storage: Storage) => JSON.parse(storage.getItem(PET_STATUS_KEY) ?? "null");

  it("publishes pet statuses when it loads", () => {
    const storage = memoryStorage();
    renderHook(() => useStudium({ storage, clock: () => NOW }));
    expect(published(storage).pets).toHaveLength(5);
  });

  it("publishes again after every change", () => {
    const storage = memoryStorage();
    const onUpdate = vi.fn();
    window.addEventListener(PET_STATUS_EVENT, onUpdate);
    const { result } = renderHook(() => useStudium({ storage, clock: () => NOW }));
    const before = onUpdate.mock.calls.length;
    act(() => {
      result.current.createProject({
        name: "Thesis",
        shortName: "thesis",
        color: "#2d3a8c",
        deadline: dayKey(30),
        description: "",
        petKind: "cat",
      });
    });
    window.removeEventListener(PET_STATUS_EVENT, onUpdate);
    expect(published(storage).pets).toHaveLength(6);
    expect(onUpdate.mock.calls.length).toBeGreaterThan(before);
  });

  it("republishes every hour because moods change with time", () => {
    vi.useFakeTimers();
    let time = NOW;
    const storage = memoryStorage();
    renderHook(() => useStudium({ storage, clock: () => time }));
    time = new Date(NOW.getTime() + PET_STATUS_REFRESH_MS);
    act(() => {
      vi.advanceTimersByTime(PET_STATUS_REFRESH_MS);
    });
    expect(published(storage).updatedAt).toBe(time.toISOString());
  });
});

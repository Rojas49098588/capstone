// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NOW } from "../planner/testData";
import { memoryStorage, savedData } from "../test/render";
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

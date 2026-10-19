import { describe, expect, it } from "vitest";
import { addDays, endOfLocalDay, localDateKey, startOfLocalDay, startOfWeek, wholeDaysBetween } from "./time";

describe("time helpers", () => {
  it("formats a local date key, even late in the evening", () => {
    expect(localDateKey(new Date(2026, 9, 14, 23, 30))).toBe("2026-10-14");
    expect(localDateKey(new Date(2026, 0, 5, 0, 0))).toBe("2026-01-05");
  });

  it("parses a date key as local midnight and local end of day", () => {
    const start = startOfLocalDay("2026-12-01");
    expect([start.getFullYear(), start.getMonth(), start.getDate(), start.getHours()]).toEqual([2026, 11, 1, 0]);
    const end = endOfLocalDay("2026-12-01");
    expect([end.getDate(), end.getHours(), end.getMinutes()]).toEqual([1, 23, 59]);
  });

  it("counts whole days and never goes negative", () => {
    const a = new Date(2026, 9, 1, 12);
    expect(wholeDaysBetween(a, new Date(2026, 9, 8, 11))).toBe(6);
    expect(wholeDaysBetween(a, new Date(2026, 9, 8, 12))).toBe(7);
    expect(wholeDaysBetween(new Date(2026, 9, 8), a)).toBe(0);
  });

  it("adds calendar days", () => {
    expect(localDateKey(addDays(new Date(2026, 9, 30, 12), 3))).toBe("2026-11-02");
  });
});

describe("time helpers with bad input", () => {
  it("treats an invalid date as 0 days, not NaN", () => {
    expect(wholeDaysBetween(new Date(Number.NaN), new Date(2026, 9, 8))).toBe(0);
  });
});

describe("startOfWeek", () => {
  it("starts on Monday", () => {
    expect(startOfWeek(new Date(2026, 9, 14, 12))).toEqual(new Date(2026, 9, 12));
    expect(startOfWeek(new Date(2026, 9, 18, 23))).toEqual(new Date(2026, 9, 12));
    expect(startOfWeek(new Date(2026, 9, 19, 0, 30))).toEqual(new Date(2026, 9, 19));
  });
});

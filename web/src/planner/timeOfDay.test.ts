import { describe, expect, it } from "vitest";
import { ROOM_TINT, dayPeriod, hasPlacedWindow } from "./timeOfDay";

const at = (h: number, m = 0) => new Date(2026, 10, 17, h, m);

describe("dayPeriod", () => {
  it("follows the local clock at every edge", () => {
    expect(dayPeriod(at(5, 59))).toBe("night");
    expect(dayPeriod(at(6, 0))).toBe("sunrise");
    expect(dayPeriod(at(7, 59))).toBe("sunrise");
    expect(dayPeriod(at(8, 0))).toBe("day");
    expect(dayPeriod(at(17, 59))).toBe("day");
    expect(dayPeriod(at(18, 0))).toBe("sunset");
    expect(dayPeriod(at(19, 59))).toBe("sunset");
    expect(dayPeriod(at(20, 0))).toBe("night");
    expect(dayPeriod(at(0, 0))).toBe("night");
  });
});

describe("ROOM_TINT", () => {
  it("leaves the day alone and tints the rest", () => {
    expect(ROOM_TINT.day).toBeNull();
    for (const p of ["sunrise", "sunset", "night"] as const) expect(typeof ROOM_TINT[p]).toBe("string");
  });
});

describe("hasPlacedWindow", () => {
  it("is true only when a window is on a wall", () => {
    expect(hasPlacedWindow({ wallLeft: "window" })).toBe(true);
    expect(hasPlacedWindow({ wallLeft: "clock", wallRight: "window" })).toBe(true);
    expect(hasPlacedWindow({})).toBe(false);
    expect(hasPlacedWindow(undefined)).toBe(false);
    expect(hasPlacedWindow({ wallLeft: "clock" })).toBe(false);
  });
});

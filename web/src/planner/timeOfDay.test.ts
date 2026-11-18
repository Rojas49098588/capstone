import { describe, expect, it } from "vitest";
import { ROOM_TINT, dayPeriod, hasPlacedWindow, season, snowDepth, weather } from "./timeOfDay";

const at = (month: number, day: number, h: number, m = 0) => new Date(2026, month - 1, day, h, m);

describe("dayPeriod follows the season", () => {
  it("in November it's dark by 6 pm", () => {
    expect(dayPeriod(at(11, 17, 6, 29))).toBe("night");
    expect(dayPeriod(at(11, 17, 6, 30))).toBe("sunrise");
    expect(dayPeriod(at(11, 17, 7, 59))).toBe("sunrise");
    expect(dayPeriod(at(11, 17, 8, 0))).toBe("day");
    expect(dayPeriod(at(11, 17, 16, 30))).toBe("day");
    expect(dayPeriod(at(11, 17, 16, 45))).toBe("sunset");
    expect(dayPeriod(at(11, 17, 17, 50))).toBe("sunset");
    expect(dayPeriod(at(11, 17, 18, 0))).toBe("night");
  });
  it("in June it stays light until about 8:30 pm", () => {
    expect(dayPeriod(at(6, 21, 19, 45))).toBe("day");
    expect(dayPeriod(at(6, 21, 20, 30))).toBe("sunset");
    expect(dayPeriod(at(6, 21, 21, 10))).toBe("night");
    expect(dayPeriod(at(6, 21, 0, 0))).toBe("night");
  });
});

describe("season", () => {
  it("follows the northern hemisphere's months", () => {
    expect([12, 1, 2].map((m) => season(at(m, 10, 12)))).toEqual(["winter", "winter", "winter"]);
    expect([3, 4, 5].map((m) => season(at(m, 10, 12)))).toEqual(["spring", "spring", "spring"]);
    expect([6, 7, 8].map((m) => season(at(m, 10, 12)))).toEqual(["summer", "summer", "summer"]);
    expect([9, 10, 11].map((m) => season(at(m, 10, 12)))).toEqual(["fall", "fall", "fall"]);
  });
});

describe("weather", () => {
  it("snows all winter", () => {
    for (let h = 0; h < 24; h++) expect(weather(at(12, 3, h, 15))).toBe("snow");
  });
  it("rains now and then the rest of the year, never snows, and is the same each time it's asked", () => {
    let rainy = 0;
    let hours = 0;
    for (let d = 1; d <= 30; d++) {
      for (let h = 0; h < 24; h++) {
        const w = weather(at(4, d, h, 10));
        expect(w).not.toBe("snow");
        expect(weather(at(4, d, h, 10))).toBe(w);
        hours++;
        if (w === "rain") rainy++;
      }
    }
    expect(rainy / hours).toBeGreaterThan(0.08);
    expect(rainy / hours).toBeLessThan(0.25);
  });
  it("a rain spell lasts 20 to 40 minutes from the top of the hour", () => {
    for (let d = 1; d <= 30; d++) {
      for (let h = 0; h < 24; h++) {
        if (weather(at(4, d, h, 0)) !== "rain") continue;
        expect(weather(at(4, d, h, 19))).toBe("rain");
        expect(weather(at(4, d, h, 41))).toBe("clear");
      }
    }
  });
});

describe("snowDepth", () => {
  it("is nothing outside winter", () => {
    expect(snowDepth(at(6, 21, 15))).toBe(0);
  });
  it("piles up through a winter day, up to a limit", () => {
    expect(snowDepth(at(12, 3, 1))).toBeLessThan(snowDepth(at(12, 3, 12)));
    expect(snowDepth(at(12, 3, 12))).toBeLessThanOrEqual(snowDepth(at(12, 3, 23, 59)));
    expect(snowDepth(at(12, 3, 23, 59))).toBeLessThanOrEqual(0.2);
    expect(snowDepth(at(12, 3, 0, 0))).toBeGreaterThan(0);
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

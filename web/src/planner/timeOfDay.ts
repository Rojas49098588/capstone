// The time of day for the Window decor (shop, toys and window spec): fixed local hours, not the real sun.
import type { HabitatDecor } from "./types";

export type DayPeriod = "sunrise" | "day" | "sunset" | "night";

/** Sunrise 6:00–7:59, day 8:00–17:59, sunset 18:00–19:59, night 20:00–5:59, by the computer's clock. */
export function dayPeriod(now: Date): DayPeriod {
  const h = now.getHours();
  if (h >= 6 && h < 8) return "sunrise";
  if (h >= 8 && h < 18) return "day";
  if (h >= 18 && h < 20) return "sunset";
  return "night";
}

/** The light laid over a room that has a window: none by day, warm at sunrise and sunset, dark and cool at night. */
export const ROOM_TINT: Record<DayPeriod, string | null> = {
  sunrise: "rgba(255, 170, 110, 0.14)",
  day: null,
  sunset: "rgba(240, 120, 70, 0.18)",
  night: "rgba(20, 30, 80, 0.38)",
};

export const WINDOW_ID = "window";

/** Whether a window is placed on one of the habitat's walls (owned but unplaced doesn't count). */
export function hasPlacedWindow(decor: HabitatDecor | undefined): boolean {
  return decor?.wallLeft === WINDOW_ID || decor?.wallRight === WINDOW_ID;
}

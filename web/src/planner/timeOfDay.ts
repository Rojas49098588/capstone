// The time of day, season and weather for the Window decor (shop, toys and window spec). It follows
// the computer's clock and the time of year, not the real sky: sunrise and sunset come from a month
// table close to the central US (Dallas), seasons are the northern hemisphere's, and the weather is
// picked from the date and hour so every habitat shows the same sky and it doesn't flicker.
import type { HabitatDecor } from "./types";

export type DayPeriod = "sunrise" | "day" | "sunset" | "night";
export type Season = "winter" | "spring" | "summer" | "fall";
export type Weather = "clear" | "rain" | "snow";

/** [sunrise, sunset] in local clock hours (daylight saving included), for each month from January. */
const SUN_HOURS: [number, number][] = [
  [7.5, 17.75],
  [7.25, 18.25],
  [7.6, 19.65],
  [7.1, 20.0],
  [6.5, 20.35],
  [6.3, 20.6],
  [6.45, 20.55],
  [6.85, 20.15],
  [7.2, 19.55],
  [7.5, 18.95],
  [7.0, 17.4],
  [7.35, 17.4],
];

// How the glow sits around the sun's times, in hours.
const SUNRISE_BEFORE = 0.5;
const SUNRISE_AFTER = 1;
const SUNSET_BEFORE = 0.75;
const SUNSET_AFTER = 0.5;

/** Sunrise and sunset glow around this month's sun times; day between them; night otherwise. */
export function dayPeriod(now: Date): DayPeriod {
  const [rise, set] = SUN_HOURS[now.getMonth()];
  const h = now.getHours() + now.getMinutes() / 60;
  if (h >= rise - SUNRISE_BEFORE && h < rise + SUNRISE_AFTER) return "sunrise";
  if (h >= rise + SUNRISE_AFTER && h < set - SUNSET_BEFORE) return "day";
  if (h >= set - SUNSET_BEFORE && h < set + SUNSET_AFTER) return "sunset";
  return "night";
}

/** Winter Dec–Feb, spring Mar–May, summer Jun–Aug, fall Sep–Nov. */
export function season(now: Date): Season {
  const m = now.getMonth();
  if (m === 11 || m <= 1) return "winter";
  if (m <= 4) return "spring";
  if (m <= 7) return "summer";
  return "fall";
}

/** A small, stable hash of a number (the same input always gives the same output). */
function mix(n: number): number {
  let x = n | 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  return (x ^ (x >>> 16)) >>> 0;
}

// Outside winter, about one hour in RAIN_ONE_IN rains, for RAIN_MIN_MINUTES to RAIN_MAX_MINUTES from the hour.
const RAIN_ONE_IN = 6;
const RAIN_MIN_MINUTES = 20;
const RAIN_MAX_MINUTES = 40;

/** Snow all winter (for now); otherwise rain now and then. */
export function weather(now: Date): Weather {
  if (season(now) === "winter") return "snow";
  const hourKey = ((now.getFullYear() * 13 + now.getMonth()) * 32 + now.getDate()) * 24 + now.getHours();
  const h = mix(hourKey);
  if (h % RAIN_ONE_IN !== 0) return "clear";
  const minutes = RAIN_MIN_MINUTES + (mix(h) % (RAIN_MAX_MINUTES - RAIN_MIN_MINUTES + 1));
  return now.getMinutes() < minutes ? "rain" : "clear";
}

/** How much snow sits on the sill, as a share of the window's height: it piles up through a winter day. */
export function snowDepth(now: Date): number {
  if (season(now) !== "winter") return 0;
  const hours = now.getHours() + now.getMinutes() / 60;
  return 0.05 + 0.12 * (hours / 24);
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

export const DAY_MS = 86_400_000;

/** "YYYY-MM-DD" for the local calendar day of `d`. */
export function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Local midnight at the start of a "YYYY-MM-DD" day. */
export function startOfLocalDay(key: string): Date {
  return new Date(`${key}T00:00:00`);
}

/** The last millisecond of a "YYYY-MM-DD" local day. */
export function endOfLocalDay(key: string): Date {
  return new Date(`${key}T23:59:59.999`);
}

/** Whole days from `from` to `to`, rounded down, never negative. */
export function wholeDaysBetween(from: Date, to: Date): number {
  const days = Math.floor((to.getTime() - from.getTime()) / DAY_MS);
  return Number.isFinite(days) ? Math.max(0, days) : 0;
}

/** True for a real calendar day written as "YYYY-MM-DD". */
export function isDateKey(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && localDateKey(startOfLocalDay(value)) === value;
}

/** Local midnight on the Monday of `now`'s week. */
export function startOfWeek(now: Date): Date {
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return addDays(day, -((day.getDay() + 6) % 7));
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

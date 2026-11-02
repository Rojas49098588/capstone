// Food (food spec): a snack lifts a struggling pet's shown mood for a while, a meal boosts its
// project's tokens for a while. Everything is worked out from "fed" events and the current time.
import { inventory } from "./history";
import type { ProjectMood } from "./mood";
import type { PetRef } from "./pets";
import { addDays, localDateKey, startOfLocalDay } from "./time";
import { MEAL_HOURS, MEAL_PRODUCT_ID, SNACK_HOURS, SNACK_PRODUCT_ID } from "./tuning";
import type { Mood, StudiumData, StudiumEvent } from "./types";

const HOUR_MS = 3_600_000;

export type FoodKind = "snack" | "meal";
export type FeedRefusal = "egg" | "sick" | "recovering" | "wait" | "not-hungry" | "none-owned";
export type FeedCheck = { ok: true; extendsBoost: boolean } | { ok: false; reason: FeedRefusal; nextAt: Date | null };

type FedEvent = Extract<StudiumEvent, { type: "fed" }>;

export function foodKind(productId: string): FoodKind | null {
  if (productId === SNACK_PRODUCT_ID) return "snack";
  if (productId === MEAL_PRODUCT_ID) return "meal";
  return null;
}

/** Upset → Worried, Worried → Happy; a snack never lifts any other mood. */
export function liftMood(mood: Mood): Mood {
  if (mood === "Upset") return "Worried";
  if (mood === "Worried") return "Happy";
  return mood;
}

/** Feedings of one kind up to now (later stamps are ignored), oldest first. */
function feedings(events: StudiumEvent[], kind: FoodKind, now: Date, keep: (e: FedEvent) => boolean): FedEvent[] {
  return events
    .filter((e): e is FedEvent => e.type === "fed" && foodKind(e.productId) === kind && Date.parse(e.at) <= now.getTime() && keep(e))
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

function lastSnackAt(events: StudiumEvent[], petId: string, now: Date): number | null {
  const snacks = feedings(events, "snack", now, (e) => e.petId === petId);
  return snacks.length > 0 ? Date.parse(snacks[snacks.length - 1].at) : null;
}

/** When this pet's snack stops lifting its mood, or null when no snack is lifting it. */
export function snackLiftUntil(events: StudiumEvent[], petId: string, now: Date): Date | null {
  const last = lastSnackAt(events, petId, now);
  if (last === null) return null;
  const end = last + SNACK_HOURS * HOUR_MS;
  return end > now.getTime() ? new Date(end) : null;
}

/** The soonest end of any pet's running snack lift, or null when no snack is lifting a mood. */
export function nextLiftEnd(events: StudiumEvent[], now: Date): Date | null {
  const pets = new Set(feedings(events, "snack", now, () => true).map((e) => e.petId));
  const ends = [...pets].map((petId) => snackLiftUntil(events, petId, now)).filter((d): d is Date => d !== null);
  return ends.length > 0 ? new Date(Math.min(...ends.map((d) => d.getTime()))) : null;
}

/** When the project's meal boost ends, or null when none is running. A meal while it runs adds MEAL_HOURS. */
export function mealBoostUntil(events: StudiumEvent[], projectId: string, now: Date): Date | null {
  let end = 0;
  for (const e of feedings(events, "meal", now, (f) => f.projectId === projectId)) {
    const at = Date.parse(e.at);
    end = (end > at ? end : at) + MEAL_HOURS * HOUR_MS;
  }
  return end > now.getTime() ? new Date(end) : null;
}

/** The mood a pet shows: one step up while a snack is lifting it, never for a Sick or Recovering pet. */
export function withSnack(m: ProjectMood, petId: string, events: StudiumEvent[], now: Date): ProjectMood {
  if (m.health.sick || m.health.recovering) return m;
  if (snackLiftUntil(events, petId, now) === null) return m;
  const lifted = liftMood(m.mood);
  return lifted === m.mood ? m : { ...m, mood: lifted, liftedFrom: m.mood };
}

/** Whether this pet can eat this kind of food now. `mood` is the pet's petMood (null for an egg). */
export function canFeed(data: StudiumData, pet: PetRef, mood: ProjectMood | null, kind: FoodKind, now: Date): FeedCheck {
  const refuse = (reason: FeedRefusal, nextAt: Date | null = null): FeedCheck => ({ ok: false, reason, nextAt });
  if (pet.stage === "egg" || mood === null) return refuse("egg");
  if (mood.health.sick) return refuse("sick");
  if (mood.health.recovering) return refuse("recovering");

  if (kind === "snack") {
    const last = lastSnackAt(data.events, pet.petId, now);
    if (last !== null && last + SNACK_HOURS * HOUR_MS > now.getTime()) return refuse("wait", new Date(last + SNACK_HOURS * HOUR_MS));
    const before = mood.liftedFrom ?? mood.mood;
    if (before !== "Worried" && before !== "Upset") return refuse("not-hungry");
  } else {
    const today = localDateKey(now);
    const ateToday = feedings(data.events, "meal", now, (e) => e.petId === pet.petId && localDateKey(new Date(e.at)) === today);
    if (ateToday.length > 0) return refuse("wait", startOfLocalDay(localDateKey(addDays(now, 1))));
  }

  const productId = kind === "snack" ? SNACK_PRODUCT_ID : MEAL_PRODUCT_ID;
  if ((inventory(data.events)[productId] ?? 0) === 0) return refuse("none-owned");
  return { ok: true, extendsBoost: kind === "meal" && mealBoostUntil(data.events, pet.projectId, now) !== null };
}

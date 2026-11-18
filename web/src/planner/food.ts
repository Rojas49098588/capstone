// Food (food spec; shop, toys and window spec): a snack lifts a struggling pet's shown mood or gives
// tokens, a meal boosts its project's tokens or shortens the pet's snack wait. Everything is worked
// out from "fed" events, the food catalog (foods.ts) and the current time.
import { findFood, isFavorite, type FoodKind } from "./foods";
import { inventory } from "./history";
import type { ProjectMood } from "./mood";
import type { PetRef } from "./pets";
import { addDays, localDateKey, startOfLocalDay } from "./time";
import { FAVORITE_BONUS_SHARE, SNACK_WAIT_HOURS } from "./tuning";
import type { Mood, PetKind, StudiumData, StudiumEvent } from "./types";

export type { FoodKind } from "./foods";

const HOUR_MS = 3_600_000;

export type FeedRefusal = "egg" | "sick" | "recovering" | "wait" | "not-hungry" | "none-owned";
export type FeedCheck = { ok: true; extendsBoost: boolean } | { ok: false; reason: FeedRefusal; nextAt: Date | null };
export type RunningBoost = { productId: string; multiplier: number; until: Date };

type FedEvent = Extract<StudiumEvent, { type: "fed" }>;

export function foodKind(productId: string): FoodKind | null {
  return findFood(productId)?.kind ?? null;
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

function lastSnack(events: StudiumEvent[], petId: string, now: Date): FedEvent | null {
  const snacks = feedings(events, "snack", now, (e) => e.petId === petId);
  return snacks.length > 0 ? snacks[snacks.length - 1] : null;
}

/** The start of the local day after `at`'s: when "until midnight" effects end. */
function nextMidnight(at: Date): Date {
  return startOfLocalDay(localDateKey(addDays(at, 1)));
}

/** When this pet's snack stops lifting its mood, or null when no snack is lifting it. */
export function snackLiftUntil(events: StudiumEvent[], petId: string, now: Date): Date | null {
  const last = lastSnack(events, petId, now);
  const effect = last ? findFood(last.productId)?.effect : undefined;
  if (!last || effect?.type !== "lift") return null;
  const end = Date.parse(last.at) + effect.hours * HOUR_MS;
  return end > now.getTime() ? new Date(end) : null;
}

/** Hours this pet waits between snacks now: shorter after a "snackWait" meal eaten earlier today. */
export function snackWaitHours(events: StudiumEvent[], petId: string, now: Date): number {
  const today = localDateKey(now);
  let hours = SNACK_WAIT_HOURS;
  for (const e of feedings(events, "meal", now, (f) => f.petId === petId && localDateKey(new Date(f.at)) === today)) {
    const effect = findFood(e.productId)?.effect;
    if (effect?.type === "snackWait") hours = Math.min(hours, effect.hours);
  }
  return hours;
}

/** The soonest end of any pet's running snack lift, or null when no snack is lifting a mood. */
export function nextLiftEnd(events: StudiumEvent[], now: Date): Date | null {
  const pets = new Set(feedings(events, "snack", now, () => true).map((e) => e.petId));
  const ends = [...pets].map((petId) => snackLiftUntil(events, petId, now)).filter((d): d is Date => d !== null);
  return ends.length > 0 ? new Date(Math.min(...ends.map((d) => d.getTime()))) : null;
}

/**
 * The project's meal boosts running now, one per food, in feeding order of first appearance. A food
 * that `extends` (Power Bento) adds its hours to its own running boost; other foods' boosts each run
 * from their own feeding.
 */
export function runningBoosts(events: StudiumEvent[], projectId: string, now: Date): RunningBoost[] {
  const ends = new Map<string, { multiplier: number; end: number }>();
  for (const e of feedings(events, "meal", now, (f) => f.projectId === projectId)) {
    const effect = findFood(e.productId)?.effect;
    const at = Date.parse(e.at);
    let end: number;
    let multiplier: number;
    if (effect?.type === "boost") {
      const running = ends.get(e.productId)?.end ?? 0;
      end = (effect.extends && running > at ? running : at) + effect.hours * HOUR_MS;
      multiplier = effect.multiplier;
    } else if (effect?.type === "boostToday") {
      end = nextMidnight(new Date(at)).getTime();
      multiplier = effect.multiplier;
    } else continue;
    const before = ends.get(e.productId);
    ends.set(e.productId, { multiplier, end: Math.max(end, before?.end ?? 0) });
  }
  return [...ends.entries()]
    .filter(([, b]) => b.end > now.getTime())
    .map(([productId, b]) => ({ productId, multiplier: b.multiplier, until: new Date(b.end) }));
}

/** The highest running boost's entry, or null when none is running. */
export function topMealBoost(events: StudiumEvent[], projectId: string, now: Date): RunningBoost | null {
  let top: RunningBoost | null = null;
  for (const b of runningBoosts(events, projectId, now)) {
    if (!top || b.multiplier > top.multiplier || (b.multiplier === top.multiplier && b.until > top.until)) top = b;
  }
  return top;
}

/** What tasks on the project earn × now: the highest running boost, never the product of them. */
export function mealMultiplier(events: StudiumEvent[], projectId: string, now: Date): number {
  return topMealBoost(events, projectId, now)?.multiplier ?? 1;
}

/** When the project's highest running meal boost ends, or null when none is running. */
export function mealBoostUntil(events: StudiumEvent[], projectId: string, now: Date): Date | null {
  return topMealBoost(events, projectId, now)?.until ?? null;
}

/** The mood a pet shows: one step up while a snack is lifting it, never for a Sick or Recovering pet. */
export function withSnack(m: ProjectMood, petId: string, events: StudiumEvent[], now: Date): ProjectMood {
  if (m.health.sick || m.health.recovering) return m;
  if (snackLiftUntil(events, petId, now) === null) return m;
  const lifted = liftMood(m.mood);
  return lifted === m.mood ? m : { ...m, mood: lifted, liftedFrom: m.mood };
}

/** Whether this pet can eat this food now. `mood` is the pet's petMood (null for an egg). */
export function canFeed(data: StudiumData, pet: PetRef, mood: ProjectMood | null, productId: string, now: Date): FeedCheck {
  const refuse = (reason: FeedRefusal, nextAt: Date | null = null): FeedCheck => ({ ok: false, reason, nextAt });
  const food = findFood(productId);
  if (pet.stage === "egg" || mood === null) return refuse("egg");
  if (mood.health.sick) return refuse("sick");
  if (mood.health.recovering) return refuse("recovering");
  if (!food) return refuse("none-owned");

  if (food.kind === "snack") {
    const last = lastSnack(data.events, pet.petId, now);
    const next = last === null ? null : Date.parse(last.at) + snackWaitHours(data.events, pet.petId, now) * HOUR_MS;
    if (next !== null && next > now.getTime()) return refuse("wait", new Date(next));
    const before = mood.liftedFrom ?? mood.mood;
    if (food.effect.type === "lift" && before !== "Worried" && before !== "Upset") return refuse("not-hungry");
  } else {
    const today = localDateKey(now);
    const ateToday = feedings(data.events, "meal", now, (e) => e.petId === pet.petId && localDateKey(new Date(e.at)) === today);
    if (ateToday.length > 0) return refuse("wait", nextMidnight(now));
  }

  if ((inventory(data.events)[productId] ?? 0) === 0) return refuse("none-owned");
  const extendsBoost =
    food.effect.type === "boost" && food.effect.extends && runningBoosts(data.events, pet.projectId, now).some((b) => b.productId === productId);
  return { ok: true, extendsBoost };
}

/** The tokens a feeding gives: the food's instant tokens, plus a share of its price when it's the pet's favorite. */
export function feedTokens(productId: string, petKind: PetKind): number {
  const food = findFood(productId);
  if (!food) return 0;
  const instant = food.effect.type === "tokens" ? food.effect.tokens : 0;
  return instant + (isFavorite(productId, petKind) ? Math.floor(food.price * FAVORITE_BONUS_SHARE) : 0);
}

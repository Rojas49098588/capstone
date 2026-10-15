// Facts derived from the event history. The history is the source of truth for
// tokens, inventory, "last moved" and whether something was already paid.
import { localDateKey } from "./time";
import { MEDICINE_PRODUCT_ID, STARTING_TOKENS } from "./tuning";
import type { CompletedEvent, StudiumEvent } from "./types";

const isCompleted = (e: StudiumEvent): e is CompletedEvent => e.type === "task_completed";

export function hasBeenCompleted(events: StudiumEvent[], taskId: string): boolean {
  return events.some((e) => isCompleted(e) && e.taskId === taskId);
}

/**
 * When the given tasks last really moved: the latest of each task's FIRST completion
 * (up to asOf). Re-checking an already-finished task doesn't count, so it can't
 * reset neglect, cure sickness or end recovery.
 */
export function lastCompletionAt(events: StudiumEvent[], taskIds: Iterable<string>, asOf: Date): Date | null {
  const ids = new Set(taskIds);
  const firstDone = new Map<string, number>();
  for (const e of events) {
    if (!isCompleted(e) || !ids.has(e.taskId)) continue;
    firstDone.set(e.taskId, Math.min(firstDone.get(e.taskId) ?? Infinity, Date.parse(e.at)));
  }
  let latest = -Infinity;
  for (const t of firstDone.values()) if (t <= asOf.getTime() && t > latest) latest = t;
  return latest === -Infinity ? null : new Date(latest);
}

export function tokenBalance(events: StudiumEvent[]): number {
  let balance = STARTING_TOKENS;
  for (const e of events) {
    if (e.type === "task_completed") balance += e.tokens;
    else if (e.type === "purchase") balance -= e.price;
  }
  return balance;
}

export function inventory(events: StudiumEvent[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const e of events) {
    if (e.type === "purchase") {
      counts[e.productId] = (counts[e.productId] ?? 0) + 1;
    } else if (e.type === "medicine_given") {
      counts[MEDICINE_PRODUCT_ID] = Math.max(0, (counts[MEDICINE_PRODUCT_ID] ?? 0) - 1);
    }
  }
  return counts;
}

/** Completions that actually paid tokens on a local day; these drive the daily curve. */
export function paidCompletionsOnDay(events: StudiumEvent[], dayKey: string): number {
  return events.filter((e) => isCompleted(e) && e.tokens > 0 && localDateKey(new Date(e.at)) === dayKey).length;
}

export function lastMedicineGiven(events: StudiumEvent[], projectId: string, asOf: Date): Date | null {
  let latest = -Infinity;
  for (const e of events) {
    if (e.type !== "medicine_given" || e.projectId !== projectId) continue;
    const t = Date.parse(e.at);
    if (t <= asOf.getTime() && t > latest) latest = t;
  }
  return latest === -Infinity ? null : new Date(latest);
}

export function finishBonusPaid(events: StudiumEvent[], requirementId: string): boolean {
  return events.some((e) => isCompleted(e) && e.requirementId === requirementId && e.breakdown.finish > 0);
}

/** Base value already paid for a requirement's tasks (deleted tasks included). */
export function basePaidForRequirement(events: StudiumEvent[], requirementId: string): number {
  let sum = 0;
  for (const e of events) if (isCompleted(e) && e.requirementId === requirementId) sum += e.breakdown.base;
  return sum;
}

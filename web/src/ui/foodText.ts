// Food wording shared by the habitat's Food section and the phone (companion/view.ts).
import { findFood } from "../planner/foods";
import { topMealBoost } from "../planner/food";
import type { StudiumEvent } from "../planner/types";
import { durationLabel } from "./format";

/** The project's meal boost now, e.g. "Meal: × 1.1 tokens for 2h 45m more", or null when none runs. */
export function mealBoostLine(events: StudiumEvent[], projectId: string, now: Date): string | null {
  const top = topMealBoost(events, projectId, now);
  if (!top) return null;
  if (findFood(top.productId)?.effect.type === "boostToday") return `Meal: × ${top.multiplier} tokens until midnight`;
  return `Meal: × ${top.multiplier} tokens for ${durationLabel(top.until.getTime() - now.getTime())} more`;
}

import { localDateKey } from "../planner/time";
import type { StudiumData } from "../planner/types";

// Temporary: an empty data set. Task 11 replaces this with the real example data.
export function buildSeed(now: Date): StudiumData {
  return { version: 1, projects: [], requirements: [], tasks: [], events: [], today: { date: localDateKey(now), taskIds: [] } };
}

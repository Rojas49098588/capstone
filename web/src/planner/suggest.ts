import { isBlocked } from "./blocking";
import { estimateMultipliers } from "./learning";
import { localDateKey } from "./time";
import { SUGGESTED_COUNT } from "./tuning";
import type { Project, StudiumData, Task } from "./types";
import { expectedTokens } from "./value";

/** Today's plan, or nothing if it was made on an earlier day. */
export function todayTaskIds(data: StudiumData, now: Date): string[] {
  return data.today.date === localDateKey(now) ? data.today.taskIds : [];
}

export type Suggestion = { task: Task; project: Project; expectedTokens: number };

export function suggestNext(data: StudiumData, now: Date, count: number = SUGGESTED_COUNT): Suggestion[] {
  const multipliers = estimateMultipliers(data);
  const inToday = new Set(todayTaskIds(data, now));
  const projects = new Map(data.projects.map((p) => [p.id, p]));
  return data.tasks
    .filter(
      (t) =>
        !t.done && t.requirementId !== null && !inToday.has(t.id) && projects.has(t.projectId) && !isBlocked(t, data.tasks),
    )
    .map((t) => ({
      task: t,
      project: projects.get(t.projectId) as Project,
      expectedTokens: expectedTokens(t, data, now, multipliers),
    }))
    .sort((a, b) => Number(b.task.priority) - Number(a.task.priority) || b.expectedTokens - a.expectedTokens)
    .slice(0, count);
}

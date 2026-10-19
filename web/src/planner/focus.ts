// Focus time: naps with a browser pet, recorded as focus_session events.
import type { StudiumEvent, Task } from "./types";

export type FocusFilter = { projectId?: string; taskId?: string; since?: Date };

/** Minutes of focus sessions matching every given field; `since` compares when a session ended. */
export function focusMinutes(events: StudiumEvent[], filter: FocusFilter): number {
  const since = filter.since?.getTime() ?? -Infinity;
  let sum = 0;
  for (const e of events) {
    if (e.type !== "focus_session") continue;
    if (filter.projectId !== undefined && e.projectId !== filter.projectId) continue;
    if (filter.taskId !== undefined && e.taskId !== filter.taskId) continue;
    if (Date.parse(e.at) < since) continue;
    sum += e.minutes;
  }
  return sum;
}

/** Focus time counts from when the task was created or last reopened, whichever is later. */
export function taskFocusStart(task: Task, events: StudiumEvent[]): Date {
  let start = Date.parse(task.createdAt);
  for (const e of events) {
    if (e.type === "task_reopened" && e.taskId === task.id) start = Math.max(start, Date.parse(e.at));
  }
  return new Date(start);
}

export function taskFocusMinutes(task: Task, events: StudiumEvent[]): number {
  return focusMinutes(events, { taskId: task.id, since: taskFocusStart(task, events) });
}

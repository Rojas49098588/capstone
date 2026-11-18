// The order of tasks within a list: a requirement's tasks, or a project's Unlinked tasks (tasks and
// requirements view spec). Order is only how a list looks: planning never reads it.
import type { Task } from "./types";

/** The tasks in the same list as `task` (same project and requirement; null = Unlinked), in array order. */
export function listOf(task: Pick<Task, "projectId" | "requirementId">, tasks: Task[]): Task[] {
  return tasks.filter((t) => t.projectId === task.projectId && t.requirementId === task.requirementId);
}

/** Has someone reordered this list? True once any unfinished task in it has an order. */
export function isReordered(tasks: Task[]): boolean {
  return tasks.some((t) => !t.done && t.order !== undefined);
}

function byOrder(a: Task, b: Task): number {
  const oa = a.order ?? Number.POSITIVE_INFINITY;
  const ob = b.order ?? Number.POSITIVE_INFINITY;
  if (oa !== ob) return oa < ob ? -1 : 1;
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * A list as it shows: unfinished tasks first, then done ones in their saved order. A list nobody has
 * reordered keeps its old look (★ first); a reordered one follows its order numbers.
 */
export function sortListTasks(tasks: Task[]): Task[] {
  const open = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);
  const sorted = isReordered(tasks)
    ? [...open].sort(byOrder)
    : [...open].sort((a, b) => Number(b.priority) - Number(a.priority));
  return [...sorted, ...done];
}

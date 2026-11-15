// A task's own due date (optional; for reminders only). It can't be later than its requirement's due
// date, which falls back to the project deadline. Nothing here changes mood, the plan or tokens.
import type { StudiumData, Task } from "./types";

type Lookup = Pick<StudiumData, "projects" | "requirements">;

/** The latest a task may be due: its requirement's due date, else the project deadline. null if the project is gone. */
export function taskDueLimit(task: Pick<Task, "projectId" | "requirementId">, data: Lookup): string | null {
  const project = data.projects.find((p) => p.id === task.projectId);
  if (!project) return null;
  const requirement = task.requirementId ? data.requirements.find((r) => r.id === task.requirementId) : undefined;
  return requirement?.dueDate ?? project.deadline;
}

/** When the task is due: the earlier of its own date and its limit (date keys sort as strings). */
export function taskDueDate(task: Task, data: Lookup): string | null {
  const limit = taskDueLimit(task, data);
  const own = task.dueDate ?? null;
  if (own === null) return limit;
  return limit !== null && limit < own ? limit : own;
}

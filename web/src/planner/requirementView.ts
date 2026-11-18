// The ≡ menu's views of a project's requirements (tasks and requirements view spec). Only what shows:
// nothing here changes the data.
import { isRequirementDone } from "./progress";
import { todayTaskIds } from "./suggest";
import { addDays, localDateKey } from "./time";
import { SOON_DAYS } from "./tuning";
import type { Project, Requirement, StudiumData, Task } from "./types";

/** The ≡ menu's filters. They stack: each one narrows what the others show. None = Show all. */
export type RequirementFilter = "today" | "hideCompleted" | "soon";
export const REQUIREMENT_FILTERS: readonly RequirementFilter[] = ["today", "hideCompleted", "soon"];

export const SHOW_ALL_LABEL = "Show all";
export const FILTER_LABELS: Record<RequirementFilter, string> = {
  today: "Today's to-do",
  hideCompleted: "Hide completed",
  soon: "Soon",
};

/** How a set of filters reads on the ≡ button and the "more hidden" line, in the menu's order. */
export function filtersLabel(filters: readonly RequirementFilter[]): string {
  const on = REQUIREMENT_FILTERS.filter((f) => filters.includes(f));
  return on.length === 0 ? SHOW_ALL_LABEL : on.map((f) => FILTER_LABELS[f]).join(" + ");
}

/** Unfinished and due (its own date, or the project deadline) within SOON_DAYS from today; overdue counts. */
export function isSoon(req: Requirement, project: Project, tasks: Task[], now: Date): boolean {
  if (isRequirementDone(req.id, tasks)) return false;
  return (req.dueDate ?? project.deadline) <= localDateKey(addDays(now, SOON_DAYS));
}

export type ViewResult = {
  requirements: Requirement[]; // the ones shown, in the data's order
  tasksShown: (requirementId: string | null) => (t: Task) => boolean; // which tasks of a list show
  hiddenCount: number; // the project's requirements this view hides
  showUnlinked: boolean;
};

export function viewOf(projectId: string, data: StudiumData, filters: readonly RequirementFilter[], now: Date): ViewResult {
  const project = data.projects.find((p) => p.id === projectId);
  const all = data.requirements.filter((r) => r.projectId === projectId);
  const tasks = data.tasks.filter((t) => t.projectId === projectId);
  const on = (f: RequirementFilter) => filters.includes(f);
  const today = new Set(todayTaskIds(data, now));

  const taskShown = (t: Task) => (!on("today") || today.has(t.id)) && (!on("hideCompleted") || !t.done);
  const tasksShown: ViewResult["tasksShown"] = () => taskShown;
  const requirements = all.filter((r) => {
    if (on("hideCompleted") && isRequirementDone(r.id, tasks)) return false;
    if (on("soon") && !(project && isSoon(r, project, tasks, now))) return false;
    // Today's to-do: only requirements with something left to show.
    if (on("today") && !tasks.some((t) => t.requirementId === r.id && taskShown(t))) return false;
    return true;
  });
  const showUnlinked = !on("soon") && (!on("today") || tasks.some((t) => t.requirementId === null && taskShown(t)));
  return { requirements, tasksShown, hiddenCount: all.length - requirements.length, showUnlinked };
}

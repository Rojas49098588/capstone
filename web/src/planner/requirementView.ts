// The ≡ menu's views of a project's requirements (tasks and requirements view spec). Only what shows:
// nothing here changes the data.
import { isRequirementDone } from "./progress";
import { todayTaskIds } from "./suggest";
import { addDays, localDateKey } from "./time";
import { SOON_DAYS } from "./tuning";
import type { Project, Requirement, StudiumData, Task } from "./types";

export type RequirementView = "all" | "today" | "hideCompleted" | "soon";
export const REQUIREMENT_VIEWS: readonly RequirementView[] = ["all", "today", "hideCompleted", "soon"];

export const VIEW_LABELS: Record<RequirementView, string> = {
  all: "Show all",
  today: "Today's to-do",
  hideCompleted: "Hide completed",
  soon: "Soon",
};

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

export function viewOf(projectId: string, data: StudiumData, view: RequirementView, now: Date): ViewResult {
  const project = data.projects.find((p) => p.id === projectId);
  const all = data.requirements.filter((r) => r.projectId === projectId);
  const tasks = data.tasks.filter((t) => t.projectId === projectId);
  const everything = () => () => true;

  let requirements = all;
  let tasksShown: ViewResult["tasksShown"] = everything;
  let showUnlinked = true;
  if (view === "today") {
    const today = new Set(todayTaskIds(data, now));
    tasksShown = () => (t) => today.has(t.id);
    requirements = all.filter((r) => tasks.some((t) => t.requirementId === r.id && today.has(t.id)));
    showUnlinked = tasks.some((t) => t.requirementId === null && today.has(t.id));
  } else if (view === "hideCompleted") {
    tasksShown = () => (t) => !t.done;
    requirements = all.filter((r) => !isRequirementDone(r.id, tasks));
  } else if (view === "soon") {
    requirements = project ? all.filter((r) => isSoon(r, project, tasks, now)) : [];
    showUnlinked = false;
  }
  return { requirements, tasksShown, hiddenCount: all.length - requirements.length, showUnlinked };
}

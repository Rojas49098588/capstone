// Real progress (effort-based, no bonuses) and the plan it is compared against.
import { multiplierFor, type Multipliers } from "./learning";
import { endOfLocalDay, startOfLocalDay } from "./time";
import type { Project, Requirement, StudiumData, Task } from "./types";

export function taskEffort(task: Task, multiplier: number): number {
  return task.done ? (task.actualMin ?? task.estimateMin) : task.estimateMin * multiplier;
}

export function tasksOfRequirement(requirementId: string, tasks: Task[]): Task[] {
  return tasks.filter((t) => t.requirementId === requirementId);
}

export function requirementProgress(requirementId: string, tasks: Task[], multiplier: number): number {
  let total = 0;
  let done = 0;
  for (const t of tasksOfRequirement(requirementId, tasks)) {
    const effort = taskEffort(t, multiplier);
    total += effort;
    if (t.done) done += effort;
  }
  return total > 0 ? done / total : 0;
}

export function isRequirementDone(requirementId: string, tasks: Task[]): boolean {
  const list = tasksOfRequirement(requirementId, tasks);
  return list.length > 0 && list.every((t) => t.done);
}

export function requirementStart(req: Requirement): Date {
  return req.startDate ? startOfLocalDay(req.startDate) : new Date(req.createdAt);
}

export function requirementDue(req: Requirement, project: Project): Date {
  return endOfLocalDay(req.dueDate ?? project.deadline);
}

export function plannedProgress(req: Requirement, project: Project, now: Date): number {
  const s = requirementStart(req).getTime();
  const d = requirementDue(req, project).getTime();
  const t = now.getTime();
  if (!Number.isFinite(s) || !Number.isFinite(d)) return 0;
  if (t < s) return 0;
  if (d <= s) return 1;
  return Math.min(1, (t - s) / (d - s));
}

export function projectProgress(projectId: string, data: StudiumData, multipliers: Multipliers): number {
  const reqs = data.requirements.filter((r) => r.projectId === projectId);
  const totalWeight = reqs.reduce((s, r) => s + r.weight, 0);
  if (totalWeight === 0) return 0;
  const m = multiplierFor(multipliers, projectId);
  return reqs.reduce((s, r) => s + r.weight * requirementProgress(r.id, data.tasks, m), 0) / totalWeight;
}

/** Weighted (actual − planned) across the project's requirements, in percentage points. */
export function scheduleGap(projectId: string, data: StudiumData, multipliers: Multipliers, now: Date): number {
  const project = data.projects.find((p) => p.id === projectId);
  if (!project) return 0;
  const reqs = data.requirements.filter((r) => r.projectId === projectId);
  const totalWeight = reqs.reduce((s, r) => s + r.weight, 0);
  if (totalWeight === 0) return 0;
  const m = multiplierFor(multipliers, projectId);
  const sum = reqs.reduce(
    (s, r) => s + r.weight * (requirementProgress(r.id, data.tasks, m) - plannedProgress(r, project, now)),
    0,
  );
  return (sum / totalWeight) * 100;
}

export function totalProgress(data: StudiumData, multipliers: Multipliers): number {
  const projectIds = new Set(data.projects.map((p) => p.id));
  let weight = 0;
  let sum = 0;
  for (const r of data.requirements) {
    if (!projectIds.has(r.projectId)) continue;
    weight += r.weight;
    sum += r.weight * requirementProgress(r.id, data.tasks, multiplierFor(multipliers, r.projectId));
  }
  return weight > 0 ? sum / weight : 0;
}

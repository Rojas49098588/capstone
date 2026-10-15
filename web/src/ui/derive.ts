// Everything a screen needs to know about a project, computed once per render.
import { estimateMultipliers, multiplierFor, samplesFor, type Multipliers } from "../planner/learning";
import { projectMood, type NeglectedRequirement, type ProjectHealth } from "../planner/mood";
import { projectProgress, totalProgress } from "../planner/progress";
import type { Mood, Project, StudiumData } from "../planner/types";

export type ProjectSummary = {
  project: Project;
  progress: number; // 0..1, weighted by requirement weight
  gap: number; // percentage points vs plan
  mood: Mood;
  neglected: NeglectedRequirement[];
  health: ProjectHealth;
  multiplier: number;
  samples: number;
  tasksDone: number;
  tasksTotal: number;
};

export function summarizeProject(
  project: Project,
  data: StudiumData,
  now: Date,
  multipliers: Multipliers = estimateMultipliers(data),
): ProjectSummary {
  const m = projectMood(project.id, data, now, multipliers);
  const tasks = data.tasks.filter((t) => t.projectId === project.id);
  return {
    project,
    progress: projectProgress(project.id, data, multipliers),
    gap: m.gap,
    mood: m.mood,
    neglected: m.neglected,
    health: m.health,
    multiplier: multiplierFor(multipliers, project.id),
    samples: samplesFor(multipliers, project.id),
    tasksDone: tasks.filter((t) => t.done).length,
    tasksTotal: tasks.length,
  };
}

export type Dashboard = { summaries: ProjectSummary[]; total: number; tasksDone: number; tasksTotal: number };

export function summarizeAll(data: StudiumData, now: Date): Dashboard {
  const multipliers = estimateMultipliers(data);
  const summaries = data.projects.map((p) => summarizeProject(p, data, now, multipliers));
  return {
    summaries,
    total: totalProgress(data, multipliers),
    tasksDone: summaries.reduce((n, s) => n + s.tasksDone, 0),
    tasksTotal: summaries.reduce((n, s) => n + s.tasksTotal, 0),
  };
}

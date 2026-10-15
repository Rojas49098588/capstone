// How far off your estimates usually are. Used to make open tasks' effort realistic.
import { LEARNING_MAX_SAMPLES, LEARNING_PRIOR_SAMPLES, MULTIPLIER_MAX, MULTIPLIER_MIN } from "./tuning";
import type { StudiumData, Task } from "./types";

export type Multipliers = {
  overall: number;
  byProject: Record<string, { multiplier: number; samples: number }>;
};

const clampMultiplier = (x: number) => Math.min(MULTIPLIER_MAX, Math.max(MULTIPLIER_MIN, x));

export function estimateMultipliers(data: Pick<StudiumData, "tasks" | "events">): Multipliers {
  const lastDone = new Map<string, number>();
  for (const e of data.events) {
    if (e.type === "task_completed") lastDone.set(e.taskId, Math.max(lastDone.get(e.taskId) ?? 0, Date.parse(e.at)));
  }

  const byProjectSamples = new Map<string, Task[]>();
  for (const t of data.tasks) {
    if (!t.done || t.actualMin === null || !(t.estimateMin > 0)) continue;
    const list = byProjectSamples.get(t.projectId) ?? [];
    list.push(t);
    byProjectSamples.set(t.projectId, list);
  }
  for (const [projectId, list] of byProjectSamples) {
    list.sort((a, b) => (lastDone.get(b.id) ?? 0) - (lastDone.get(a.id) ?? 0));
    byProjectSamples.set(projectId, list.slice(0, LEARNING_MAX_SAMPLES));
  }

  const all = [...byProjectSamples.values()].flat();
  const sumEstimate = all.reduce((s, t) => s + t.estimateMin, 0);
  const sumActual = all.reduce((s, t) => s + (t.actualMin ?? 0), 0);
  const k = LEARNING_PRIOR_SAMPLES;
  // Pretend there are k extra average-sized tasks that matched their estimates exactly.
  const avgEstimate = all.length > 0 ? sumEstimate / all.length : 1;
  const overall = all.length > 0 ? clampMultiplier((sumActual + k * avgEstimate) / (sumEstimate + k * avgEstimate)) : 1;

  const byProject: Multipliers["byProject"] = {};
  for (const [projectId, list] of byProjectSamples) {
    const n = list.length;
    const ratio = list.reduce((s, t) => s + (t.actualMin ?? 0), 0) / list.reduce((s, t) => s + t.estimateMin, 0);
    byProject[projectId] = { multiplier: clampMultiplier((n * ratio + k * overall) / (n + k)), samples: n };
  }
  return { overall, byProject };
}

export function multiplierFor(m: Multipliers, projectId: string): number {
  return m.byProject[projectId]?.multiplier ?? m.overall;
}

export function samplesFor(m: Multipliers, projectId: string): number {
  return m.byProject[projectId]?.samples ?? 0;
}

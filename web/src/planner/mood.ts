// Pet mood: based on being on track with the plan, lowered by neglect,
// replaced by Sick after long neglect, capped while Recovering from medicine.
import { lastCompletionAt, lastMedicineGiven } from "./history";
import { estimateMultipliers, type Multipliers } from "./learning";
import { petStage } from "./lifecycle";
import { isRequirementDone, plannedProgress, requirementStart, scheduleGap, tasksOfRequirement } from "./progress";
import { DAY_MS, wholeDaysBetween } from "./time";
import { DELIGHTED_GAP, NEGLECT_DAYS, RECOVERY_DAYS, SICK_DAYS, UPSET_GAP, WORRIED_GAP } from "./tuning";
import type { Mood, Requirement, StudiumData } from "./types";

export function requirementIdleDays(req: Requirement, data: StudiumData, now: Date): number {
  const start = idleClockStart(req, data);
  if (now < start) return 0;
  const taskIds = tasksOfRequirement(req.id, data.tasks).map((t) => t.id);
  const last = lastCompletionAt(data.events, taskIds, now);
  return wholeDaysBetween(last && last > start ? last : start, now);
}

/**
 * When a requirement's idle clock starts: its start, or the pet's hatch if that's later, so a pet
 * that just hatched isn't neglected straight away. Only for projects with a stage: adults saved
 * before the lifecycle keep the old rules.
 */
function idleClockStart(req: Requirement, data: StudiumData): Date {
  const start = requirementStart(req);
  const project = data.projects.find((p) => p.id === req.projectId);
  if (!project || project.stage === undefined || !project.hatchedAt) return start;
  const hatched = new Date(project.hatchedAt);
  return hatched > start ? hatched : start;
}

export type NeglectedRequirement = { requirement: Requirement; idleDays: number };

/** Unfinished requirements whose plan has started and that have been idle at least `minDays`. */
export function neglectedRequirements(
  projectId: string,
  data: StudiumData,
  now: Date,
  minDays: number = NEGLECT_DAYS,
): NeglectedRequirement[] {
  const project = data.projects.find((p) => p.id === projectId);
  if (!project) return [];
  return data.requirements
    .filter((r) => r.projectId === projectId)
    .filter((r) => !isRequirementDone(r.id, data.tasks) && plannedProgress(r, project, now) > 0)
    .map((r) => ({ requirement: r, idleDays: requirementIdleDays(r, data, now) }))
    .filter((n) => n.idleDays >= minDays)
    .sort((a, b) => b.idleDays - a.idleDays);
}

export type ProjectHealth = { sick: boolean; recovering: boolean; recoveringFor: string[] };

export function projectHealth(projectId: string, data: StudiumData, now: Date): ProjectHealth {
  // An egg has no mood yet, so it can never be sick or recovering.
  const project = data.projects.find((p) => p.id === projectId);
  if (project && petStage(project) === "egg") return { sick: false, recovering: false, recoveringFor: [] };
  let recovering = false;
  let recoveringFor: string[] = [];
  const medAt = lastMedicineGiven(data.events, projectId, now);
  if (medAt && now.getTime() - medAt.getTime() < RECOVERY_DAYS * DAY_MS) {
    // The requirements that were neglected when the medicine was given.
    const before = { ...data, events: data.events.filter((e) => Date.parse(e.at) <= medAt.getTime()) };
    const targets = neglectedRequirements(projectId, before, medAt).map((n) => n.requirement.id);
    const allMoved = targets.every((id) => {
      const taskIds = tasksOfRequirement(id, data.tasks).map((t) => t.id);
      const last = lastCompletionAt(data.events, taskIds, now);
      return last !== null && last > medAt;
    });
    recovering = !allMoved;
    recoveringFor = recovering ? targets : [];
  }
  const sick = !recovering && neglectedRequirements(projectId, data, now, SICK_DAYS).length > 0;
  return { sick, recovering, recoveringFor };
}

export function moodFromGap(gap: number): Mood {
  if (gap >= DELIGHTED_GAP) return "Delighted";
  if (gap > WORRIED_GAP) return "Happy";
  if (gap > UPSET_GAP) return "Worried";
  return "Upset";
}

const LADDER: Mood[] = ["Upset", "Worried", "Happy", "Delighted"];

function lowerOneLevel(mood: Mood): Mood {
  const i = LADDER.indexOf(mood);
  return i > 0 ? LADDER[i - 1] : mood; // Upset, Proud and Sick stay as they are
}

function capAtWorried(mood: Mood): Mood {
  return mood === "Happy" || mood === "Delighted" || mood === "Proud" ? "Worried" : mood;
}

export type ProjectMood = {
  mood: Mood;
  gap: number;
  neglected: NeglectedRequirement[];
  health: ProjectHealth;
};

export function projectMood(
  projectId: string,
  data: StudiumData,
  now: Date,
  multipliers: Multipliers = estimateMultipliers(data),
): ProjectMood {
  const reqs = data.requirements.filter((r) => r.projectId === projectId);
  const gap = scheduleGap(projectId, data, multipliers, now);
  const neglected = neglectedRequirements(projectId, data, now);
  const health = projectHealth(projectId, data, now);

  let mood: Mood =
    reqs.length > 0 && reqs.every((r) => isRequirementDone(r.id, data.tasks)) ? "Proud" : moodFromGap(gap);
  if (neglected.length > 0) mood = lowerOneLevel(mood);
  if (health.sick) mood = "Sick";
  else if (health.recovering) mood = capAtWorried(mood);

  return { mood, gap, neglected, health };
}

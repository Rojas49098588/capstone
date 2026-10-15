// What a task is worth, and the tokens paid when it is completed. See spec section 2.
import { downstreamOpenCount } from "./blocking";
import { finishBonusPaid, hasBeenCompleted, paidCompletionsOnDay } from "./history";
import { estimateMultipliers, multiplierFor, type Multipliers } from "./learning";
import { projectHealth, requirementIdleDays } from "./mood";
import { isRequirementDone, taskEffort, tasksOfRequirement } from "./progress";
import { localDateKey } from "./time";
import {
  DAILY_DECAY,
  DAILY_FLOOR,
  DAILY_FULL_PAY_COUNT,
  FINISH_SHARE,
  NEGLECT_BONUS_MAX,
  NEGLECT_BONUS_PER_DAY,
  NEGLECT_BONUS_START_DAYS,
  POOL_PER_WEIGHT,
  RECOVERY_NEGLECT_FACTOR,
  SICK_TOKEN_MULTIPLIER,
  TASK_SHARE,
  TOKENS_PER_VALUE,
  UNBLOCK_BONUS_MAX,
  UNBLOCK_BONUS_PER_TASK,
} from "./tuning";
import { ZERO_BREAKDOWN, type Requirement, type StudiumData, type Task, type TokenBreakdown } from "./types";

export function requirementPool(weight: number): number {
  return weight * POOL_PER_WEIGHT;
}

/** The task's share of its requirement's 70%, by effort. 0 for unlinked tasks. */
export function taskBaseValue(task: Task, tasks: Task[], requirement: Requirement | undefined, multiplier: number): number {
  if (!task.requirementId || !requirement) return 0;
  const total = tasksOfRequirement(requirement.id, tasks).reduce((s, t) => s + taskEffort(t, multiplier), 0);
  if (total <= 0) return 0;
  return (requirementPool(requirement.weight) * TASK_SHARE * taskEffort(task, multiplier)) / total;
}

export function unblockBonus(taskId: string, tasks: Task[]): number {
  return Math.min(UNBLOCK_BONUS_MAX, downstreamOpenCount(taskId, tasks) * UNBLOCK_BONUS_PER_TASK);
}

export function neglectBonus(idleDays: number, recovering: boolean): number {
  const factor = recovering ? RECOVERY_NEGLECT_FACTOR : 1;
  const raw = Math.max(0, idleDays - NEGLECT_BONUS_START_DAYS) * NEGLECT_BONUS_PER_DAY;
  return Math.min(NEGLECT_BONUS_MAX * factor, raw * factor);
}

/** Multiplier for the k-th paid completion of the day (1-based). */
export function dailyCurve(k: number): number {
  if (k <= DAILY_FULL_PAY_COUNT) return 1;
  return Math.max(DAILY_FLOOR, DAILY_DECAY ** (k - DAILY_FULL_PAY_COUNT));
}

export type Payout = { tokens: number; breakdown: TokenBreakdown };

const NOTHING: Payout = { tokens: 0, breakdown: ZERO_BREAKDOWN };

/** Tokens for completing `taskId` now. Call before marking the task done in `data`. */
export function computeCompletionPayout(
  data: StudiumData,
  taskId: string,
  actualMin: number | null,
  now: Date,
): Payout {
  const task = data.tasks.find((t) => t.id === taskId);
  if (!task || hasBeenCompleted(data.events, taskId)) return NOTHING;
  const requirement = data.requirements.find((r) => r.id === task.requirementId);
  if (!requirement) return NOTHING;

  const multiplier = multiplierFor(estimateMultipliers(data), task.projectId);
  const after = data.tasks.map((t) => (t.id === taskId ? { ...t, done: true, actualMin } : t));
  const completedTask = after.find((t) => t.id === taskId) as Task;

  const base = taskBaseValue(completedTask, after, requirement, multiplier);
  const unblock = unblockBonus(taskId, data.tasks);
  const health = projectHealth(task.projectId, data, now);
  const neglect = neglectBonus(
    requirementIdleDays(requirement, data, now),
    health.recoveringFor.includes(requirement.id),
  );
  const reqTaskIds = tasksOfRequirement(requirement.id, after).map((t) => t.id);
  const finish =
    isRequirementDone(requirement.id, after) && !finishBonusPaid(data.events, reqTaskIds)
      ? requirementPool(requirement.weight) * FINISH_SHARE
      : 0;
  const curve = dailyCurve(paidCompletionsOnDay(data.events, localDateKey(now)) + 1);
  const sickMultiplier = health.sick ? SICK_TOKEN_MULTIPLIER : 1;

  const tokens = Math.round((base * (1 + unblock + neglect) + finish) * curve * sickMultiplier * TOKENS_PER_VALUE);
  return {
    tokens,
    breakdown: { base, unblockBonus: unblock, neglectBonus: neglect, finish, dailyCurve: curve, sickMultiplier },
  };
}

/** Rough tokens for finishing an open task now (no daily curve, finish bonus or sick penalty). For ranking. */
export function expectedTokens(
  task: Task,
  data: StudiumData,
  now: Date,
  multipliers: Multipliers = estimateMultipliers(data),
): number {
  if (task.done || !task.requirementId) return 0;
  const requirement = data.requirements.find((r) => r.id === task.requirementId);
  if (!requirement) return 0;
  const base = taskBaseValue(task, data.tasks, requirement, multiplierFor(multipliers, task.projectId));
  const health = projectHealth(task.projectId, data, now);
  const neglect = neglectBonus(
    requirementIdleDays(requirement, data, now),
    health.recoveringFor.includes(requirement.id),
  );
  return Math.round(base * (1 + unblockBonus(task.id, data.tasks) + neglect) * TOKENS_PER_VALUE);
}

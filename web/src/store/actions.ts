// User actions as pure functions: (data, input, now) → new data (+ result).
// Every change that matters for history appends an event.
import { isBlocked, wouldCreateCycle } from "../planner/blocking";
import { inventory, tokenBalance } from "../planner/history";
import { projectHealth } from "../planner/mood";
import { isDateKey, localDateKey } from "../planner/time";
import { DEFAULT_ESTIMATE_MIN, MEDICINE_PRODUCT_ID } from "../planner/tuning";
import type { FocusSession, Project, Requirement, StudiumData, StudiumEvent, Task } from "../planner/types";
import { computeCompletionPayout, type Payout } from "../planner/value";
import { findProduct } from "./products";

const newId = () => crypto.randomUUID();
const stamp = (now: Date) => now.toISOString();
const withEvent = (data: StudiumData, event: StudiumEvent): StudiumEvent[] => [...data.events, event];

export function cleanMinutes(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? Math.round(value) : fallback;
}

export function clampWeight(value: number): number {
  return Number.isFinite(value) ? Math.min(10, Math.max(1, Math.round(value))) : 1;
}

/** "" or a malformed date (e.g. a cleared date input) becomes null. */
export function cleanDate(value: string | null | undefined): string | null {
  return isDateKey(value) ? value : null;
}

/** Drops keys whose value is undefined, so they can't erase saved fields. */
function definedOnly<T extends object>(changes: T): Partial<T> {
  return Object.fromEntries(Object.entries(changes).filter(([, v]) => v !== undefined)) as Partial<T>;
}

function currentToday(data: StudiumData, now: Date): StudiumData["today"] {
  const key = localDateKey(now);
  return data.today.date === key ? data.today : { date: key, taskIds: [] };
}

/** Removes tasks and every reference to them (blockers, today). */
function withoutTasks(data: StudiumData, removed: Set<string>): Pick<StudiumData, "tasks" | "today"> {
  return {
    tasks: data.tasks
      .filter((t) => !removed.has(t.id))
      .map((t) => (t.blockedBy.some((id) => removed.has(id)) ? { ...t, blockedBy: t.blockedBy.filter((id) => !removed.has(id)) } : t)),
    today: { ...data.today, taskIds: data.today.taskIds.filter((id) => !removed.has(id)) },
  };
}

/** Keeps wanted blockers that exist, are in the same project and don't create a loop. */
function cleanBlockers(taskId: string, projectId: string, wanted: string[], tasks: Task[]): string[] {
  let working = tasks.map((t) => (t.id === taskId ? { ...t, blockedBy: [] as string[] } : t));
  const result: string[] = [];
  for (const id of new Set(wanted)) {
    const blocker = working.find((t) => t.id === id);
    if (!blocker || blocker.projectId !== projectId || wouldCreateCycle(taskId, id, working)) continue;
    result.push(id);
    working = working.map((t) => (t.id === taskId ? { ...t, blockedBy: [...result] } : t));
  }
  return result;
}

function cleanRequirementId(data: StudiumData, projectId: string, requirementId: string | null): string | null {
  return data.requirements.some((r) => r.id === requirementId && r.projectId === projectId) ? requirementId : null;
}

// ---- Projects ----

export type ProjectInput = Pick<Project, "name" | "shortName" | "color" | "deadline" | "description" | "petKind">;

export function createProject(data: StudiumData, input: ProjectInput, now: Date): { data: StudiumData; project: Project } {
  if (!isDateKey(input.deadline)) throw new Error(`Invalid deadline ${input.deadline}`);
  const createdAt = stamp(now);
  const project: Project = { ...input, name: input.name.trim(), id: newId(), createdAt, hatchedAt: createdAt };
  return { data: { ...data, projects: [...data.projects, project] }, project };
}

export function updateProject(
  data: StudiumData,
  id: string,
  changes: Partial<Pick<Project, "name" | "shortName" | "color" | "deadline" | "description">>,
): StudiumData {
  const clean = definedOnly(changes);
  if (clean.deadline !== undefined && !isDateKey(clean.deadline)) delete clean.deadline;
  if (clean.name !== undefined) clean.name = clean.name.trim();
  return { ...data, projects: data.projects.map((p) => (p.id === id ? { ...p, ...clean } : p)) };
}

export function deleteProject(data: StudiumData, id: string): StudiumData {
  const removed = new Set(data.tasks.filter((t) => t.projectId === id).map((t) => t.id));
  return {
    ...data,
    ...withoutTasks(data, removed),
    projects: data.projects.filter((p) => p.id !== id),
    requirements: data.requirements.filter((r) => r.projectId !== id),
  };
}

// ---- Requirements ----

export type RequirementInput = {
  projectId: string;
  title: string;
  weight: number;
  startDate?: string | null;
  dueDate?: string | null;
};

export function createRequirement(
  data: StudiumData,
  input: RequirementInput,
  now: Date,
): { data: StudiumData; requirement: Requirement } {
  if (!data.projects.some((p) => p.id === input.projectId)) throw new Error(`Unknown project ${input.projectId}`);
  const requirement: Requirement = {
    id: newId(),
    projectId: input.projectId,
    title: input.title.trim(),
    weight: clampWeight(input.weight),
    startDate: cleanDate(input.startDate),
    dueDate: cleanDate(input.dueDate),
    createdAt: stamp(now),
  };
  return {
    data: {
      ...data,
      requirements: [...data.requirements, requirement],
      events: withEvent(data, { type: "requirement_created", at: stamp(now), requirementId: requirement.id }),
    },
    requirement,
  };
}

export function updateRequirement(
  data: StudiumData,
  id: string,
  changes: Partial<Pick<Requirement, "title" | "weight" | "startDate" | "dueDate">>,
  now: Date,
): StudiumData {
  if (!data.requirements.some((r) => r.id === id)) return data;
  const clean: Partial<Requirement> = definedOnly(changes);
  if (clean.title !== undefined) clean.title = clean.title.trim();
  if (clean.weight !== undefined) clean.weight = clampWeight(clean.weight);
  if ("startDate" in clean) clean.startDate = cleanDate(clean.startDate);
  if ("dueDate" in clean) clean.dueDate = cleanDate(clean.dueDate);
  return {
    ...data,
    requirements: data.requirements.map((r) => (r.id === id ? { ...r, ...clean } : r)),
    events: withEvent(data, { type: "requirement_edited", at: stamp(now), requirementId: id, changes: clean }),
  };
}

export function deleteRequirement(data: StudiumData, id: string, mode: "deleteTasks" | "unlinkTasks"): StudiumData {
  const requirements = data.requirements.filter((r) => r.id !== id);
  if (mode === "deleteTasks") {
    const removed = new Set(data.tasks.filter((t) => t.requirementId === id).map((t) => t.id));
    return { ...data, ...withoutTasks(data, removed), requirements };
  }
  return {
    ...data,
    requirements,
    tasks: data.tasks.map((t) => (t.requirementId === id ? { ...t, requirementId: null } : t)),
  };
}

// ---- Tasks ----

export type TaskInput = {
  projectId: string;
  requirementId: string | null;
  title: string;
  estimateMin: number;
  blockedBy?: string[];
};

export function createTask(data: StudiumData, input: TaskInput, now: Date): { data: StudiumData; task: Task } {
  if (!data.projects.some((p) => p.id === input.projectId)) throw new Error(`Unknown project ${input.projectId}`);
  const id = newId();
  const task: Task = {
    id,
    projectId: input.projectId,
    requirementId: cleanRequirementId(data, input.projectId, input.requirementId),
    title: input.title.trim(),
    estimateMin: cleanMinutes(input.estimateMin, DEFAULT_ESTIMATE_MIN),
    blockedBy: cleanBlockers(id, input.projectId, input.blockedBy ?? [], data.tasks),
    priority: false,
    done: false,
    actualMin: null,
    createdAt: stamp(now),
  };
  return {
    data: { ...data, tasks: [...data.tasks, task], events: withEvent(data, { type: "task_created", at: stamp(now), taskId: id }) },
    task,
  };
}

export function updateTask(
  data: StudiumData,
  id: string,
  changes: Partial<Pick<Task, "title" | "requirementId" | "estimateMin" | "blockedBy">>,
  now: Date,
): StudiumData {
  const task = data.tasks.find((t) => t.id === id);
  if (!task) return data;
  const clean: Partial<Task> = {};
  if (changes.title !== undefined) clean.title = changes.title.trim();
  if (changes.estimateMin !== undefined) clean.estimateMin = cleanMinutes(changes.estimateMin, task.estimateMin);
  if (changes.requirementId !== undefined) clean.requirementId = cleanRequirementId(data, task.projectId, changes.requirementId);
  if (changes.blockedBy !== undefined) clean.blockedBy = cleanBlockers(id, task.projectId, changes.blockedBy, data.tasks);
  return {
    ...data,
    tasks: data.tasks.map((t) => (t.id === id ? { ...t, ...clean } : t)),
    events: withEvent(data, { type: "task_edited", at: stamp(now), taskId: id, changes: clean }),
  };
}

export function deleteTask(data: StudiumData, id: string): StudiumData {
  return { ...data, ...withoutTasks(data, new Set([id])) };
}

export function togglePriority(data: StudiumData, id: string): StudiumData {
  return { ...data, tasks: data.tasks.map((t) => (t.id === id ? { ...t, priority: !t.priority } : t)) };
}

export function completeTask(
  data: StudiumData,
  id: string,
  actualMin: number | null,
  now: Date,
): { data: StudiumData; payout: Payout | null } {
  const task = data.tasks.find((t) => t.id === id);
  if (!task || task.done || isBlocked(task, data.tasks)) return { data, payout: null };
  const actual = actualMin === null ? null : cleanMinutes(actualMin, task.estimateMin);
  const payout = computeCompletionPayout(data, id, actual, now);
  return {
    data: {
      ...data,
      tasks: data.tasks.map((t) => (t.id === id ? { ...t, done: true, actualMin: actual } : t)),
      events: withEvent(data, {
        type: "task_completed",
        at: stamp(now),
        taskId: id,
        requirementId: task.requirementId,
        actualMin: actual,
        tokens: payout.tokens,
        breakdown: payout.breakdown,
      }),
    },
    payout,
  };
}

export function reopenTask(data: StudiumData, id: string, now: Date): StudiumData {
  const task = data.tasks.find((t) => t.id === id);
  if (!task?.done) return data;
  return {
    ...data,
    tasks: data.tasks.map((t) => (t.id === id ? { ...t, done: false, actualMin: null } : t)),
    events: withEvent(data, { type: "task_reopened", at: stamp(now), taskId: id }),
  };
}

// ---- Today's plan ----

export function addToToday(data: StudiumData, taskId: string, now: Date): StudiumData {
  const task = data.tasks.find((t) => t.id === taskId);
  const today = currentToday(data, now);
  if (!task || task.done || today.taskIds.includes(taskId)) return { ...data, today };
  return { ...data, today: { ...today, taskIds: [...today.taskIds, taskId] } };
}

export function removeFromToday(data: StudiumData, taskId: string, now: Date): StudiumData {
  const today = currentToday(data, now);
  return { ...data, today: { ...today, taskIds: today.taskIds.filter((id) => id !== taskId) } };
}

// ---- Shop ----

export function purchase(data: StudiumData, productId: string, now: Date): { data: StudiumData; ok: boolean } {
  const product = findProduct(productId);
  if (!product || tokenBalance(data.events) < product.price) return { data, ok: false };
  return {
    data: { ...data, events: withEvent(data, { type: "purchase", at: stamp(now), productId, price: product.price }) },
    ok: true,
  };
}

export function giveMedicine(data: StudiumData, projectId: string, now: Date): { data: StudiumData; ok: boolean } {
  const haveMedicine = (inventory(data.events)[MEDICINE_PRODUCT_ID] ?? 0) > 0;
  if (!haveMedicine || !projectHealth(projectId, data, now).sick) return { data, ok: false };
  return { data: { ...data, events: withEvent(data, { type: "medicine_given", at: stamp(now), projectId }) }, ok: true };
}

// ---- Focus sessions (naps with a browser pet) ----

export const MAX_FOCUS_SESSION_MIN = 240;

/**
 * Records finished naps sent by the extension. Returns every id it has dealt with (recorded, already
 * recorded, or dropped because the project is gone) so the extension can delete its copies.
 * Focus sessions never pay tokens or change progress.
 */
export function recordFocusSessions(
  data: StudiumData,
  sessions: FocusSession[],
  now: Date,
): { data: StudiumData; handled: string[] } {
  const known = new Set(data.events.filter((e) => e.type === "focus_session").map((e) => e.id));
  const projects = new Set(data.projects.map((p) => p.id));
  const tasks = new Set(data.tasks.map((t) => t.id));
  const added: StudiumEvent[] = [];
  const handled: string[] = [];
  for (const s of sessions) {
    handled.push(s.id);
    if (known.has(s.id) || !projects.has(s.projectId)) continue;
    known.add(s.id);
    added.push({
      type: "focus_session",
      at: Number.isFinite(Date.parse(s.at)) ? s.at : stamp(now),
      id: s.id,
      projectId: s.projectId,
      taskId: s.taskId !== null && tasks.has(s.taskId) ? s.taskId : null,
      startedAt: s.startedAt,
      minutes: Math.min(MAX_FOCUS_SESSION_MIN, Math.max(0, Math.round(s.minutes))),
    });
  }
  return { data: added.length > 0 ? { ...data, events: [...data.events, ...added] } : data, handled };
}

// User actions as pure functions: (data, input, now) → new data (+ result).
// Every change that matters for history appends an event.
import { canBlockByAll, isBlocked, requirementBlockerOptions, wouldRequirementChangeLoop, wouldTaskBlockerLoop } from "../planner/blocking";
import { inventory, tokenBalance } from "../planner/history";
import { hatchIfReady } from "../planner/lifecycle";
import { habitatIds, petsOf } from "../planner/pets";
import { projectHealth } from "../planner/mood";
import { DAY_MS, addDays, isDateKey, localDateKey, startOfLocalDay } from "../planner/time";
import { DEFAULT_ESTIMATE_MIN, MEDICINE_PRODUCT_ID } from "../planner/tuning";
import type {
  DecorSlot,
  FocusSession,
  HabitatDecor,
  Project,
  Requirement,
  StudiumData,
  StudiumEvent,
  Task,
} from "../planner/types";
import { DIFFICULTY_LEVELS, PROJECT_TYPES } from "../planner/types";
import { computeCompletionPayout, type Payout } from "../planner/value";
import { allowedIn, freeCopies, withDefaultBed } from "./decor";
import { priceOf } from "./products";

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
function cleanBlockers(taskId: string, projectId: string, wanted: string[], tasks: Task[], requirements: Requirement[]): string[] {
  let working = tasks.map((t) => (t.id === taskId ? { ...t, blockedBy: [] as string[] } : t));
  const result: string[] = [];
  for (const id of new Set(wanted)) {
    const blocker = working.find((t) => t.id === id);
    if (!blocker || blocker.projectId !== projectId || wouldTaskBlockerLoop(taskId, id, { tasks: working, requirements })) continue;
    result.push(id);
    working = working.map((t) => (t.id === taskId ? { ...t, blockedBy: [...result] } : t));
  }
  return result;
}

/**
 * A requirement's blockers as they may be saved: "all others" only if allowed (and then no list);
 * otherwise the wanted ids, in order, that are valid choices once the earlier ones are applied.
 */
function cleanRequirementBlockers(reqId: string, data: StudiumData, wanted: string[], all: boolean): Pick<Requirement, "blockedBy" | "blockedByAll"> {
  const without = (blockedBy: string[]): StudiumData["requirements"] =>
    data.requirements.map((r) => {
      if (r.id !== reqId) return r;
      const { blockedByAll: _drop, ...rest } = r;
      return { ...rest, blockedBy };
    });
  let requirements = without([]);
  if (all && canBlockByAll(reqId, { tasks: data.tasks, requirements })) return { blockedBy: [], blockedByAll: true };
  const result: string[] = [];
  for (const id of new Set(wanted)) {
    if (!requirementBlockerOptions(reqId, { tasks: data.tasks, requirements }).some((r) => r.id === id)) continue;
    result.push(id);
    requirements = without([...result]);
  }
  return { blockedBy: result };
}

/** Sets a requirement's blockers, dropping blockedByAll when it isn't wanted. */
function withRequirementBlockers(req: Requirement, blockers: Pick<Requirement, "blockedBy" | "blockedByAll">): Requirement {
  const { blockedByAll: _drop, ...rest } = req;
  return { ...rest, ...blockers };
}

function cleanRequirementId(data: StudiumData, projectId: string, requirementId: string | null): string | null {
  return data.requirements.some((r) => r.id === requirementId && r.projectId === projectId) ? requirementId : null;
}

// ---- Projects ----

export type ProjectInput = Pick<Project, "name" | "shortName" | "color" | "deadline" | "description" | "petKind"> &
  Partial<Pick<Project, "type" | "difficulty">>;

export function createProject(data: StudiumData, input: ProjectInput, now: Date): { data: StudiumData; project: Project } {
  if (!isDateKey(input.deadline)) throw new Error(`Invalid deadline ${input.deadline}`);
  const createdAt = stamp(now);
  // The pet starts as an egg and hatches once the project has a few requirements (planner/lifecycle.ts).
  const project: Project = { ...input, name: input.name.trim(), id: newId(), createdAt, stage: "egg", hatchedAt: null };
  // Every habitat comes with its built-in bed.
  const decor = { ...(data.decor ?? {}), [project.id]: withDefaultBed({}) };
  return { data: { ...data, projects: [...data.projects, project], decor }, project };
}

export function updateProject(
  data: StudiumData,
  id: string,
  changes: Partial<Pick<Project, "name" | "shortName" | "color" | "deadline" | "description" | "type" | "difficulty">>,
): StudiumData {
  const clean = definedOnly(changes);
  if (clean.deadline !== undefined && !isDateKey(clean.deadline)) delete clean.deadline;
  if (clean.type !== undefined && !PROJECT_TYPES.includes(clean.type)) delete clean.type;
  if (clean.difficulty !== undefined && !DIFFICULTY_LEVELS.includes(clean.difficulty)) delete clean.difficulty;
  if (clean.name !== undefined) clean.name = clean.name.trim();
  return { ...data, projects: data.projects.map((p) => (p.id === id ? { ...p, ...clean } : p)) };
}

export function deleteProject(data: StudiumData, id: string): StudiumData {
  const project = data.projects.find((p) => p.id === id);
  const habitats = project ? petsOf(project).map((p) => p.habitatId) : [id];
  const removed = new Set(data.tasks.filter((t) => t.projectId === id).map((t) => t.id));
  return {
    ...data,
    ...withoutTasks(data, removed),
    projects: data.projects.filter((p) => p.id !== id),
    requirements: data.requirements.filter((r) => r.projectId !== id),
    // Its habitats' decor goes back to the inventory.
    ...(data.decor ? { decor: habitats.reduce((d, h) => withoutKey(d, h), data.decor) } : {}),
  };
}

function withoutKey<T>(record: Record<string, T>, key: string): Record<string, T> {
  return Object.fromEntries(Object.entries(record).filter(([k]) => k !== key));
}

// ---- Requirements ----

export type RequirementInput = {
  projectId: string;
  title: string;
  weight: number;
  startDate?: string | null;
  dueDate?: string | null;
  blockedBy?: string[];
  blockedByAll?: boolean;
};

export function createRequirement(
  data: StudiumData,
  input: RequirementInput,
  now: Date,
): { data: StudiumData; requirement: Requirement; hatched: boolean } {
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
  if ((input.blockedBy?.length ?? 0) > 0 || input.blockedByAll) {
    const withNew = { ...data, requirements: [...data.requirements, requirement] };
    Object.assign(requirement, cleanRequirementBlockers(requirement.id, withNew, input.blockedBy ?? [], input.blockedByAll === true));
  }
  const next: StudiumData = {
    ...data,
    requirements: [...data.requirements, requirement],
    events: withEvent(data, { type: "requirement_created", at: stamp(now), requirementId: requirement.id }),
  };
  const { data: hatchedData, hatched } = hatchIfReady(next, input.projectId, now);
  return { data: hatchedData, requirement, hatched };
}

export function updateRequirement(
  data: StudiumData,
  id: string,
  changes: Partial<Pick<Requirement, "title" | "weight" | "startDate" | "dueDate" | "blockedBy">> & { blockedByAll?: boolean },
  now: Date,
): StudiumData {
  const current = data.requirements.find((r) => r.id === id);
  if (!current) return data;
  const { blockedBy, blockedByAll, ...fields } = changes;
  const clean: Partial<Requirement> = definedOnly(fields);
  if (clean.title !== undefined) clean.title = clean.title.trim();
  if (clean.weight !== undefined) clean.weight = clampWeight(clean.weight);
  if ("startDate" in clean) clean.startDate = cleanDate(clean.startDate);
  if ("dueDate" in clean) clean.dueDate = cleanDate(clean.dueDate);
  let updated: Requirement = { ...current, ...clean };
  if (blockedBy !== undefined || blockedByAll !== undefined) {
    const blockers = cleanRequirementBlockers(id, data, blockedBy ?? current.blockedBy ?? [], blockedByAll ?? current.blockedByAll === true);
    updated = withRequirementBlockers(updated, blockers);
    Object.assign(clean, blockers);
  }
  return {
    ...data,
    requirements: data.requirements.map((r) => (r.id === id ? updated : r)),
    events: withEvent(data, { type: "requirement_edited", at: stamp(now), requirementId: id, changes: clean }),
  };
}

export function deleteRequirement(data: StudiumData, id: string, mode: "deleteTasks" | "unlinkTasks"): StudiumData {
  const requirements = data.requirements
    .filter((r) => r.id !== id)
    .map((r) => (r.blockedBy?.includes(id) ? { ...r, blockedBy: r.blockedBy.filter((b) => b !== id) } : r));
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

/**
 * The name for the next requirement in a series: the trailing number plus one, keeping zero padding
 * ("Prototype 9" → "Prototype 10", "Week 09" → "Week 10"); otherwise "<title> (copy)". Skips names in
 * `taken` (compared without case).
 */
export function nextRequirementTitle(title: string, taken: string[] = []): string {
  const used = new Set(taken.map((t) => t.trim().toLowerCase()));
  const free = (t: string) => !used.has(t.toLowerCase());
  const m = /^(.*?)(\d+)$/.exec(title.trim());
  if (m) {
    const [, prefix, digits] = m;
    for (let n = Number(digits) + 1; ; n++) {
      const name = `${prefix}${String(n).padStart(digits.length, "0")}`;
      if (free(name)) return name;
    }
  }
  if (free(`${title} (copy)`)) return `${title} (copy)`;
  for (let n = 2; ; n++) if (free(`${title} (copy ${n})`)) return `${title} (copy ${n})`;
}

/**
 * Copies a requirement as the next in its series: right after the original, waiting on it, dates
 * moved forward by its length (7 days when a date is unset), with every task copied fresh (not done,
 * no time). Blockers between its own tasks point at the copies; others stay as they were.
 */
export function duplicateRequirement(
  data: StudiumData,
  id: string,
  now: Date,
): { data: StudiumData; requirement: Requirement | null; hatched: boolean } {
  const original = data.requirements.find((r) => r.id === id);
  if (!original) return { data, requirement: null, hatched: false };
  const { startDate, dueDate } = original;
  const span = startDate && dueDate ? Math.round((startOfLocalDay(dueDate).getTime() - startOfLocalDay(startDate).getTime()) / DAY_MS) + 1 : 7;
  const shift = (key: string | null) => (key ? localDateKey(addDays(startOfLocalDay(key), span)) : null);
  const { blockedByAll: _drop, ...rest } = original;
  const requirement: Requirement = {
    ...rest,
    id: newId(),
    title: nextRequirementTitle(original.title, data.requirements.filter((r) => r.projectId === original.projectId).map((r) => r.title)),
    startDate: shift(startDate),
    dueDate: shift(dueDate),
    blockedBy: [id],
    createdAt: stamp(now),
  };
  const sources = data.tasks.filter((t) => t.requirementId === id);
  const newIds = new Map(sources.map((t) => [t.id, newId()]));
  const tasks: Task[] = sources.map((t) => ({
    ...t,
    id: newIds.get(t.id) as string,
    requirementId: requirement.id,
    blockedBy: t.blockedBy.map((b) => newIds.get(b) ?? b),
    done: false,
    actualMin: null,
    createdAt: stamp(now),
  }));
  const at = stamp(now);
  const index = data.requirements.indexOf(original);
  const next: StudiumData = {
    ...data,
    requirements: [...data.requirements.slice(0, index + 1), requirement, ...data.requirements.slice(index + 1)],
    tasks: [...data.tasks, ...tasks],
    events: [
      ...data.events,
      { type: "requirement_created", at, requirementId: requirement.id },
      ...tasks.map((t): StudiumEvent => ({ type: "task_created", at, taskId: t.id })),
    ],
  };
  const { data: hatchedData, hatched } = hatchIfReady(next, original.projectId, now);
  return { data: hatchedData, requirement, hatched };
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
    blockedBy: [],
    priority: false,
    done: false,
    actualMin: null,
    createdAt: stamp(now),
  };
  // Check the waits with the new task in place: it makes its requirement wait on it too.
  task.blockedBy = cleanBlockers(id, input.projectId, input.blockedBy ?? [], [...data.tasks, task], data.requirements);
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
  if (changes.requirementId !== undefined) {
    // A move that loops through another task's wait is refused; this task's own looping waits are dropped below.
    const wanted = cleanRequirementId(data, task.projectId, changes.requirementId);
    const unblocked = data.tasks.map((t) => (t.id === id ? { ...t, blockedBy: [] } : t));
    if (!wouldRequirementChangeLoop(id, wanted, { tasks: unblocked, requirements: data.requirements })) clean.requirementId = wanted;
  }
  if (changes.blockedBy !== undefined || "requirementId" in clean) {
    const moved = data.tasks.map((t) => (t.id === id ? { ...t, ...clean } : t));
    clean.blockedBy = cleanBlockers(id, task.projectId, changes.blockedBy ?? task.blockedBy, moved, data.requirements);
  }
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
  if (!task || task.done || isBlocked(task, data)) return { data, payout: null };
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
  const price = priceOf(productId);
  if (price === undefined || tokenBalance(data) < price) return { data, ok: false };
  return {
    data: { ...data, events: withEvent(data, { type: "purchase", at: stamp(now), productId, price }) },
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

// ---- Habitat decor ----
// No events: placing decor changes no history, tokens or mood. Refusals return the same object.

function withHabitat(data: StudiumData, projectId: string, habitat: HabitatDecor): StudiumData {
  const rest = withoutKey(data.decor ?? {}, projectId);
  return { ...data, decor: Object.keys(habitat).length > 0 ? { ...rest, [projectId]: habitat } : rest };
}

/** Puts a free copy of an item in a slot. Whatever was there goes back to the inventory. */
export function placeDecor(data: StudiumData, projectId: string, slot: DecorSlot, itemId: string): StudiumData {
  if (!habitatIds(data).includes(projectId)) return data;
  const habitat = data.decor?.[projectId] ?? {};
  if (habitat[slot] === itemId || !allowedIn(habitat, slot, itemId)) return data;
  const cleared = removeDecor(data, projectId, slot);
  if (freeCopies(cleared, itemId) < 1) return data;
  return withHabitat(cleared, projectId, { ...(cleared.decor?.[projectId] ?? {}), [slot]: itemId });
}

export function removeDecor(data: StudiumData, projectId: string, slot: DecorSlot): StudiumData {
  const habitat = data.decor?.[projectId];
  if (!habitat?.[slot]) return data;
  return withHabitat(data, projectId, Object.fromEntries(Object.entries(habitat).filter(([s]) => s !== slot)));
}

/**
 * Moves the copy in one slot to another slot (any habitat). Nothing changes if it can't go there,
 * or if `expected` is given and the source no longer holds that item (another tab changed it).
 */
export function moveDecor(
  data: StudiumData,
  from: { projectId: string; slot: DecorSlot },
  to: { projectId: string; slot: DecorSlot },
  expected?: string,
): StudiumData {
  const itemId = data.decor?.[from.projectId]?.[from.slot];
  if (!itemId || (expected !== undefined && itemId !== expected)) return data;
  const removed = removeDecor(data, from.projectId, from.slot);
  const placed = placeDecor(removed, to.projectId, to.slot, itemId);
  return placed === removed ? data : placed;
}

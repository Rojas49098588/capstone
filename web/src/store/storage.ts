// Loading and saving Studium's data in localStorage, with validation and backups.
import { isDateKey } from "../planner/time";
import { PET_KINDS, type StudiumData } from "../planner/types";
import { buildSeed } from "./seed";

export const STORAGE_KEY = "studium-data-v1";
export const BACKUP_PREFIX = "studium-data-backup-";

export type LoadNotice = "damaged-data" | "storage-unavailable" | null;
export type LoadResult = { data: StudiumData; persistent: boolean; notice: LoadNotice };

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === "string";
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isBool = (v: unknown): v is boolean => typeof v === "boolean";
const allStr = (o: Obj, keys: string[]) => keys.every((k) => isStr(o[k]));

export function isValidData(value: unknown): value is StudiumData {
  if (!isObj(value) || value.version !== 1) return false;
  const { projects, requirements, tasks, events, today } = value;
  if (![projects, requirements, tasks, events].every(Array.isArray)) return false;
  if (!isObj(today) || !isStr(today.date) || !Array.isArray(today.taskIds) || !today.taskIds.every(isStr)) return false;

  const projectIds = new Set<string>();
  for (const p of projects as unknown[]) {
    if (!isObj(p) || !allStr(p, ["id", "name", "shortName", "color", "deadline", "description", "hatchedAt", "createdAt"])) return false;
    if (!PET_KINDS.includes(p.petKind as never) || !isDateKey(p.deadline)) return false;
    projectIds.add(p.id as string);
  }

  const requirementIds = new Set<string>();
  for (const r of requirements as unknown[]) {
    if (!isObj(r) || !allStr(r, ["id", "projectId", "title", "createdAt"]) || !isNum(r.weight)) return false;
    if (!(r.startDate === null || isDateKey(r.startDate)) || !(r.dueDate === null || isDateKey(r.dueDate))) return false;
    if (!projectIds.has(r.projectId as string)) return false;
    requirementIds.add(r.id as string);
  }

  for (const t of tasks as unknown[]) {
    if (!isObj(t) || !allStr(t, ["id", "projectId", "title", "createdAt"]) || !projectIds.has(t.projectId as string)) return false;
    if (!(t.requirementId === null || (isStr(t.requirementId) && requirementIds.has(t.requirementId)))) return false;
    if (!isNum(t.estimateMin) || !Array.isArray(t.blockedBy) || !t.blockedBy.every(isStr)) return false;
    if (!isBool(t.priority) || !isBool(t.done) || !(t.actualMin === null || isNum(t.actualMin))) return false;
  }

  for (const e of events as unknown[]) {
    if (!isObj(e) || !isStr(e.type) || !isStr(e.at)) return false;
    if (e.type === "task_completed" && !(isStr(e.taskId) && isNum(e.tokens) && isObj(e.breakdown) && isNum(e.breakdown.finish))) return false;
    if (e.type === "purchase" && !(isStr(e.productId) && isNum(e.price))) return false;
    if (e.type === "medicine_given" && !isStr(e.projectId)) return false;
  }
  return true;
}

/** localStorage if it can actually be used (private modes and blocked storage return null). */
export function browserStorage(): Storage | null {
  try {
    const s = window.localStorage;
    const probe = "__studium_probe__";
    s.setItem(probe, probe);
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

export function saveData(storage: Storage | null, data: StudiumData): boolean {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadData(storage: Storage | null, now: Date): LoadResult {
  const unavailable: LoadResult = { data: buildSeed(now), persistent: false, notice: "storage-unavailable" };
  if (!storage) return unavailable;

  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return unavailable;
  }

  if (raw === null) {
    const data = buildSeed(now);
    saveData(storage, data);
    return { data, persistent: true, notice: null };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = undefined;
  }
  if (isValidData(parsed)) return { data: parsed, persistent: true, notice: null };

  // Damaged: keep the original text so nothing is lost, then start from the example data.
  try {
    storage.setItem(`${BACKUP_PREFIX}${now.toISOString()}`, raw);
  } catch {
    // Backup failed (storage full); still recover.
  }
  const data = buildSeed(now);
  saveData(storage, data);
  return { data, persistent: true, notice: "damaged-data" };
}

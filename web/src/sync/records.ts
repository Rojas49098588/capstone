// Splitting Studium's data bundle into the records that sync, and putting it back together.
import { LEGACY_STARTING_TOKENS } from "../planner/tuning";
import type { HabitatDecor, Project, Requirement, StudiumData, StudiumEvent, Task } from "../planner/types";
import type { PetInvolvement, PetOrder } from "../store/settings";

export type RecordKey = string; // "project:<id>" | "requirement:<id>" | "task:<id>" | "event:<id>" | "user"
export type SyncedSettings = { nickname: string; petInvolvement: PetInvolvement; petOrder: PetOrder };
export type UserRecord = { startingTokens: number; defaultBeds: boolean; today: StudiumData["today"]; settings: SyncedSettings };
export type Records = {
  user: UserRecord;
  projects: Record<string, { project: Project; decor: Record<string, HabitatDecor> }>;
  requirements: Record<string, Requirement>;
  tasks: Record<string, Task>;
  events: Record<string, StudiumEvent>; // by eventId
};

/** JSON with object keys sorted at every level, so equal values always give the same text. */
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (typeof v === "object" && v !== null) {
    const o = v as Record<string, unknown>;
    const parts = Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`);
    return `{${parts.join(",")}}`;
  }
  return JSON.stringify(v) ?? "null";
}

const FNV_OFFSET = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const MASK_64 = 0xffffffffffffffffn;

/** FNV-1a, 64 bits, as 16 hex digits. */
function fnv1a64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let h = FNV_OFFSET;
  for (const b of bytes) h = ((h ^ BigInt(b)) * FNV_PRIME) & MASK_64;
  return h.toString(16).padStart(16, "0");
}

export function eventId(e: StudiumEvent): string {
  if (e.type === "focus_session") return `focus:${e.id}`;
  return fnv1a64(canonical(e));
}

export function habitatProject(data: Pick<StudiumData, "projects">, habitatId: string): string | null {
  for (const p of data.projects) {
    if (p.id === habitatId || (p.pets ?? []).some((x) => x.id === habitatId)) return p.id;
  }
  return null;
}

export function eventProject(e: StudiumEvent, data: Pick<StudiumData, "tasks" | "requirements">): string | null {
  switch (e.type) {
    case "task_created":
    case "task_completed":
    case "task_reopened":
    case "task_edited":
      return data.tasks.find((t) => t.id === e.taskId)?.projectId ?? null;
    case "requirement_created":
    case "requirement_edited":
      return data.requirements.find((r) => r.id === e.requirementId)?.projectId ?? null;
    case "medicine_given":
    case "fed":
    case "focus_session":
      return e.projectId;
    case "purchase":
      return null;
  }
}

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Oldest first, then by id: these only ever grow, so creation order is the app's order. */
function inCreationOrder<T extends { id: string; createdAt: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || cmp(a.id, b.id));
}

function byId<T extends { id: string }>(items: T[]): Record<string, T> {
  const out: Record<string, T> = {};
  for (const i of items) out[i.id] = i;
  return out;
}

export function toRecords(data: StudiumData, settings: SyncedSettings): Records {
  const projects: Records["projects"] = {};
  for (const project of data.projects) projects[project.id] = { project, decor: {} };
  // A habitat whose project can't be found has nowhere to live, so its decor is dropped.
  for (const [habitatId, decor] of Object.entries(data.decor ?? {})) {
    const owner = habitatProject(data, habitatId);
    if (owner !== null) projects[owner].decor[habitatId] = decor;
  }
  const events: Records["events"] = {};
  for (const e of data.events) events[eventId(e)] = e;
  return {
    user: {
      startingTokens: data.startingTokens ?? LEGACY_STARTING_TOKENS,
      defaultBeds: data.defaultBeds === true,
      today: data.today,
      settings,
    },
    projects,
    requirements: byId(data.requirements),
    tasks: byId(data.tasks),
    events,
  };
}

export function fromRecords(r: Records): { data: StudiumData; settings: SyncedSettings } {
  const entries = Object.values(r.projects);
  const decor: Record<string, HabitatDecor> = {};
  for (const p of entries) Object.assign(decor, p.decor);
  const events = Object.entries(r.events)
    .sort(([ia, a], [ib, b]) => Date.parse(a.at) - Date.parse(b.at) || (ia < ib ? -1 : ia > ib ? 1 : 0))
    .map(([, e]) => e);
  const data: StudiumData = {
    version: 1,
    projects: inCreationOrder(entries.map((p) => p.project)),
    requirements: inCreationOrder(Object.values(r.requirements)),
    tasks: inCreationOrder(Object.values(r.tasks)),
    events,
    today: r.user.today,
  };
  if (Object.keys(decor).length > 0) data.decor = decor;
  if (r.user.defaultBeds) data.defaultBeds = true;
  // Missing means the legacy balance, so the legacy balance is written back as missing.
  if (r.user.startingTokens !== LEGACY_STARTING_TOKENS) data.startingTokens = r.user.startingTokens;
  return { data, settings: r.user.settings };
}

export function recordHashes(r: Records): Record<RecordKey, string> {
  const out: Record<RecordKey, string> = { user: fnv1a64(canonical(r.user)) };
  for (const [id, p] of Object.entries(r.projects)) out[`project:${id}`] = fnv1a64(canonical(p));
  for (const [id, x] of Object.entries(r.requirements)) out[`requirement:${id}`] = fnv1a64(canonical(x));
  for (const [id, x] of Object.entries(r.tasks)) out[`task:${id}`] = fnv1a64(canonical(x));
  for (const [id, x] of Object.entries(r.events)) out[`event:${id}`] = fnv1a64(canonical(x));
  return out;
}

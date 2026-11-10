// Merging this device's records with the cloud's: last edit wins, a delete beats an edit.
import type { Requirement, StudiumEvent, Task } from "../planner/types";
import type { RecordKey, Records, UserRecord } from "./records";

export type Stamped<T> = { updatedAt: string; deleted: boolean; value: T | null };
export type StampedRecords = {
  user: Stamped<UserRecord>;
  projects: Record<string, Stamped<Records["projects"][string]>>;
  requirements: Record<string, Stamped<Requirement>>;
  tasks: Record<string, Stamped<Task>>;
  events: Record<string, StudiumEvent>; // events are never edited, only added
  /** The account's save generation: replaced whenever a whole save replaces the account's (replaceAll). Only the cloud's copy has one. */
  saveId?: string;
};

const time = (s: Stamped<unknown>) => Date.parse(s.updatedAt);

/** Which side wins, and whether the winner is local and so has to be sent up. */
function mergeStamped<T>(local: Stamped<T> | undefined, remote: Stamped<T> | undefined): { merged: Stamped<T>; push: boolean } | null {
  if (!local && !remote) return null;
  if (!remote) return { merged: local as Stamped<T>, push: true };
  if (!local) return { merged: remote, push: false };
  if (local.deleted || remote.deleted) {
    const later = time(local) > time(remote) ? local : remote;
    const merged: Stamped<T> = { updatedAt: later.updatedAt, deleted: true, value: null };
    // Remote already says the same thing unless it is live, or was deleted with an older stamp.
    const push = local.deleted && (!remote.deleted || time(remote) < time(local));
    return { merged, push };
  }
  // On a tie, remote wins.
  return time(local) > time(remote) ? { merged: local, push: true } : { merged: remote, push: false };
}

function mergeTable<T>(
  prefix: string,
  local: Record<string, Stamped<T>>,
  remote: Record<string, Stamped<T>>,
  push: RecordKey[],
): Record<string, Stamped<T>> {
  const out: Record<string, Stamped<T>> = {};
  for (const id of new Set([...Object.keys(local), ...Object.keys(remote)])) {
    const r = mergeStamped(local[id], remote[id]);
    if (!r) continue;
    out[id] = r.merged;
    if (r.push) push.push(`${prefix}:${id}`);
  }
  return out;
}

export function mergeRecords(local: StampedRecords, remote: StampedRecords): { merged: StampedRecords; pushToRemote: RecordKey[] } {
  const pushToRemote: RecordKey[] = [];
  const user = mergeStamped(local.user, remote.user);
  if (!user) throw new Error("both sides are missing the user record");
  if (user.push) pushToRemote.push("user");
  const projects = mergeTable("project", local.projects, remote.projects, pushToRemote);
  const requirements = mergeTable("requirement", local.requirements, remote.requirements, pushToRemote);
  const tasks = mergeTable("task", local.tasks, remote.tasks, pushToRemote);
  const events: StampedRecords["events"] = { ...remote.events, ...local.events };
  for (const id of Object.keys(local.events)) if (!(id in remote.events)) pushToRemote.push(`event:${id}`);
  return { merged: { user: user.merged, projects, requirements, tasks, events }, pushToRemote };
}

/**
 * Two devices can complete the same task offline; only the first completion pays.
 * A completion is dropped when the task is already completed and has not been reopened since.
 */
export function dedupeCompletions(events: StudiumEvent[]): StudiumEvent[] {
  const sorted = [...events].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const completed = new Set<string>();
  const out: StudiumEvent[] = [];
  for (const e of sorted) {
    if (e.type === "task_completed") {
      if (completed.has(e.taskId)) continue;
      completed.add(e.taskId);
    } else if (e.type === "task_reopened") {
      completed.delete(e.taskId);
    }
    out.push(e);
  }
  return out;
}

function live<T>(table: Record<string, Stamped<T>>): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [id, s] of Object.entries(table)) if (!s.deleted && s.value !== null) out[id] = s.value;
  return out;
}

/**
 * A task's done and actualMin follow its latest completion or reopen, as completeTask and reopenTask set them.
 * The task record alone can't be trusted for these: a later edit made on a stale copy carries the old values.
 */
export function withCompletionsApplied(tasks: Record<string, Task>, events: StudiumEvent[]): Record<string, Task> {
  const latest = new Map<string, StudiumEvent>();
  for (const e of [...events].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))) {
    if (e.type === "task_completed" || e.type === "task_reopened") latest.set(e.taskId, e);
  }
  const out: Record<string, Task> = {};
  for (const [id, t] of Object.entries(tasks)) {
    const e = latest.get(t.id);
    const [done, actualMin] = e?.type === "task_completed" ? [true, e.actualMin] : e?.type === "task_reopened" ? [false, null] : [t.done, t.actualMin];
    out[id] = done === t.done && actualMin === t.actualMin ? t : { ...t, done, actualMin };
  }
  return out;
}

/** What the app sees: deleted records gone and double completions removed. The raw records stay as they are for syncing. */
export function liveRecords(s: StampedRecords): Records {
  if (s.user.value === null) throw new Error("the user record has no value");
  const entries = Object.entries(s.events);
  const deduped = dedupeCompletions(entries.map(([, e]) => e));
  const kept = new Set(deduped);
  const events: Records["events"] = {};
  for (const [id, e] of entries) if (kept.has(e)) events[id] = e;
  const tasks = withCompletionsApplied(live(s.tasks), deduped);
  return { user: s.user.value, projects: live(s.projects), requirements: live(s.requirements), tasks, events };
}

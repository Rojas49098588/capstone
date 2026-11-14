// What to do when an account connects to this device's data.
import type { StudiumData } from "../planner/types";
import { buildSeed } from "../store/seed";
import type { SyncState } from "./syncState";

// The example data is built relative to when it was first opened, so each example project's createdAt says when
// that was; its newest event is a fixed time after that.
const EXAMPLE = buildSeed(new Date(0));
const NEWEST_EXAMPLE_EVENT = Math.max(...EXAMPLE.events.map((e) => Date.parse(e.at)));
const EXAMPLE_PROJECTS = new Map(EXAMPLE.projects.map((p) => [p.id, NEWEST_EXAMPLE_EVENT - Date.parse(p.createdAt)]));

/**
 * Whether this device has projects of its own to keep. The untouched example data doesn't count: only example
 * projects (some may be deleted) and no event newer than the example's newest, so the person never did anything.
 */
export function hasOwnProjects(data: Pick<StudiumData, "projects" | "events">): boolean {
  if (data.projects.length === 0) return false;
  let newestExample = Infinity;
  for (const p of data.projects) {
    const after = EXAMPLE_PROJECTS.get(p.id);
    if (after === undefined) return true;
    newestExample = Math.min(newestExample, Date.parse(p.createdAt) + after);
  }
  return data.events.some((e) => Date.parse(e.at) > newestExample);
}

export type LinkDecision = "upload" | "take" | "rejoin" | "picker" | "backup-and-take";

export function decideLink(input: { uid: string; state: SyncState; localHasProjects: boolean; remoteHasProjects: boolean }): LinkDecision {
  const { uid, state, localHasProjects, remoteHasProjects } = input;
  // Another account's data is never uploaded or offered; it is backed up and replaced.
  if (state.owner !== null && state.owner !== uid) return "backup-and-take";
  // This account's own data: nothing to keep apart from what it already has, unless edited while signed out.
  if (state.owner === uid && (!state.changedWhileSignedOut || !localHasProjects)) return "rejoin";
  if (localHasProjects && remoteHasProjects) return "picker";
  if (!localHasProjects && remoteHasProjects) return "take";
  return "upload";
}

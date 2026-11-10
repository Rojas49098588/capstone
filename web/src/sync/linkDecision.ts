// What to do when an account connects to this device's data.
import type { SyncState } from "./syncState";

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

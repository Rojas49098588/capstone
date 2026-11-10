// What this device remembers about syncing: who it syncs as, and what changed here since the last sync.
import { recordHashes, type RecordKey, type Records } from "./records";

export const SYNC_KEY = "studium-sync-v1";

export type SyncState = {
  uid: string | null; // signed in and syncing as
  owner: string | null; // the account this device's data came from (null = guest data)
  stamps: Record<RecordKey, string>; // updatedAt of each record as last synced or changed here
  hashes: Record<RecordKey, string>; // recordHashes at the last sync
  tombstones: Record<RecordKey, string>; // deleted here, at
  changedWhileSignedOut: boolean;
  saveId: string | null; // the account's save generation this device's data belongs to (null: none yet)
};

export const EMPTY_SYNC_STATE: SyncState = { uid: null, owner: null, stamps: {}, hashes: {}, tombstones: {}, changedWhileSignedOut: false, saveId: null };

/** A new empty state each time, so callers can't share and mutate one. */
const emptyState = (): SyncState => ({ uid: null, owner: null, stamps: {}, hashes: {}, tombstones: {}, changedWhileSignedOut: false, saveId: null });

const isStringOrNull = (v: unknown): v is string | null => v === null || typeof v === "string";

function stringMap(v: unknown): Record<string, string> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const out: Record<string, string> = {};
  for (const [k, x] of Object.entries(v)) {
    if (typeof x !== "string") return null;
    out[k] = x;
  }
  return out;
}

/** The saved sync state; anything missing or malformed gives the empty state. Never throws. */
export function loadSyncState(storage: Storage | null): SyncState {
  try {
    const raw = storage?.getItem(SYNC_KEY) ?? null;
    if (raw === null) return emptyState();
    const v: unknown = JSON.parse(raw);
    if (!v || typeof v !== "object" || Array.isArray(v)) return emptyState();
    const o = v as Record<string, unknown>;
    const stamps = stringMap(o.stamps);
    const hashes = stringMap(o.hashes);
    const tombstones = stringMap(o.tombstones);
    const saveId = o.saveId ?? null; // missing in states saved before save generations
    if (!isStringOrNull(o.uid) || !isStringOrNull(o.owner) || !stamps || !hashes || !tombstones || typeof o.changedWhileSignedOut !== "boolean" || !isStringOrNull(saveId)) {
      return emptyState();
    }
    return { uid: o.uid, owner: o.owner, stamps, hashes, tombstones, changedWhileSignedOut: o.changedWhileSignedOut, saveId };
  } catch {
    return emptyState(); // storage blocked or not JSON
  }
}

export function saveSyncState(storage: Storage | null, s: SyncState): void {
  try {
    storage?.setItem(SYNC_KEY, JSON.stringify(s));
  } catch {
    // storage full or blocked: the state is rebuilt from the next sync
  }
}

/** Notes what changed here since the last sync: new or edited records are stamped now, vanished ones get a tombstone. */
export function stampLocalChanges(s: SyncState, current: Records, now: Date): SyncState {
  const at = now.toISOString();
  const hashes = recordHashes(current);
  const stamps = { ...s.stamps };
  const tombstones = { ...s.tombstones };
  for (const [key, hash] of Object.entries(hashes)) {
    if (s.hashes[key] !== hash) {
      stamps[key] = at;
      delete tombstones[key];
    }
  }
  for (const key of Object.keys(s.hashes)) {
    if (!(key in hashes)) {
      tombstones[key] = at;
      delete stamps[key];
    }
  }
  return { ...s, stamps, tombstones, hashes };
}

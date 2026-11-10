// Keeps this device's data and the account's cloud copy in step: connecting, the two-saves choice,
// pushing local edits and taking in edits from other devices.
import type { StudiumData, StudiumEvent } from "../planner/types";
import { emptyData } from "../store/seed";
import { LEGACY_STARTING_TOKENS } from "../planner/tuning";
import { localDateKey } from "../planner/time";
import { DEFAULT_SETTINGS, PET_INVOLVEMENT_LEVELS, PET_ORDERS } from "../store/settings";
import { BACKUP_PREFIX, isValidData, normalizeData } from "../store/storage";
import { decideLink } from "./linkDecision";
import { liveRecords, mergeRecords, type Stamped, type StampedRecords } from "./merge";
import { fromRecords, recordHashes, toRecords, type RecordKey, type Records, type SyncedSettings, type UserRecord } from "./records";
import type { RemoteChange, RemoteStore } from "./remote";
import { summarize, type SaveSummary } from "./saveSummary";
import { loadSyncState, saveSyncState, stampLocalChanges, type SyncState } from "./syncState";

export type EngineDeps = {
  remote: RemoteStore;
  storage: Storage | null;
  clock: () => Date;
  device: string;
  getLocal: () => { data: StudiumData; settings: SyncedSettings };
  applyLocal: (data: StudiumData, settings: SyncedSettings) => boolean; // replaceData + updateSettings
};
export type ConnectResult =
  | { kind: "synced" }
  | { kind: "picker"; local: SaveSummary & { more: number }; account: SaveSummary & { more: number } };

const EPOCH = new Date(0).toISOString(); // never stamped here: any cloud copy is newer
const DEFAULT_SYNCED: SyncedSettings = {
  nickname: DEFAULT_SETTINGS.nickname,
  petInvolvement: DEFAULT_SETTINGS.petInvolvement,
  petOrder: DEFAULT_SETTINGS.petOrder,
};
/** A user record owing nothing to this device, for an account that has none: nothing of the replaced data leaks in. */
const defaultUser = (now: Date): UserRecord => ({
  startingTokens: LEGACY_STARTING_TOKENS,
  defaultBeds: false,
  today: { date: localDateKey(now), taskIds: [] },
  settings: DEFAULT_SYNCED,
});
const DEBOUNCE_MS = 1000;
/** Why a connect or choice failed when this device couldn't keep a backup or take the account's data. */
export const NOT_APPLIED = "Couldn't show the account's data, so this device stays signed out.";
export const BACKUP_FAILED = "Couldn't save a backup, so nothing was replaced.";
/** A connect or choice given up because another connect, or a stop, came after it. */
export const SUPERSEDED = "Another sign-in took over.";
const TABLES = { project: "projects", requirement: "requirements", task: "tasks" } as const;
type Table = keyof typeof TABLES;

/** Every record by its key. Events are never deleted, and stamped with when they happened. */
type Flat = Map<RecordKey, Stamped<unknown>>;

function flatten(s: StampedRecords): Flat {
  const out: Flat = new Map([["user", s.user]]);
  for (const [kind, table] of Object.entries(TABLES)) for (const [id, r] of Object.entries(s[table])) out.set(`${kind}:${id}`, r);
  for (const [id, e] of Object.entries(s.events)) out.set(`event:${id}`, { updatedAt: e.at, deleted: false, value: e });
  return out;
}

function unflatten(f: Flat): StampedRecords {
  const s: StampedRecords = { user: f.get("user") as StampedRecords["user"], projects: {}, requirements: {}, tasks: {}, events: {} };
  for (const [key, r] of f) {
    const i = key.indexOf(":");
    const kind = key.slice(0, i);
    const id = key.slice(i + 1);
    if (kind === "event") s.events[id] = r.value as StudiumEvent;
    else if (kind in TABLES) (s[TABLES[kind as Table]] as Record<string, Stamped<unknown>>)[id] = r;
  }
  return s;
}

const isEvent = (key: RecordKey) => key.startsWith("event:");
const rank = (key: RecordKey) => ["user", "project", "requirement", "task", "event"].indexOf(key.split(":")[0]);

/** This device's records, stamped with when each last changed here; records deleted here are included as deletes. */
function stampedLocal(records: Records, state: SyncState, unstamped: string): StampedRecords {
  const f: Flat = new Map();
  const values: [RecordKey, unknown][] = [["user", records.user]];
  for (const [kind, table] of Object.entries(TABLES)) for (const [id, v] of Object.entries(records[table])) values.push([`${kind}:${id}`, v]);
  for (const [id, e] of Object.entries(records.events)) values.push([`event:${id}`, e]);
  for (const [key, value] of values) {
    const updatedAt = isEvent(key) ? (value as StudiumEvent).at : (state.stamps[key] ?? unstamped);
    f.set(key, { updatedAt, deleted: false, value });
  }
  for (const [key, at] of Object.entries(state.tombstones)) {
    if (!f.has(key) && key !== "user" && !isEvent(key)) f.set(key, { updatedAt: at, deleted: true, value: null });
  }
  return unflatten(f);
}

function stampsOf(f: Flat): Pick<SyncState, "stamps" | "tombstones"> {
  const stamps: Record<RecordKey, string> = {};
  const tombstones: Record<RecordKey, string> = {};
  for (const [key, r] of f) if (!isEvent(key)) (r.deleted ? tombstones : stamps)[key] = r.updatedAt;
  return { stamps, tombstones };
}

function changesFor(f: Flat, keys: RecordKey[]): RemoteChange[] {
  const out: RemoteChange[] = [];
  for (const key of keys) {
    const r = f.get(key);
    if (!r) continue;
    if (!r.deleted) out.push({ kind: "upsert", key, updatedAt: r.updatedAt, value: r.value });
    else if (!isEvent(key)) out.push({ kind: "delete", key, updatedAt: r.updatedAt });
  }
  return out;
}

const sameHashes = (a: Record<string, string>, b: Record<string, string>) =>
  Object.keys(a).length === Object.keys(b).length && Object.keys(a).every((k) => a[k] === b[k]);

const validSettings = (s: SyncedSettings | undefined) =>
  typeof s?.nickname === "string" && PET_INVOLVEMENT_LEVELS.includes(s.petInvolvement) && PET_ORDERS.some((o) => o.value === s.petOrder);

type Assembled = { data: StudiumData; settings: SyncedSettings; records: Records };

/** What the app would see, or null if it isn't valid. A missing user record falls back to `fallbackUser`. */
function assemble(s: StampedRecords, fallbackUser: UserRecord): Assembled | null {
  try {
    const user = !s.user || s.user.deleted || s.user.value === null ? { updatedAt: EPOCH, deleted: false, value: fallbackUser } : s.user;
    const records = liveRecords({ ...s, user });
    const out = fromRecords(records);
    return isValidData(out.data) && validSettings(out.settings) ? { ...out, records } : null;
  } catch {
    return null; // a malformed record
  }
}

type Reconciled = Assembled & { kept: StampedRecords; push: RecordKey[] };

/**
 * Merges, then drops any record the cloud won that would make the data invalid: it starts from this
 * device's side of everything the cloud won and takes the cloud's records back one at a time.
 * Null if even this device's side isn't valid.
 */
function reconcile(local: StampedRecords, remote: StampedRecords, fallbackUser: UserRecord): Reconciled | null {
  const { merged, pushToRemote } = mergeRecords(local, remote);
  const whole = assemble(merged, fallbackUser);
  if (whole) return { ...whole, kept: merged, push: pushToRemote };
  const pushed = new Set(pushToRemote);
  const theirs = flatten(merged);
  const mine = flatten(local);
  let kept: Flat = new Map(theirs);
  const pending: RecordKey[] = [];
  for (const [key, r] of theirs) {
    const own = mine.get(key);
    if (pushed.has(key) || own === r || (isEvent(key) && own)) continue;
    pending.push(key);
    if (own) kept.set(key, own);
    else kept.delete(key);
  }
  let result = assemble(unflatten(kept), fallbackUser);
  if (!result) return null;
  pending.sort((a, b) => rank(a) - rank(b)); // a project before its requirements and tasks
  for (let progress = true; progress; ) {
    progress = false;
    for (const key of [...pending]) {
      const trial = new Map(kept).set(key, theirs.get(key) as Stamped<unknown>);
      const assembled = assemble(unflatten(trial), fallbackUser);
      if (!assembled) continue;
      [kept, result, progress] = [trial, assembled, true];
      pending.splice(pending.indexOf(key), 1);
    }
  }
  return { ...result, kept: unflatten(kept), push: pushToRemote };
}

function hasProjects(r: StampedRecords | null): boolean {
  return r !== null && Object.values(r.projects).some((p) => !p.deleted && p.value !== null);
}

/** The latest time anything here was changed, as far as this device knows. */
function lastChange(data: StudiumData, state: SyncState): string | null {
  const times = [
    ...Object.values(state.stamps),
    ...Object.values(state.tombstones),
    ...data.events.map((e) => e.at),
    ...[...data.projects, ...data.requirements, ...data.tasks].map((x) => x.createdAt),
  ];
  let latest: string | null = null;
  for (const t of times) if (latest === null || Date.parse(t) > Date.parse(latest)) latest = t;
  return latest;
}

export function createSyncEngine(deps: EngineDeps) {
  let state = loadSyncState(deps.storage);
  let session = 0; // bumped on stop and connect, so callbacks from an earlier session do nothing
  let unsubscribe: (() => void) | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let changedAt: Date | null = null; // the latest local edit not yet stamped
  let queue: Promise<void> = Promise.resolve();
  let synced: string | null = null;
  let pending: { uid: string; remote: StampedRecords | null } | null = null; // waiting for the picker

  const save = () => saveSyncState(deps.storage, state);
  const now = () => deps.clock().toISOString();
  const meta = () => ({ savedAt: now(), savedBy: deps.device });
  const localRecords = () => {
    const l = deps.getLocal();
    return toRecords(l.data, l.settings);
  };
  /** No records of this device's at all: taking the cloud's data whole. */
  const nothingHere = (): StampedRecords => ({
    user: { updatedAt: EPOCH, deleted: false, value: defaultUser(deps.clock()) },
    projects: {}, requirements: {}, tasks: {}, events: {},
  });
  /** The account's data as this device would see it; null if the account has nothing valid. */
  const accountData = (remote: StampedRecords | null) => (remote ? reconcile(nothingHere(), remote, defaultUser(deps.clock()))?.data : null) ?? null;

  function enqueue(job: () => Promise<void>): void {
    // A failed write is left for the next change or snapshot; it must not stop later work.
    queue = queue.then(() => job().catch(() => undefined));
  }

  /** Keeps a copy of data about to be replaced. Throws, and nothing is replaced, if it can't. */
  function backup(data: StudiumData): void {
    const base = `${BACKUP_PREFIX}${now()}`;
    let key = base;
    for (let n = 2; deps.storage?.getItem(key) != null; n++) key = `${base}-${n}`;
    try {
      if (!deps.storage) throw new Error("no storage");
      deps.storage.setItem(key, JSON.stringify(data));
    } catch {
      throw new Error(BACKUP_FAILED);
    }
  }

  /** Stamps local edits not yet stamped; returns the keys that changed. */
  function stampChanges(): RecordKey[] {
    const before = state;
    state = stampLocalChanges(state, localRecords(), changedAt ?? deps.clock());
    changedAt = null;
    const keys = Object.keys(state.stamps).filter((k) => state.stamps[k] !== before.stamps[k]);
    return keys.concat(Object.keys(state.tombstones).filter((k) => state.tombstones[k] !== before.tombstones[k]));
  }

  /** Makes the app show the reconciled data (if it differs) and remembers it as synced. */
  function settle(r: Reconciled): boolean {
    const local = deps.getLocal();
    // Hashed as the app will hold it (normalized), so normalizing isn't later taken for a local edit.
    const hashes = recordHashes(toRecords(normalizeData(r.data), r.settings));
    if (!sameHashes(hashes, recordHashes(toRecords(local.data, local.settings))) && !deps.applyLocal(r.data, r.settings)) return false;
    state = { ...state, ...stampsOf(flatten(r.kept)), hashes };
    return true;
  }

  async function write(s: number, uid: string, kept: StampedRecords, keys: RecordKey[]): Promise<void> {
    const changes = changesFor(flatten(kept), keys);
    if (changes.length > 0) await deps.remote.write(uid, changes, meta());
    if (s === session) synced = now();
  }

  /** Merges the account's data in. `fallbackUser`: the user record to use if the account's is missing or invalid. */
  async function mergeIn(uid: string, local: StampedRecords, remote: StampedRecords, fallbackUser: UserRecord): Promise<void> {
    const r = reconcile(local, remote, fallbackUser);
    if (!r) return; // nothing valid to take: this device's data stays
    if (!settle(r)) throw new Error(NOT_APPLIED);
    await write(session, uid, r.kept, r.push);
  }

  /** Throws if a newer connect or a stop has started since session `s` began. */
  function current(s: number): void {
    if (s !== session) throw new Error(SUPERSEDED);
  }

  /**
   * Runs a connect or a choice for `uid`. If this device couldn't keep a backup or take the account's data, it is
   * left signed out with its data as it was. Any other failure (the cloud unreachable) leaves it signed in as `uid`
   * but not connected: edits are stamped when a later connect succeeds, never taken for edits made signed out.
   */
  async function signingIn<T>(s: number, uid: string, work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (e) {
      const message = e instanceof Error ? e.message : "";
      if (message === SUPERSEDED || s !== session) throw e; // the newer work owns the state
      endSession();
      state = { ...state, uid: message === BACKUP_FAILED || message === NOT_APPLIED ? null : uid };
      save();
      throw e;
    }
  }

  /** The account becomes exactly this device's data. `replacing`: the account's data the user chose not to keep. */
  async function upload(uid: string, replacing: StampedRecords | null = null): Promise<void> {
    const at = now();
    const records = localRecords();
    // A chosen save is stamped now throughout, so it beats any older copy still on other devices.
    const f = flatten(stampedLocal(records, replacing ? { ...state, stamps: {} } : state, at));
    if (replacing) for (const key of flatten(replacing).keys()) if (!f.has(key) && !isEvent(key)) f.set(key, { updatedAt: at, deleted: true, value: null });
    await deps.remote.replaceAll(uid, unflatten(f), meta());
    state = { ...state, ...stampsOf(f), hashes: recordHashes(records) };
    synced = at;
  }

  function startSession(uid: string): void {
    state = { ...state, uid, owner: uid, changedWhileSignedOut: false };
    save();
    const s = session;
    unsubscribe = deps.remote.subscribe(uid, (remote) => {
      if (s === session) enqueue(() => onSnapshot(s, uid, remote));
    });
  }

  function endSession(): void {
    if (timer) clearTimeout(timer);
    timer = null;
    unsubscribe?.();
    unsubscribe = null;
    session++;
  }

  async function onSnapshot(s: number, uid: string, remote: StampedRecords): Promise<void> {
    if (s !== session) return;
    stampChanges(); // edits not yet sent are stamped first, so the snapshot can't overwrite them
    const r = reconcile(stampedLocal(localRecords(), state, EPOCH), remote, localRecords().user);
    if (r) settle(r);
    save();
    if (r) await write(s, uid, r.kept, r.push);
  }

  async function pushChanges(s: number): Promise<void> {
    if (s !== session || state.uid === null) return;
    const uid = state.uid;
    const keys = stampChanges();
    save();
    await write(s, uid, stampedLocal(localRecords(), state, EPOCH), keys);
  }

  return {
    connect(uid: string): Promise<ConnectResult> {
      endSession();
      pending = null;
      const s = session;
      return signingIn(s, uid, async (): Promise<ConnectResult> => {
        const remote = await deps.remote.load(uid);
        current(s);
        const local = deps.getLocal();
        const decision = decideLink({ uid, state, localHasProjects: local.data.projects.length > 0, remoteHasProjects: hasProjects(remote) });
        if (decision === "picker") {
          const saved = await deps.remote.savedInfo(uid);
          current(s);
          pending = { uid, remote };
          return {
            kind: "picker",
            local: summarize(local.data, { savedAt: lastChange(local.data, state) ?? now(), savedBy: deps.device }),
            account: summarize(accountData(remote) ?? emptyData(deps.clock()), saved),
          };
        }
        if (decision === "backup-and-take" || (decision === "take" && (local.data.projects.length > 0 || local.data.events.length > 0))) {
          backup(local.data);
          // Nothing about the replaced data may reach this account, not even what was deleted.
          state = { ...state, stamps: {}, tombstones: {}, hashes: {} };
        }
        if (decision === "upload" || !remote) {
          // An empty account taking over from another account's data starts this device afresh.
          if (decision === "backup-and-take" && !deps.applyLocal(emptyData(deps.clock()), DEFAULT_SYNCED)) throw new Error(NOT_APPLIED);
          if (decision === "rejoin") stampChanges();
          await upload(uid);
        } else if (decision === "rejoin") {
          // Edits made here since the last sync (signed out, or closed before they were sent) are stamped first, so they win.
          stampChanges();
          await mergeIn(uid, stampedLocal(localRecords(), state, EPOCH), remote, localRecords().user);
        } else {
          await mergeIn(uid, nothingHere(), remote, defaultUser(deps.clock()));
        }
        current(s);
        startSession(uid);
        return { kind: "synced" };
      });
    },

    choose(uid: string, keep: "local" | "account"): Promise<void> {
      if (!pending || pending.uid !== uid) return Promise.reject(new Error("No two-saves choice is waiting for this account."));
      const { remote } = pending;
      const s = session;
      return signingIn(s, uid, async () => {
        if (keep === "local") {
          const account = accountData(remote);
          if (account) backup(account);
          pending = null; // only once the backup is safe, so a failed one can be retried
          await upload(uid, remote);
        } else {
          backup(deps.getLocal().data);
          pending = null;
          if (remote) await mergeIn(uid, nothingHere(), remote, defaultUser(deps.clock()));
        }
        current(s);
        startSession(uid);
      });
    },

    localChanged(): void {
      if (state.uid === null) {
        // Signed out: the device's copy of the account's data now differs from the account.
        if (state.owner !== null && !state.changedWhileSignedOut && !sameHashes(recordHashes(localRecords()), state.hashes)) {
          state = { ...state, changedWhileSignedOut: true };
          save();
        }
        return;
      }
      if (!unsubscribe) return; // signed in but not connected yet: connecting stamps this edit
      changedAt = deps.clock();
      if (timer) clearTimeout(timer);
      const s = session;
      timer = setTimeout(() => {
        timer = null;
        enqueue(() => pushChanges(s));
      }, DEBOUNCE_MS);
    },

    /** Runs any waiting debounced push now and resolves once all pending work and writes are done. */
    async flush(): Promise<void> {
      if (timer) {
        clearTimeout(timer);
        timer = null;
        const s = session;
        enqueue(() => pushChanges(s));
      }
      let q: Promise<void>;
      do {
        q = queue;
        await q;
      } while (q !== queue);
    },

    stop(): void {
      // Edits not yet sent are stamped, so they go up when this account rejoins.
      if (state.uid !== null) stampChanges();
      endSession();
      pending = null;
      synced = null; // a previous session's time must not look like this one's
      state = { ...state, uid: null };
      save();
    },

    /** The account was deleted: stop, and this device's data is a guest's again, free to link to any account. */
    forget(): void {
      endSession();
      pending = null;
      state = { ...state, uid: null, owner: null, changedWhileSignedOut: false };
      save();
    },

    lastSyncedAt(): string | null {
      return synced;
    },
  };
}

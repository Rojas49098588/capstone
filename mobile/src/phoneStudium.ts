// The phone as one more Studium device. It starts empty and takes the account's save when it signs in
// (the sync engine's link decision), then writes only ticks, reopens and quick adds, through the engine,
// so every write carries the account's save label like the web and desktop apps' do.
import type { StudiumData } from "@shared/planner/types";
import type { Payout } from "@shared/planner/value";
import * as A from "@shared/store/actions";
import { emptyData } from "@shared/store/seed";
import { DEFAULT_SETTINGS } from "@shared/store/settings";
import { BACKUP_PREFIX, isValidData, loadData, normalizeData, saveData } from "@shared/store/storage";
import type { Account, AuthClient } from "@shared/sync/auth";
import type { SyncedSettings } from "@shared/sync/records";
import type { RemoteStore } from "@shared/sync/remote";
import { createSyncEngine } from "@shared/sync/syncEngine";

export const REPLACED_MESSAGE = "Your account's data changed on another device, so this phone took the newest copy.";
export const OFFLINE_MESSAGE = "Not syncing right now. Pull down to try again.";
const SETTINGS_KEY = "studium-phone-settings-v1";
const RETRY_MS = 30_000;

export type PhoneState = { account: Account | null; data: StudiumData; syncing: boolean; message: string | null; now: Date };

export type PhoneStudium = {
  state(): PhoneState;
  subscribe(cb: () => void): () => void;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  reconnect(): Promise<void>;
  /** Re-reads the clock (moods, meal times and today's plan change with time). */
  tick(): void;
  complete(taskId: string, actualMin: number | null): Payout | null;
  reopen(taskId: string): void;
  quickAdd(input: A.PendingTaskInput): void;
  /** Waits until every change has reached the cloud (tests; the app doesn't need to wait). */
  flush(): Promise<void>;
};

export type PhoneDeps = { auth: AuthClient; remote: RemoteStore; storage: Storage; clock: () => Date };

const DEFAULT_SYNCED: SyncedSettings = {
  nickname: DEFAULT_SETTINGS.nickname,
  petInvolvement: DEFAULT_SETTINGS.petInvolvement,
  petOrder: DEFAULT_SETTINGS.petOrder,
};

/** Storage that notices when the sync engine backs up this device's copy, which it does only to replace it. */
function watchBackups(inner: Storage, onBackup: () => void): Storage {
  return {
    get length() {
      return inner.length;
    },
    clear: () => inner.clear(),
    getItem: (k) => inner.getItem(k),
    key: (i) => inner.key(i),
    removeItem: (k) => inner.removeItem(k),
    setItem(k, v) {
      inner.setItem(k, v);
      if (k.startsWith(BACKUP_PREFIX)) onBackup();
    },
  };
}

export function createPhoneStudium(deps: PhoneDeps): PhoneStudium {
  const listeners = new Set<() => void>();
  let data = loadData(deps.storage, deps.clock()).data;
  let settings = readSettings(deps.storage);
  let account = deps.auth.current();
  let syncing = false;
  let message: string | null = null;
  let now = deps.clock();
  let connectedUid: string | null = null;
  let retry: ReturnType<typeof setTimeout> | null = null;
  let snapshot: PhoneState = { account, data, syncing, message, now };

  const emit = () => {
    snapshot = { account, data, syncing, message, now };
    for (const cb of [...listeners]) cb();
  };

  const engine = createSyncEngine({
    remote: deps.remote,
    storage: watchBackups(deps.storage, () => {
      message = REPLACED_MESSAGE;
    }),
    clock: deps.clock,
    device: "Phone",
    getLocal: () => ({ data, settings }),
    applyLocal: (d, s) => {
      if (!isValidData(d)) return false;
      data = normalizeData(d);
      settings = s;
      saveData(deps.storage, data);
      deps.storage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      emit();
      return true;
    },
    onConnectionLost: () => {
      syncing = false;
      if (message !== REPLACED_MESSAGE) message = OFFLINE_MESSAGE;
      emit();
      scheduleRetry();
    },
  });

  function scheduleRetry(): void {
    if (retry) clearTimeout(retry);
    retry = setTimeout(() => {
      retry = null;
      void reconnect();
    }, RETRY_MS);
  }

  async function connectTo(uid: string): Promise<void> {
    connectedUid = uid;
    try {
      const result = await engine.connect(uid);
      // The phone can't make projects, so if it ever holds a save of its own the account's wins.
      if (result.kind === "picker") await engine.choose(uid, "account");
      syncing = true;
      if (message === OFFLINE_MESSAGE) message = null;
    } catch {
      syncing = false;
      if (message !== REPLACED_MESSAGE) message = OFFLINE_MESSAGE;
      scheduleRetry();
    }
    emit();
  }

  async function reconnect(): Promise<void> {
    if (account) await connectTo(account.uid);
  }

  deps.auth.onChange((a) => {
    account = a;
    emit();
    // Signed back in after a restart (Firebase restores the session by itself).
    if (a && a.uid !== connectedUid) void connectTo(a.uid);
  });
  if (account) void connectTo(account.uid);

  function change(next: StudiumData): void {
    data = next;
    saveData(deps.storage, data);
    emit();
    engine.localChanged();
  }

  return {
    state: () => snapshot,
    subscribe(cb) {
      listeners.add(cb);
      return () => void listeners.delete(cb);
    },
    async signIn(email, password) {
      connectedUid = null;
      const a = await deps.auth.signInEmail(email.trim(), password);
      account = a;
      if (connectedUid !== a.uid) await connectTo(a.uid);
    },
    async signOut() {
      if (retry) clearTimeout(retry);
      retry = null;
      // forget, not stop: the phone drops the account's copy, so a later sign-in takes the account's save
      // afresh instead of taking the now-empty phone for deletions.
      engine.forget();
      connectedUid = null;
      await deps.auth.signOut();
      account = null;
      syncing = false;
      message = null;
      data = emptyData(deps.clock());
      saveData(deps.storage, data);
      emit();
    },
    reconnect,
    tick() {
      now = deps.clock();
      emit();
    },
    complete(taskId, actualMin) {
      const r = A.completeTask(data, taskId, actualMin, deps.clock());
      if (r.payout === null) return null;
      change(r.data);
      return r.payout;
    },
    reopen(taskId) {
      change(A.reopenTask(data, taskId, deps.clock()));
    },
    quickAdd(input) {
      change(A.createPendingTask(data, input, deps.clock()).data);
    },
    flush: () => engine.flush(),
  };
}

function readSettings(storage: Storage): SyncedSettings {
  try {
    const raw = storage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SYNCED, ...JSON.parse(raw) } : DEFAULT_SYNCED;
  } catch {
    return DEFAULT_SYNCED;
  }
}

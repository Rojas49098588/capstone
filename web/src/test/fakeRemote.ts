// An in-memory RemoteStore for tests. push() plays another device saving.
import type { StampedRecords } from "../sync/merge";
import type { RemoteChange, RemoteStore, SavedInfo } from "../sync/remote";

const copy = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function applyChange(r: StampedRecords, c: RemoteChange): void {
  const [kind, ...rest] = c.key.split(":");
  const id = rest.join(":");
  const stamped =
    c.kind === "upsert"
      ? { updatedAt: c.updatedAt, deleted: false, value: copy(c.value) }
      : { updatedAt: c.updatedAt, deleted: true, value: null };
  if (c.key === "user") r.user = stamped as StampedRecords["user"];
  else if (kind === "project") r.projects[id] = stamped as StampedRecords["projects"][string];
  else if (kind === "requirement") r.requirements[id] = stamped as StampedRecords["requirements"][string];
  else if (kind === "task") r.tasks[id] = stamped as StampedRecords["tasks"][string];
  else if (kind === "event" && c.kind === "upsert") r.events[id] = copy(c.value) as StampedRecords["events"][string];
}

export class FakeRemote implements RemoteStore {
  private data = new Map<string, StampedRecords>();
  private info = new Map<string, SavedInfo>();
  private listeners = new Map<string, Set<(r: StampedRecords) => void>>();

  private notify(uid: string): void {
    const r = this.data.get(uid);
    if (!r) return;
    for (const cb of [...(this.listeners.get(uid) ?? [])]) cb(copy(r));
  }

  /** Another device saved this. */
  push(uid: string, r: StampedRecords): void {
    this.data.set(uid, copy(r));
    this.notify(uid);
  }

  async load(uid: string): Promise<StampedRecords | null> {
    const r = this.data.get(uid);
    return r ? copy(r) : null;
  }

  async write(uid: string, changes: RemoteChange[], meta: SavedInfo): Promise<void> {
    const r = this.data.get(uid) ?? {
      user: { updatedAt: new Date(0).toISOString(), deleted: false, value: null },
      projects: {},
      requirements: {},
      tasks: {},
      events: {},
    };
    for (const c of changes) applyChange(r, c);
    this.data.set(uid, r);
    this.info.set(uid, { ...meta });
    this.notify(uid);
  }

  subscribe(uid: string, onRemote: (r: StampedRecords) => void): () => void {
    const set = this.listeners.get(uid) ?? new Set();
    set.add(onRemote);
    this.listeners.set(uid, set);
    return () => {
      set.delete(onRemote);
    };
  }

  async replaceAll(uid: string, r: StampedRecords, meta: SavedInfo): Promise<void> {
    this.data.set(uid, copy(r));
    this.info.set(uid, { ...meta });
    this.notify(uid);
  }

  async deleteAll(uid: string): Promise<void> {
    this.data.delete(uid);
    this.info.delete(uid);
  }

  async savedInfo(uid: string): Promise<SavedInfo | null> {
    const i = this.info.get(uid);
    return i ? { ...i } : null;
  }
}

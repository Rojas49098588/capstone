// Firestore behind the RemoteStore interface. The layout is in the accounts-and-sync plan, Task 1.
import type { FirebaseApp } from "firebase/app";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  initializeFirestore,
  onSnapshot,
  persistentLocalCache,
  persistentMultipleTabManager,
  query,
  where,
  writeBatch,
  type DocumentData,
  type Firestore,
  type QuerySnapshot,
  type WriteBatch,
} from "firebase/firestore";
import type { Requirement, StudiumData, StudiumEvent, Task } from "../planner/types";
import type { Stamped, StampedRecords } from "./merge";
import { eventProject, type RecordKey, type UserRecord } from "./records";
import type { RemoteChange, RemoteStore, SavedInfo } from "./remote";

const EPOCH = new Date(0).toISOString();
const SUBS = ["requirements", "tasks", "events"] as const;
const isProjectPath = (p: string) => /^projects\/[^/]+$/.test(p);

export function batchChanges<T>(changes: T[], size = 450): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < changes.length; i += size) out.push(changes.slice(i, i + size));
  return out;
}

/** Which project each task and requirement belongs to, so deletes and events (which carry no project) can find their document. */
export type ProjectIndex = { tasks: Map<string, string>; requirements: Map<string, string> };
const newIndex = (): ProjectIndex => ({ tasks: new Map(), requirements: new Map() });

/** eventProject only looks tasks and requirements up by id, so maps stand in for the arrays it was written for. */
function asLookup(index: ProjectIndex): Pick<StudiumData, "tasks" | "requirements"> {
  const finder = (m: Map<string, string>) => ({
    find: (match: (x: { id: string }) => boolean) => {
      for (const [id, projectId] of m) if (match({ id })) return { id, projectId };
      return undefined;
    },
  });
  return { tasks: finder(index.tasks), requirements: finder(index.requirements) } as unknown as Pick<StudiumData, "tasks" | "requirements">;
}

const idOf = (key: RecordKey) => key.slice(key.indexOf(":") + 1);

/** The document path for a record, or null when a task or requirement's project cannot be determined. */
export function docPath(uid: string, key: RecordKey, data: unknown, index: ProjectIndex = newIndex()): string | null {
  if (key === "user") return `users/${uid}`;
  const id = idOf(key);
  if (key.startsWith("project:")) return `projects/${id}`;
  if (key.startsWith("task:") || key.startsWith("requirement:")) {
    const isTask = key.startsWith("task:");
    const own = (data as { projectId?: string } | null | undefined)?.projectId;
    const project = own ?? (isTask ? index.tasks : index.requirements).get(id);
    return project ? `projects/${project}/${isTask ? "tasks" : "requirements"}/${id}` : null;
  }
  if (key.startsWith("event:")) {
    const project = data ? eventProject(data as StudiumEvent, asLookup(index)) : null;
    return project ? `projects/${project}/events/${id}` : `users/${uid}/events/${id}`;
  }
  return null;
}

type Doc = { path: string; data: DocumentData; merge: boolean };

function remember(index: ProjectIndex, key: RecordKey, path: string | null) {
  if (path === null) return;
  const project = path.split("/")[1];
  if (key.startsWith("task:")) index.tasks.set(idOf(key), project);
  else if (key.startsWith("requirement:")) index.requirements.set(idOf(key), project);
}

/** The stored form of one change. */
function docFor(uid: string, change: RemoteChange, path: string): Doc {
  const { key, updatedAt } = change;
  const value = change.kind === "upsert" ? change.value : null;
  const deleted = change.kind === "delete";
  if (key === "user") return { path, data: { ...(value as UserRecord), updatedAt }, merge: true };
  if (key.startsWith("project:")) {
    const v = value as { project: unknown; decor: unknown } | null;
    return { path, data: { updatedAt, deleted, project: v?.project ?? null, decor: v?.decor ?? {} }, merge: true };
  }
  if (key.startsWith("event:")) {
    return { path, data: path.startsWith("users/") ? { event: value } : { event: value, by: uid }, merge: false };
  }
  return { path, data: { updatedAt, deleted, data: value }, merge: false };
}

function parseUser(d: DocumentData | undefined): Stamped<UserRecord> {
  if (!d || d.startingTokens === undefined) return { updatedAt: EPOCH, deleted: true, value: null };
  const { startingTokens, defaultBeds, today, settings } = d;
  return { updatedAt: d.updatedAt ?? EPOCH, deleted: false, value: { startingTokens, defaultBeds, today, settings } };
}

function stampedDoc<T>(d: DocumentData, field: string): Stamped<T> {
  const deleted = d.deleted === true || d[field] == null;
  return { updatedAt: d.updatedAt ?? EPOCH, deleted, value: deleted ? null : (d[field] as T) };
}

/** What each listener last saw, folded into the account's records. */
type Pieces = {
  user: DocumentData | undefined;
  userEvents: Map<string, DocumentData>;
  projects: Map<string, DocumentData>;
  subs: Map<string, Map<string, DocumentData>>; // "<projectId>/<sub>" -> docs by id
};

function build(p: Pieces, index: ProjectIndex): StampedRecords | null {
  if (!p.user && p.userEvents.size === 0 && p.projects.size === 0) return null;
  const out: StampedRecords = { user: parseUser(p.user), projects: {}, requirements: {}, tasks: {}, events: {} };
  for (const [id, d] of p.userEvents) if (d.event) out.events[id] = d.event as StudiumEvent;
  for (const [id, d] of p.projects) {
    const s = stampedDoc<{ project: never; decor: never }>(d, "project");
    // The project and its decor live on the same doc.
    out.projects[id] = s.deleted ? s : { ...s, value: { project: d.project, decor: d.decor ?? {} } };
    for (const [eid, e] of p.subs.get(`${id}/events`) ?? []) if (e.event) out.events[eid] = e.event as StudiumEvent;
    for (const [tid, t] of p.subs.get(`${id}/tasks`) ?? []) {
      out.tasks[tid] = stampedDoc<Task>(t, "data");
      index.tasks.set(tid, id);
    }
    for (const [rid, r] of p.subs.get(`${id}/requirements`) ?? []) {
      out.requirements[rid] = stampedDoc<Requirement>(r, "data");
      index.requirements.set(rid, id);
    }
  }
  return out;
}

const byId = (s: QuerySnapshot) => new Map(s.docs.map((d) => [d.id, d.data()]));

export function createFirestoreRemote(app: FirebaseApp): RemoteStore {
  const db: Firestore = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    ignoreUndefinedProperties: true,
  });
  const index = newIndex();
  const known = new Set<string>(); // projects seen to exist, so a write knows to update rather than create
  const warned = new Set<string>();

  const memberProjects = (uid: string) => getDocs(query(collection(db, "projects"), where("members", "array-contains", uid)));

  async function loadPieces(uid: string): Promise<Pieces> {
    const [user, userEvents, projects] = await Promise.all([
      getDoc(doc(db, "users", uid)),
      getDocs(collection(db, "users", uid, "events")),
      memberProjects(uid),
    ]);
    const pieces: Pieces = { user: user.data(), userEvents: byId(userEvents), projects: byId(projects), subs: new Map() };
    await Promise.all(
      projects.docs.flatMap((p) => {
        known.add(p.id);
        return SUBS.map(async (sub) => pieces.subs.set(`${p.id}/${sub}`, byId(await getDocs(collection(db, "projects", p.id, sub)))));
      }),
    );
    return pieces;
  }

  type Op = (b: WriteBatch) => void;
  async function commit(ops: Op[]) {
    for (const group of batchChanges(ops)) {
      const b = writeBatch(db);
      for (const op of group) op(b);
      await b.commit();
    }
  }

  const setOp = (d: Doc): Op => (b) => (d.merge ? b.set(doc(db, d.path), d.data, { merge: true }) : b.set(doc(db, d.path), d.data));
  const deleteOp = (path: string): Op => (b) => b.delete(doc(db, path));

  /** The members and owner fields only go on a project's first write; the rules never let them change. */
  async function projectOps(uid: string, docs: Doc[]): Promise<Op[]> {
    const ops: Op[] = [];
    for (const d of docs) {
      const id = d.path.split("/")[1];
      if (!known.has(id) && !(await getDoc(doc(db, d.path))).exists()) d.data = { ...d.data, members: [uid], owner: uid };
      known.add(id);
      ops.push(setOp(d));
    }
    return ops;
  }

  /** savedAt and savedBy go with every write. The user doc's updatedAt is the user record's own stamp, so it only moves with that record. */
  const metaOp = (uid: string, meta: SavedInfo, userStamp?: string): Op =>
    setOp({ path: `users/${uid}`, data: { savedAt: meta.savedAt, savedBy: meta.savedBy, ...(userStamp ? { updatedAt: userStamp } : {}) }, merge: true });

  function warnSkipped(key: RecordKey) {
    if (warned.has(key)) return;
    warned.add(key);
    console.warn(`sync: not saving ${key}, its project cannot be determined`);
  }

  return {
    async load(uid) {
      return build(await loadPieces(uid), index);
    },

    async savedInfo(uid) {
      const d = (await getDoc(doc(db, "users", uid))).data();
      return d?.savedAt && d?.savedBy ? { savedAt: d.savedAt, savedBy: d.savedBy } : null;
    },

    async write(uid, changes, meta) {
      // Learn every task and requirement's project first, so events and deletes can find theirs.
      for (const c of changes) {
        if (c.key.startsWith("task:") || c.key.startsWith("requirement:")) {
          remember(index, c.key, docPath(uid, c.key, c.kind === "upsert" ? c.value : null, index));
        }
      }
      const projects: Doc[] = [];
      const rest: Doc[] = [];
      let userStamp: string | undefined;
      for (const c of changes) {
        const path = docPath(uid, c.key, c.kind === "upsert" ? c.value : null, index);
        if (path === null) {
          warnSkipped(c.key);
          continue;
        }
        if (c.key === "user") userStamp = c.updatedAt;
        (c.key.startsWith("project:") ? projects : rest).push(docFor(uid, c, path));
      }
      // A project must exist before anything is written under it: the rules read its members.
      await commit(await projectOps(uid, projects));
      await commit([...rest.map(setOp), metaOp(uid, meta, userStamp)]);
    },

    async replaceAll(uid, r, meta) {
      const idx = newIndex();
      for (const [id, t] of Object.entries(r.tasks)) if (t.value) idx.tasks.set(id, t.value.projectId);
      for (const [id, q] of Object.entries(r.requirements)) if (q.value) idx.requirements.set(id, q.value.projectId);
      const wanted = new Map<string, Doc>();
      const add = (change: RemoteChange) => {
        const path = docPath(uid, change.key, change.kind === "upsert" ? change.value : null, idx);
        if (path === null) return warnSkipped(change.key);
        wanted.set(path, docFor(uid, change, path));
      };
      const stamped = (key: RecordKey, s: Stamped<unknown>) =>
        add(s.deleted || s.value === null ? { kind: "delete", key, updatedAt: s.updatedAt } : { kind: "upsert", key, updatedAt: s.updatedAt, value: s.value });
      for (const [id, s] of Object.entries(r.projects)) stamped(`project:${id}`, s);
      for (const [id, s] of Object.entries(r.requirements)) stamped(`requirement:${id}`, s);
      for (const [id, s] of Object.entries(r.tasks)) stamped(`task:${id}`, s);
      for (const [id, e] of Object.entries(r.events)) add({ kind: "upsert", key: `event:${id}`, updatedAt: e.at, value: e });
      if (!r.user.deleted && r.user.value) add({ kind: "upsert", key: "user", updatedAt: r.user.updatedAt, value: r.user.value });

      // Whatever this account holds that r does not mention goes. Projects shared with others are left alone.
      const subDeletes: string[] = [];
      const projectDeletes: string[] = [];
      for (const p of (await memberProjects(uid)).docs) {
        if ((p.data().members as string[]).length !== 1) continue;
        for (const sub of SUBS) {
          for (const d of (await getDocs(collection(db, "projects", p.id, sub))).docs) if (!wanted.has(d.ref.path)) subDeletes.push(d.ref.path);
        }
        if (!wanted.has(`projects/${p.id}`)) projectDeletes.push(`projects/${p.id}`);
      }
      for (const d of (await getDocs(collection(db, "users", uid, "events"))).docs) if (!wanted.has(d.ref.path)) subDeletes.push(d.ref.path);

      const docs = [...wanted.values()];
      const projectDocs = docs.filter((d) => isProjectPath(d.path));
      const rest = docs.filter((d) => !isProjectPath(d.path));
      const userStamp = r.user.deleted ? undefined : r.user.updatedAt;
      await commit(await projectOps(uid, projectDocs));
      await commit([...subDeletes.map(deleteOp), ...rest.map(setOp), metaOp(uid, meta, userStamp)]);
      // Last: a project's members are what lets the rules reach its subdocuments.
      await commit(projectDeletes.map(deleteOp));
      for (const p of projectDeletes) known.delete(p.split("/")[1]);
      for (const [id, p] of idx.tasks) index.tasks.set(id, p);
      for (const [id, p] of idx.requirements) index.requirements.set(id, p);
    },

    async deleteAll(uid) {
      for (const p of (await memberProjects(uid)).docs) {
        if ((p.data().members as string[]).length !== 1) continue;
        const subs: Op[] = [];
        for (const sub of SUBS) for (const d of (await getDocs(collection(db, "projects", p.id, sub))).docs) subs.push((b) => b.delete(d.ref));
        await commit(subs);
        await commit([(b) => b.delete(p.ref)]);
        known.delete(p.id);
      }
      const events = (await getDocs(collection(db, "users", uid, "events"))).docs;
      await commit(events.map((d): Op => (b) => b.delete(d.ref)));
      await commit([deleteOp(`users/${uid}`)]);
    },

    subscribe(uid, onRemote) {
      const pieces: Pieces = { user: undefined, userEvents: new Map(), projects: new Map(), subs: new Map() };
      const pending = new Set<string>(["user", "events", "projects"]); // listeners that have not reported yet
      const subUnsubs = new Map<string, () => void>();
      let timer: ReturnType<typeof setTimeout> | undefined;
      let closed = false;

      const fire = () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          if (closed || pending.size > 0) return;
          const records = build(pieces, index);
          if (records) onRemote(records);
        }, 300);
      };
      const reported = (id: string) => {
        pending.delete(id);
        fire();
      };
      const onError = (id: string) => (e: Error) => console.warn(`sync: listener ${id} stopped`, e);

      const stopUser = onSnapshot(
        doc(db, "users", uid),
        (s) => {
          pieces.user = s.data();
          reported("user");
        },
        onError("user"),
      );
      const stopEvents = onSnapshot(
        collection(db, "users", uid, "events"),
        (s) => {
          pieces.userEvents = byId(s);
          reported("events");
        },
        onError("events"),
      );
      const stopProjects = onSnapshot(
        query(collection(db, "projects"), where("members", "array-contains", uid)),
        (s) => {
          pieces.projects = byId(s);
          for (const id of pieces.projects.keys()) {
            known.add(id);
            for (const sub of SUBS) {
              const key = `${id}/${sub}`;
              if (subUnsubs.has(key)) continue;
              pending.add(key);
              subUnsubs.set(
                key,
                onSnapshot(
                  collection(db, "projects", id, sub),
                  (d) => {
                    pieces.subs.set(key, byId(d));
                    reported(key);
                  },
                  onError(key),
                ),
              );
            }
          }
          for (const [key, stop] of subUnsubs) {
            if (pieces.projects.has(key.split("/")[0])) continue;
            stop();
            subUnsubs.delete(key);
            pieces.subs.delete(key);
            pending.delete(key);
          }
          reported("projects");
        },
        onError("projects"),
      );
      return () => {
        closed = true;
        clearTimeout(timer);
        stopUser();
        stopEvents();
        stopProjects();
        for (const stop of subUnsubs.values()) stop();
      };
    },
  };
}

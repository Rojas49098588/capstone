// Runs the Firestore adapter against the local emulators with the real rules: `npm run test:emulator`.
import { deleteApp, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createFirestoreRemote } from "./firestoreRemote";
import type { Stamped, StampedRecords } from "./merge";
import type { RemoteChange, RemoteStore } from "./remote";

const apps: FirebaseApp[] = [];
let counter = 0;
const unique = (p: string) => `${p}${Date.now()}${counter++}`;
const meta = { savedAt: "2026-01-01T00:00:00.000Z", savedBy: "test device" };
const T = (n: number) => new Date(Date.UTC(2026, 0, 1, 0, 0, n)).toISOString();

/** A client: its own app, signed in as the given email (created on first use), with its own remote. */
async function client(email: string, create: boolean): Promise<{ uid: string; remote: RemoteStore }> {
  const app = initializeApp({ apiKey: "fake", projectId: "demo-studium" }, unique("app"));
  apps.push(app);
  const auth = getAuth(app);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  const cred = create ? await createUserWithEmailAndPassword(auth, email, "secret123") : await signInWithEmailAndPassword(auth, email, "secret123");
  return { uid: cred.user.uid, remote: createFirestoreRemote(app, { emulator: { host: "127.0.0.1", port: 8080 } }) };
}
const newUser = () => client(`${unique("u")}@example.com`, true);

// Project ids repeat across tests, so each starts from an empty database.
beforeEach(async () => {
  await fetch("http://127.0.0.1:8080/emulator/v1/projects/demo-studium/databases/(default)/documents", { method: "DELETE" });
});

afterAll(() => Promise.all(apps.map(deleteApp)));

const user = { startingTokens: 5, defaultBeds: false, today: { date: "2026-01-01", taskIds: [] }, settings: { nickname: "A", petInvolvement: "full", petOrder: "newest" } };
const project = (id: string, extra: object = {}) => ({ id, name: id, ...extra });
const task = (id: string, projectId: string) => ({ id, projectId, title: id });
const up = (key: string, value: unknown, n = 1): RemoteChange => ({ kind: "upsert", key, updatedAt: T(n), value });
const del = (key: string, n: number): RemoteChange => ({ kind: "delete", key, updatedAt: T(n) });
const live = (value: unknown, n = 1): Stamped<never> => ({ updatedAt: T(n), deleted: false, value: value as never });
const dead = (n: number): Stamped<never> => ({ updatedAt: T(n), deleted: true, value: null });
const records = (r: Partial<StampedRecords>): StampedRecords => ({ user: live(user as never), projects: {}, requirements: {}, tasks: {}, events: {}, ...r });

describe("firestore remote against the emulator", () => {
  it("a new account's first upload of a project, task, event and user round-trips", async () => {
    const { uid, remote } = await newUser();
    expect(await remote.load(uid)).toBeNull();
    const purchase = { type: "purchase", at: T(3), itemId: "x" };
    const fed = { type: "fed", at: T(4), projectId: "p1", petId: "p1", productId: "f" };
    await remote.write(
      uid,
      [up("user", user), up("project:p1", { project: project("p1"), decor: { h1: { floor: "a" } } }), up("task:t1", task("t1", "p1")), up("event:e1", purchase, 3), up("event:e2", fed, 4)],
      meta,
    );
    const r = await remote.load(uid);
    expect(r?.user.value).toEqual(user);
    expect(r?.projects.p1.value).toEqual({ project: project("p1"), decor: { h1: { floor: "a" } } });
    expect(r?.tasks.t1.value).toEqual(task("t1", "p1"));
    expect(r?.events).toEqual({ e1: purchase, e2: fed });
    expect(await remote.savedInfo(uid)).toEqual(meta);
  });

  it("a removed decor key and a dropped project field are gone after the next write", async () => {
    const { uid, remote } = await newUser();
    await remote.write(uid, [up("project:p1", { project: project("p1", { difficulty: "hard" }), decor: { h1: { floor: "a" }, h2: { floor: "b" } } })], meta);
    await remote.write(uid, [up("project:p1", { project: project("p1"), decor: { h1: { floor: "a" } } }, 2)], meta);
    const r = await remote.load(uid);
    expect(r?.projects.p1.value).toEqual({ project: project("p1"), decor: { h1: { floor: "a" } } });
  });

  it("replaceAll prunes what r leaves out but keeps task tombstones", async () => {
    const { uid, remote } = await newUser();
    await remote.write(
      uid,
      [up("user", user), up("project:p1", { project: project("p1"), decor: {} }), up("project:p2", { project: project("p2"), decor: {} }), up("task:t1", task("t1", "p1")), up("task:t2", task("t2", "p1")), up("task:t3", task("t3", "p1")), up("event:e1", { type: "purchase", at: T(1), itemId: "x" })],
      meta,
    );
    await remote.replaceAll(
      uid,
      records({ projects: { p1: live({ project: project("p1"), decor: {} }, 2) }, tasks: { t1: live(task("t1", "p1"), 2), t3: dead(2) } }),
      meta,
    );
    const r = await remote.load(uid);
    expect(Object.keys(r?.projects ?? {})).toEqual(["p1"]);
    expect(r?.tasks.t1.deleted).toBe(false);
    expect(r?.tasks.t2).toBeUndefined();
    expect(r?.tasks.t3.deleted).toBe(true);
    expect(r?.events).toEqual({});
  });

  it("replaceAll sets the save generation; load and snapshots report it, and later writes keep it", async () => {
    const { uid, remote } = await newUser();
    await remote.replaceAll(uid, { ...records({ projects: { p1: live({ project: project("p1"), decor: {} }) } }), saveId: "gen-1" }, meta);
    expect((await remote.load(uid))?.saveId).toBe("gen-1");
    await remote.write(uid, [up("user", { ...user, startingTokens: 9 }, 2), up("project:p1", { project: project("p1", { name: "renamed" }), decor: {} }, 2)], meta);
    expect((await remote.load(uid))?.saveId).toBe("gen-1");
    await remote.replaceAll(uid, { ...records({}), saveId: "gen-2" }, meta);
    expect((await remote.load(uid))?.saveId).toBe("gen-2");
    const seen: StampedRecords[] = [];
    const stop = remote.subscribe(uid, (r) => seen.push(r));
    await vi_waitFor(() => seen.length > 0);
    stop();
    expect(seen[seen.length - 1].saveId).toBe("gen-2");
  });

  it("replaceAll with a deleted user record leaves the user doc exactly as r says", async () => {
    const { uid, remote } = await newUser();
    await remote.write(uid, [up("user", user)], meta);
    await remote.replaceAll(uid, records({ user: dead(2) }), meta);
    expect((await remote.load(uid))?.user.deleted).toBe(true);
  });

  it("subscribe delivers a rebuilt snapshot after another client writes", async () => {
    const a = await newUser();
    const email = `${unique("s")}@example.com`;
    const b1 = await client(email, true);
    const b2 = await client(email, false);
    expect(b1.uid).toBe(b2.uid);
    await b1.remote.write(b1.uid, [up("user", user), up("project:p1", { project: project("p1"), decor: {} })], meta);
    const seen: StampedRecords[] = [];
    const stop = b2.remote.subscribe(b2.uid, (r) => seen.push(r));
    await vi_waitFor(() => seen.some((r) => r.projects.p1));
    await b1.remote.write(b1.uid, [up("task:t9", task("t9", "p1"), 5)], meta);
    await vi_waitFor(() => seen.some((r) => r.tasks.t9));
    stop();
    expect(a.uid).not.toBe(b1.uid);
  });

  it("deleteAll leaves nothing", async () => {
    const { uid, remote } = await newUser();
    await remote.write(uid, [up("user", user), up("project:p1", { project: project("p1"), decor: {} }), up("task:t1", task("t1", "p1")), up("event:e1", { type: "purchase", at: T(1), itemId: "x" })], meta);
    await remote.deleteAll(uid);
    expect(await remote.load(uid)).toBeNull();
  });

  it("a second user can neither read nor take over the first user's project", async () => {
    const one = await newUser();
    const two = await newUser();
    await one.remote.write(one.uid, [up("user", user), up("project:p1", { project: project("p1"), decor: {} }), up("task:t1", task("t1", "p1"))], meta);
    const seen = await two.remote.load(two.uid);
    expect(seen?.projects.p1).toBeUndefined();
    await expect(two.remote.write(two.uid, [up("project:p1", { project: project("p1", { name: "mine" }), decor: {} }, 9)], meta)).rejects.toThrow();
    expect((await one.remote.load(one.uid))?.projects.p1.value?.project).toEqual(project("p1"));
    await expect(two.remote.write(two.uid, [del("task:t1", 9)], meta)).resolves.toBeUndefined(); // unknown project: skipped, nothing written
    expect((await one.remote.load(one.uid))?.tasks.t1.deleted).toBe(false);
  });
});

async function vi_waitFor(cond: () => boolean, ms = 8000) {
  const end = Date.now() + ms;
  while (!cond()) {
    if (Date.now() > end) throw new Error("timed out waiting for a snapshot");
    await new Promise((r) => setTimeout(r, 50));
  }
}

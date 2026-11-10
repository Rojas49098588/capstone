// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import Shop from "../components/Shop";
import { tokenBalance } from "../planner/history";
import { NOW } from "../planner/testData";
import type { StudiumData } from "../planner/types";
import * as A from "../store/actions";
import { buildSeed, emptyData } from "../store/seed";
import { DEFAULT_SETTINGS } from "../store/settings";
import { BACKUP_PREFIX, isValidData, normalizeData } from "../store/storage";
import { FakeRemote } from "../test/fakeRemote";
import { memoryStorage, renderWithStudium } from "../test/render";
import { liveRecords, type StampedRecords } from "./merge";
import { fromRecords, type SyncedSettings } from "./records";
import { loadSyncState } from "./syncState";
import { SUPERSEDED, createSyncEngine, type EngineDeps } from "./syncEngine";

const ABBY: SyncedSettings = { nickname: "Abby", petInvolvement: "mild", petOrder: "project" };
const BEE: SyncedSettings = { nickname: "Bee", petInvolvement: "moderate", petOrder: "dueDate" };

function withProject(name: string, data: StudiumData = emptyData(NOW)): { data: StudiumData; id: string } {
  const made = A.createProject(data, { name, shortName: name, color: "#123456", deadline: "2026-12-20", description: "", petKind: "cat" }, NOW);
  return { data: made.data, id: made.project.id };
}

/** One device: its own storage, its own data, and a clock the test moves. */
function device(
  remote: FakeRemote,
  name: string,
  data: StudiumData = emptyData(NOW),
  settings: SyncedSettings = ABBY,
  storage = memoryStorage(),
  extra: Pick<EngineDeps, "onConnectionLost"> = {},
) {
  let local = { data, settings };
  let now = NOW;
  const engine = createSyncEngine({
    ...extra,
    remote,
    storage,
    clock: () => now,
    device: name,
    getLocal: () => local,
    applyLocal: (d, s) => {
      if (!isValidData(d)) return false;
      local = { data: normalizeData(d), settings: s };
      return true;
    },
  });
  return {
    engine,
    storage,
    get data() {
      return local.data;
    },
    get settings() {
      return local.settings;
    },
    /** A local save, as the app makes one. */
    edit(f: (d: StudiumData) => StudiumData) {
      local = { ...local, data: f(local.data) };
    },
    advance(ms: number) {
      now = new Date(now.getTime() + ms);
    },
    now: () => now,
  };
}

async function accountData(remote: FakeRemote, uid: string): Promise<StudiumData> {
  return fromRecords(liveRecords((await remote.load(uid)) as StampedRecords)).data;
}

const names = (d: StudiumData) => d.projects.map((p) => p.name);
const backups = (storage: Storage): StudiumData[] => {
  const out: StudiumData[] = [];
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i) as string;
    if (k.startsWith(BACKUP_PREFIX)) out.push(JSON.parse(storage.getItem(k) as string) as StudiumData);
  }
  return out;
};

/** Device B has linked "u1" with a "Novel" project and gone away. */
async function accountWithNovel(remote: FakeRemote) {
  const b = device(remote, "Desktop", withProject("Novel").data, BEE);
  await b.engine.connect("u1");
  b.engine.stop();
  return b;
}

describe("sync engine: connecting", () => {
  it("upload: a guest's data goes up on first link and owner becomes the account", async () => {
    const remote = new FakeRemote();
    const a = device(remote, "Laptop", withProject("Essay").data);
    expect(await a.engine.connect("u1")).toEqual({ kind: "synced" });
    expect(names(await accountData(remote, "u1"))).toEqual(["Essay"]);
    expect(await remote.savedInfo("u1")).toEqual({ savedAt: NOW.toISOString(), savedBy: "Laptop" });
    expect(loadSyncState(a.storage)).toMatchObject({ uid: "u1", owner: "u1", changedWhileSignedOut: false });
    expect(a.engine.lastSyncedAt()).toBe(NOW.toISOString());
  });

  it("take: a fresh device gets the account's data", async () => {
    const remote = new FakeRemote();
    await accountWithNovel(remote);
    const a = device(remote, "Laptop");
    expect(await a.engine.connect("u1")).toEqual({ kind: "synced" });
    expect(names(a.data)).toEqual(["Novel"]);
    expect(a.settings).toEqual(BEE);
    expect(backups(a.storage)).toEqual([]); // nothing of its own to keep
    expect(loadSyncState(a.storage)).toMatchObject({ uid: "u1", owner: "u1" });
  });

  it("take: a guest with only the untouched example data gets the account's data, no picker, and the example is backed up", async () => {
    const remote = new FakeRemote();
    await accountWithNovel(remote);
    const a = device(remote, "Laptop", buildSeed(NOW));
    expect(await a.engine.connect("u1")).toEqual({ kind: "synced" });
    expect(names(a.data)).toEqual(["Novel"]);
    expect(backups(a.storage).map((d) => d.projects.length)).toEqual([buildSeed(NOW).projects.length]);
  });

  it("rejoin: changes made elsewhere are merged in", async () => {
    const remote = new FakeRemote();
    const made = withProject("Essay");
    const a = device(remote, "Laptop", made.data);
    await a.engine.connect("u1");
    a.engine.stop();

    const b = device(remote, "Desktop");
    await b.engine.connect("u1");
    b.advance(60_000);
    b.edit((d) => A.createTask(d, { projectId: made.id, requirementId: null, title: "Outline", estimateMin: 30 }, b.now()).data);
    b.engine.localChanged();
    await b.engine.flush();

    expect(await a.engine.connect("u1")).toEqual({ kind: "synced" });
    expect(a.data.tasks.map((t) => t.title)).toEqual(["Outline"]);
    expect(names(a.data)).toEqual(["Essay"]);
  });

  it("picker: both have projects → returns both summaries and changes nothing yet", async () => {
    const remote = new FakeRemote();
    await accountWithNovel(remote);
    const a = device(remote, "Laptop", withProject("Essay").data);
    const before = a.data;
    const r = await a.engine.connect("u1");
    if (r.kind !== "picker") throw new Error("expected the picker");
    expect(r.local).toMatchObject({ projects: 1, savedBy: "Laptop" });
    expect(r.account).toMatchObject({ projects: 1, savedBy: "Desktop", savedAt: NOW.toISOString() });
    expect(r.account.pets[0].name).toBe("Novel");
    expect(a.data).toBe(before);
    expect(names(await accountData(remote, "u1"))).toEqual(["Novel"]);
    expect(loadSyncState(a.storage)).toMatchObject({ uid: null, owner: null });
    expect(backups(a.storage)).toEqual([]);
  });

  it("choose local: remote becomes this device's data; a backup of the account's data is written", async () => {
    const remote = new FakeRemote();
    await accountWithNovel(remote);
    const a = device(remote, "Laptop", withProject("Essay").data);
    await a.engine.connect("u1");
    await a.engine.choose("u1", "local");
    expect(names(await accountData(remote, "u1"))).toEqual(["Essay"]);
    expect(names(a.data)).toEqual(["Essay"]);
    expect(backups(a.storage).map(names)).toEqual([["Novel"]]);
    expect(loadSyncState(a.storage)).toMatchObject({ uid: "u1", owner: "u1", changedWhileSignedOut: false });
  });

  it("choose account: local becomes the account's; a backup of local is written under BACKUP_PREFIX", async () => {
    const remote = new FakeRemote();
    await accountWithNovel(remote);
    const a = device(remote, "Laptop", withProject("Essay").data);
    await a.engine.connect("u1");
    await a.engine.choose("u1", "account");
    expect(names(a.data)).toEqual(["Novel"]);
    expect(a.settings).toEqual(BEE);
    expect(a.storage.getItem(`${BACKUP_PREFIX}${NOW.toISOString()}`)).not.toBeNull();
    expect(backups(a.storage).map(names)).toEqual([["Essay"]]);
    expect(names(await accountData(remote, "u1"))).toEqual(["Novel"]);
    expect(loadSyncState(a.storage)).toMatchObject({ uid: "u1", owner: "u1" });
  });

  it("backup-and-take: another account's data is backed up and replaced", async () => {
    const remote = new FakeRemote();
    const a = device(remote, "Laptop", withProject("Essay").data);
    await a.engine.connect("u1");
    a.engine.stop();
    const b = device(remote, "Desktop", withProject("Novel").data, BEE);
    await b.engine.connect("u2");
    b.engine.stop();

    expect(await a.engine.connect("u2")).toEqual({ kind: "synced" });
    expect(names(a.data)).toEqual(["Novel"]);
    expect(a.settings).toEqual(BEE); // the new account's, not the previous account's
    expect(backups(a.storage).map(names)).toEqual([["Essay"]]);
    expect(names(await accountData(remote, "u2"))).toEqual(["Novel"]); // never uploaded to u2
    expect(loadSyncState(a.storage)).toMatchObject({ uid: "u2", owner: "u2" });
  });

  it("backup-and-take into an empty account starts afresh with default settings", async () => {
    const remote = new FakeRemote();
    const a = device(remote, "Laptop", withProject("Essay").data);
    await a.engine.connect("u1");
    a.engine.stop();

    expect(await a.engine.connect("u2")).toEqual({ kind: "synced" });
    const defaults: SyncedSettings = { nickname: DEFAULT_SETTINGS.nickname, petInvolvement: DEFAULT_SETTINGS.petInvolvement, petOrder: DEFAULT_SETTINGS.petOrder };
    expect(a.data.projects).toEqual([]);
    expect(a.settings).toEqual(defaults);
    expect(((await remote.load("u2")) as StampedRecords).user.value?.settings).toEqual(defaults);
    expect(names(await accountData(remote, "u2"))).toEqual([]);
    expect(backups(a.storage).map(names)).toEqual([["Essay"]]);
  });

  it("a failed backup leaves the device signed out with its data, and nothing is written", async () => {
    const remote = new FakeRemote();
    const b = device(remote, "Desktop", withProject("Novel").data, BEE);
    await b.engine.connect("u2");
    b.engine.stop();
    const made = withProject("Essay");
    const storage = memoryStorage();
    const a = device(remote, "Laptop", made.data, ABBY, storage);
    await a.engine.connect("u1"); // the app then closes while signed in as u1

    const setItem = storage.setItem;
    storage.setItem = (k: string, v: string) => {
      if (k.startsWith(BACKUP_PREFIX)) throw new Error("storage full");
      setItem(k, v);
    };
    const relaunched = device(remote, "Laptop", made.data, ABBY, storage);
    const before = relaunched.data;
    await expect(relaunched.engine.connect("u2")).rejects.toThrow();
    expect(relaunched.data).toBe(before);
    expect(loadSyncState(storage)).toMatchObject({ uid: null, owner: "u1" });

    const write = vi.spyOn(remote, "write");
    relaunched.edit((d) => A.updateProject(d, made.id, { name: "Thesis" }));
    relaunched.engine.localChanged();
    await relaunched.engine.flush();
    expect(write).not.toHaveBeenCalled();
  });

  it("a choice whose backup fails can be tried again", async () => {
    const remote = new FakeRemote();
    await accountWithNovel(remote);
    const storage = memoryStorage();
    const setItem = storage.setItem;
    let full = true;
    storage.setItem = (k: string, v: string) => {
      if (full && k.startsWith(BACKUP_PREFIX)) throw new Error("storage full");
      setItem(k, v);
    };
    const a = device(remote, "Laptop", withProject("Essay").data, ABBY, storage);
    expect((await a.engine.connect("u1")).kind).toBe("picker");
    await expect(a.engine.choose("u1", "account")).rejects.toThrow();
    expect(names(a.data)).toEqual(["Essay"]);
    expect(loadSyncState(storage).uid).toBeNull();

    full = false;
    await a.engine.choose("u1", "account");
    expect(names(a.data)).toEqual(["Novel"]);
    expect(backups(storage).map(names)).toEqual([["Essay"]]);
  });

  it("an edit not yet sent when the app closed survives the next launch's rejoin", async () => {
    const remote = new FakeRemote();
    const made = withProject("Essay");
    const storage = memoryStorage();
    const a = device(remote, "Laptop", made.data, ABBY, storage);
    await a.engine.connect("u1");
    a.advance(1_000);
    a.edit((d) => A.updateProject(d, made.id, { name: "Thesis" }));
    a.engine.localChanged(); // closed within the debounce: never flushed

    const relaunched = device(remote, "Laptop", a.data, ABBY, storage);
    relaunched.advance(60_000);
    expect(await relaunched.engine.connect("u1")).toEqual({ kind: "synced" });
    expect(names(relaunched.data)).toEqual(["Thesis"]);
    expect(names(await accountData(remote, "u1"))).toEqual(["Thesis"]);
  });

  it("a project deleted while signed out stays deleted on rejoin", async () => {
    const remote = new FakeRemote();
    const made = withProject("Essay");
    const a = device(remote, "Laptop", made.data);
    await a.engine.connect("u1");
    a.engine.stop();
    a.advance(60_000);
    a.edit((d) => A.deleteProject(d, made.id));
    a.engine.localChanged();

    expect(await a.engine.connect("u1")).toEqual({ kind: "synced" });
    expect(a.data.projects).toEqual([]);
    expect((await remote.load("u1"))?.projects[made.id].deleted).toBe(true);
  });

  it("if the app can't take the account's data, connect rejects and the device stays signed out", async () => {
    const remote = new FakeRemote();
    await accountWithNovel(remote);
    const storage = memoryStorage();
    const subscribe = vi.spyOn(remote, "subscribe");
    const engine = createSyncEngine({
      remote, storage, clock: () => NOW, device: "Laptop",
      getLocal: () => ({ data: emptyData(NOW), settings: ABBY }),
      applyLocal: () => false,
    });
    await expect(engine.connect("u1")).rejects.toThrow();
    expect(subscribe).not.toHaveBeenCalled();
    expect(loadSyncState(storage).uid).toBeNull();
    expect(names(await accountData(remote, "u1"))).toEqual(["Novel"]);
  });

  it("taking data the app normalizes doesn't echo the normalizing back as an edit", async () => {
    const remote = new FakeRemote();
    const old = { ...withProject("Novel").data, decor: undefined, defaultBeds: undefined }; // saved before built-in beds
    const b = device(remote, "Desktop", old, BEE);
    await b.engine.connect("u1");
    b.engine.stop();

    const a = device(remote, "Laptop");
    await a.engine.connect("u1");
    expect(a.data.defaultBeds).toBe(true);
    const write = vi.spyOn(remote, "write");
    a.advance(60_000);
    a.engine.localChanged();
    await a.engine.flush();
    expect(write).not.toHaveBeenCalled();
  });
});

describe("sync engine: connects that fail or overlap", () => {
  it("a connect that can't reach the cloud leaves the device signed in, so edits meanwhile aren't taken for signed-out ones", async () => {
    const remote = new FakeRemote();
    const made = withProject("Essay");
    const a = device(remote, "Laptop", made.data);
    await a.engine.connect("u1");
    a.engine.stop();
    vi.spyOn(remote, "load").mockRejectedValueOnce(new Error("offline"));
    await expect(a.engine.connect("u1")).rejects.toThrow("offline");
    expect(loadSyncState(a.storage)).toMatchObject({ uid: "u1", owner: "u1", changedWhileSignedOut: false });

    a.advance(60_000);
    a.edit((d) => A.createTask(d, { projectId: made.id, requirementId: null, title: "Outline", estimateMin: 30 }, a.now()).data);
    a.engine.localChanged();
    expect(loadSyncState(a.storage).changedWhileSignedOut).toBe(false);
    expect(await a.engine.connect("u1")).toEqual({ kind: "synced" }); // no picker between the person's own copies
    expect((await accountData(remote, "u1")).tasks.map((t) => t.title)).toEqual(["Outline"]);
  });

  it("overlapping connects subscribe once; the earlier one gives way", async () => {
    const remote = new FakeRemote();
    const a = device(remote, "Laptop", withProject("Essay").data);
    const subscribe = vi.spyOn(remote, "subscribe");
    const first = a.engine.connect("u1");
    const second = a.engine.connect("u1");
    await expect(first).rejects.toThrow(SUPERSEDED);
    expect(await second).toEqual({ kind: "synced" });
    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(loadSyncState(a.storage)).toMatchObject({ uid: "u1", owner: "u1" });
  });

  it("a stop while connecting leaves it signed out and never subscribes", async () => {
    const remote = new FakeRemote();
    const a = device(remote, "Laptop", withProject("Essay").data);
    const subscribe = vi.spyOn(remote, "subscribe");
    const connecting = a.engine.connect("u1");
    a.engine.stop();
    await expect(connecting).rejects.toThrow(SUPERSEDED);
    expect(subscribe).not.toHaveBeenCalled();
    expect(loadSyncState(a.storage).uid).toBeNull();
  });
});

describe("sync engine: forgetting a deleted account", () => {
  it("forget() leaves the device a guest whose data can go to the next account", async () => {
    const remote = new FakeRemote();
    const a = device(remote, "Laptop", withProject("Essay").data);
    await a.engine.connect("u1");
    a.engine.forget();
    expect(loadSyncState(a.storage)).toMatchObject({ uid: null, owner: null });
    expect(await a.engine.connect("u2")).toEqual({ kind: "synced" });
    expect(names(await accountData(remote, "u2"))).toEqual(["Essay"]);
    expect(backups(a.storage)).toEqual([]);
  });
});

describe("sync engine: while connected", () => {
  it("a local change is pushed with updatedAt = when it happened", async () => {
    const remote = new FakeRemote();
    const made = withProject("Essay");
    const a = device(remote, "Laptop", made.data);
    await a.engine.connect("u1");

    a.advance(60_000);
    const editedAt = a.now().toISOString();
    a.edit((d) => A.updateProject(d, made.id, { name: "Thesis" }));
    a.engine.localChanged();
    a.advance(5_000); // the debounce waits; the stamp is still when the edit happened
    await Promise.resolve();
    expect(names(await accountData(remote, "u1"))).toEqual(["Essay"]); // not yet: debounced
    await a.engine.flush();

    const r = (await remote.load("u1")) as StampedRecords;
    expect(r.projects[made.id].updatedAt).toBe(editedAt);
    expect(r.projects[made.id].value?.project.name).toBe("Thesis");
  });

  it("a deleted task is pushed as a delete and stays deleted after a remote snapshot", async () => {
    const remote = new FakeRemote();
    const made = withProject("Essay");
    const withTask = A.createTask(made.data, { projectId: made.id, requirementId: null, title: "Outline", estimateMin: 30 }, NOW);
    const a = device(remote, "Laptop", withTask.data);
    await a.engine.connect("u1");
    const stale = (await remote.load("u1")) as StampedRecords; // another device that never saw the delete

    a.advance(60_000);
    a.edit((d) => A.deleteTask(d, withTask.task.id, a.now()));
    a.engine.localChanged();
    await a.engine.flush();
    expect((await remote.load("u1"))?.tasks[withTask.task.id].deleted).toBe(true);

    remote.push("u1", stale);
    await a.engine.flush();
    expect(a.data.tasks).toEqual([]);
    expect((await remote.load("u1"))?.tasks[withTask.task.id].deleted).toBe(true);
  });

  it("an invalid remote task is ignored and local data stays", async () => {
    const remote = new FakeRemote();
    const made = withProject("Essay");
    const withTask = A.createTask(made.data, { projectId: made.id, requirementId: null, title: "Outline", estimateMin: 30 }, NOW);
    const a = device(remote, "Laptop", withTask.data);
    await a.engine.connect("u1");

    const later = new Date(NOW.getTime() + 60_000).toISOString();
    const r = (await remote.load("u1")) as StampedRecords;
    const t = r.tasks[withTask.task.id].value!;
    r.tasks[t.id] = { updatedAt: later, deleted: false, value: { ...t, title: "Broken", projectId: "nowhere" } };
    r.tasks.t2 = { updatedAt: later, deleted: false, value: { ...t, id: "t2", title: "Draft" } };
    remote.push("u1", r);
    await a.engine.flush();

    expect(a.data.tasks.map((x) => x.title).sort()).toEqual(["Draft", "Outline"]);
  });

  it("after stop(), late remote snapshots are ignored", async () => {
    const remote = new FakeRemote();
    const listeners: ((r: StampedRecords) => void)[] = [];
    remote.subscribe = (_uid, cb) => {
      listeners.push(cb); // a store that keeps calling back after unsubscribing
      return () => {};
    };
    const a = device(remote, "Laptop", withProject("Essay").data);
    await a.engine.connect("u1");
    a.engine.stop();

    const r = (await remote.load("u1")) as StampedRecords;
    const novel = withProject("Novel").data.projects[0];
    r.projects[novel.id] = { updatedAt: new Date(NOW.getTime() + 60_000).toISOString(), deleted: false, value: { project: novel, decor: {} } };
    for (const cb of listeners) cb(r);
    await a.engine.flush();

    expect(names(a.data)).toEqual(["Essay"]);
    expect(loadSyncState(a.storage)).toMatchObject({ uid: null, owner: "u1" });
  });

  it("changes while signed out set changedWhileSignedOut", async () => {
    const remote = new FakeRemote();
    const made = withProject("Essay");
    const guest = device(remote, "Laptop", made.data);
    guest.edit((d) => A.updateProject(d, made.id, { name: "Guest edit" }));
    guest.engine.localChanged();
    await guest.engine.flush();
    expect(loadSyncState(guest.storage).changedWhileSignedOut).toBe(false); // guest data has no account to differ from

    const a = device(remote, "Laptop", made.data);
    await a.engine.connect("u1");
    a.engine.stop();
    a.edit((d) => A.updateProject(d, made.id, { name: "Offline edit" }));
    a.engine.localChanged();
    await a.engine.flush();
    expect(loadSyncState(a.storage)).toMatchObject({ uid: null, owner: "u1", changedWhileSignedOut: true });
    expect(names(await accountData(remote, "u1"))).toEqual(["Essay"]); // saved only on the device
  });

  it("two offline purchases that overspend keep both, the balance shows negative, and the next purchase is refused", async () => {
    const remote = new FakeRemote();
    const start = { ...withProject("Essay").data, startingTokens: 200 };
    const a = device(remote, "Laptop", start);
    await a.engine.connect("u1");
    const b = device(remote, "Desktop");
    await b.engine.connect("u1");

    // Each spends 180 of the 200 before hearing about the other's purchase.
    a.advance(60_000);
    a.edit((d) => A.purchase(d, "rainy-day-coat", a.now()).data);
    b.advance(120_000);
    b.edit((d) => A.purchase(d, "rainy-day-coat", b.now()).data);
    b.engine.localChanged();
    await b.engine.flush();
    a.engine.localChanged();
    await a.engine.flush();
    await b.engine.flush();

    for (const d of [a.data, b.data]) {
      expect(d.events.filter((e) => e.type === "purchase")).toHaveLength(2);
      expect(tokenBalance(d)).toBe(-160);
      expect(A.purchase(d, "berry-bites", NOW).ok).toBe(false);
    }

    renderWithStudium(createElement(Shop), { data: a.data });
    screen.getByText("-160");
  });
});

/** The same cloud, but its listener never reports: a device that only hears about others when it connects. */
function quiet(remote: FakeRemote): FakeRemote {
  return Object.assign(Object.create(remote) as FakeRemote, { subscribe: () => () => {} });
}

describe("sync engine: two devices, stale copies", () => {
  it("a later edit on a stale copy of a task doesn't uncheck it where it was completed elsewhere", async () => {
    const remote = new FakeRemote();
    const made = withProject("Essay");
    const withTask = A.createTask(made.data, { projectId: made.id, requirementId: null, title: "Outline", estimateMin: 30 }, NOW);
    const a = device(quiet(remote), "Laptop", withTask.data);
    await a.engine.connect("u1");
    const b = device(quiet(remote), "Desktop");
    await b.engine.connect("u1");

    a.advance(60_000);
    a.edit((d) => A.completeTask(d, withTask.task.id, 25, a.now()).data);
    a.engine.localChanged();
    await a.engine.flush();
    b.advance(120_000); // the desktop still holds the task as not done, and renames it later
    b.edit((d) => A.updateTask(d, withTask.task.id, { title: "Outline v2" }, b.now()));
    b.engine.localChanged();
    await b.engine.flush();

    a.advance(600_000);
    await a.engine.connect("u1");
    b.advance(600_000);
    await b.engine.connect("u1");
    for (const d of [a.data, b.data, await accountData(remote, "u1")]) {
      expect(d.tasks[0]).toMatchObject({ title: "Outline v2", done: true, actualMin: 25 });
      expect(d.events.filter((e) => e.type === "task_completed")).toHaveLength(1);
    }
    // Deriving "done" from the events is not a local edit: nothing is sent back for it.
    const write = vi.spyOn(remote, "write");
    a.advance(60_000);
    a.engine.localChanged();
    await a.engine.flush();
    expect(write).not.toHaveBeenCalled();
  });

  it("a reopen on one device after a completion elsewhere leaves the task open everywhere", async () => {
    const remote = new FakeRemote();
    const made = withProject("Essay");
    const withTask = A.createTask(made.data, { projectId: made.id, requirementId: null, title: "Outline", estimateMin: 30 }, NOW);
    const done = A.completeTask(withTask.data, withTask.task.id, 25, NOW).data;
    const a = device(quiet(remote), "Laptop", done);
    await a.engine.connect("u1");
    const b = device(quiet(remote), "Desktop");
    await b.engine.connect("u1");

    b.advance(60_000);
    b.edit((d) => A.reopenTask(d, withTask.task.id, b.now()));
    b.engine.localChanged();
    await b.engine.flush();
    a.advance(120_000); // the laptop renames its stale, still-done copy later
    a.edit((d) => A.updateTask(d, withTask.task.id, { title: "Outline v2" }, a.now()));
    a.engine.localChanged();
    await a.engine.flush();

    b.advance(600_000);
    await b.engine.connect("u1");
    a.advance(600_000);
    await a.engine.connect("u1");
    for (const d of [a.data, b.data]) expect(d.tasks[0]).toMatchObject({ title: "Outline v2", done: false, actualMin: null });
  });
});

/** Rejects if `p` hasn't settled within `ms`. */
function within<T>(p: Promise<T>, ms = 500): Promise<T> {
  return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error("still waiting")), ms))]);
}
const ticks = () => new Promise((r) => setTimeout(r, 0));

describe("sync engine: edits are stamped when they happen", () => {
  it("an edit made at 09:00 and never sent loses to one made at 10:00 elsewhere, though it reaches the cloud at 13:00", async () => {
    const remote = new FakeRemote();
    const made = withProject("Essay");
    const storage = memoryStorage();
    const a = device(quiet(remote), "Laptop", made.data, ABBY, storage);
    await a.engine.connect("u1");
    const b = device(quiet(remote), "Desktop");
    await b.engine.connect("u1");

    a.edit((d) => A.updateProject(d, made.id, { name: "Laptop 9am" }));
    a.engine.localChanged(); // closed within the debounce: never sent
    b.advance(3_600_000);
    b.edit((d) => A.updateProject(d, made.id, { name: "Desktop 10am" }));
    b.engine.localChanged();
    await b.engine.flush();

    const relaunched = device(remote, "Laptop", a.data, ABBY, storage);
    relaunched.advance(4 * 3_600_000);
    await relaunched.engine.connect("u1");
    expect(names(relaunched.data)).toEqual(["Desktop 10am"]);
    expect(names(await accountData(remote, "u1"))).toEqual(["Desktop 10am"]);
  });

  it("an edit made while signed in but not connected keeps its own time", async () => {
    const remote = new FakeRemote();
    const made = withProject("Essay");
    const a = device(remote, "Laptop", made.data);
    await a.engine.connect("u1");
    a.engine.stop();
    vi.spyOn(remote, "load").mockRejectedValueOnce(new Error("offline"));
    await expect(a.engine.connect("u1")).rejects.toThrow("offline");

    const editedAt = new Date(a.now().getTime() + 60_000).toISOString();
    a.advance(60_000);
    a.edit((d) => A.updateProject(d, made.id, { name: "Thesis" }));
    a.engine.localChanged();
    a.advance(3_600_000);
    await a.engine.connect("u1");
    expect((await remote.load("u1"))?.projects[made.id]).toMatchObject({ updatedAt: editedAt, value: { project: { name: "Thesis" } } });
  });

  it("a write the cloud never acknowledges doesn't hold up the next push", async () => {
    const remote = new FakeRemote();
    const made = withProject("Essay");
    const a = device(remote, "Laptop", made.data);
    await a.engine.connect("u1");
    const write = vi.spyOn(remote, "write").mockImplementation(() => new Promise(() => {}));

    a.advance(1_000);
    a.edit((d) => A.updateProject(d, made.id, { name: "One" }));
    a.engine.localChanged();
    void a.engine.flush();
    await ticks();
    a.advance(1_000);
    a.edit((d) => A.updateProject(d, made.id, { name: "Two" }));
    a.engine.localChanged();
    void a.engine.flush();
    await ticks();
    expect(write).toHaveBeenCalledTimes(2);
  });

  it("connecting doesn't wait for the cloud to acknowledge its writes", async () => {
    const remote = new FakeRemote();
    const made = withProject("Essay");
    const a = device(remote, "Laptop", made.data);
    vi.spyOn(remote, "replaceAll").mockImplementation(() => new Promise(() => {}));
    expect(await within(a.engine.connect("u1"))).toEqual({ kind: "synced" }); // first upload

    const b = device(remote, "Desktop", withProject("Novel").data);
    await b.engine.connect("u2");
    b.engine.stop();
    b.advance(60_000);
    b.edit((d) => A.updateProject(d, d.projects[0].id, { name: "Edited offline" }));
    vi.spyOn(remote, "write").mockImplementation(() => new Promise(() => {}));
    expect(await within(b.engine.connect("u2"))).toEqual({ kind: "synced" }); // rejoin sends the edit
  });
});

describe("sync engine: keeping this computer's save while another device is linked", () => {
  /** The desktop linked "u1" with a Novel project and a purchase; the laptop then links with an Essay and keeps its own. */
  async function laptopKeepsItsOwn(remote: FakeRemote, desktopStaysConnected: boolean) {
    const novel = withProject("Novel");
    const bought = A.purchase({ ...novel.data, startingTokens: 5000 }, "rainy-day-coat", NOW).data;
    const b = device(remote, "Desktop", bought, BEE);
    await b.engine.connect("u1");
    if (!desktopStaysConnected) b.engine.stop();

    const a = device(remote, "Laptop", withProject("Essay").data);
    const balance = tokenBalance(a.data);
    expect((await a.engine.connect("u1")).kind).toBe("picker");
    await a.engine.choose("u1", "local");
    await a.engine.flush();
    return { a, b, balance };
  }

  const purchases = (d: StudiumData) => d.events.filter((e) => e.type === "purchase");

  it("a device that rejoins later backs up its copy and takes the kept save, bringing nothing of the other back", async () => {
    const remote = new FakeRemote();
    const { a, b, balance } = await laptopKeepsItsOwn(remote, false);

    b.advance(60_000);
    await b.engine.connect("u1");
    await b.engine.flush();
    expect(names(b.data)).toEqual(["Essay"]);
    expect(purchases(b.data)).toEqual([]);
    expect(backups(b.storage).map(names)).toEqual([["Novel"]]);
    const account = await accountData(remote, "u1");
    expect(names(account)).toEqual(["Essay"]);
    expect(purchases(account)).toEqual([]);

    a.advance(120_000);
    await a.engine.connect("u1");
    expect(tokenBalance(a.data)).toBe(balance);
  });

  it("a device still connected takes the kept save from its next snapshot, and sends nothing of its own", async () => {
    const remote = new FakeRemote();
    const { a, b, balance } = await laptopKeepsItsOwn(remote, true);
    await b.engine.flush();
    expect(names(b.data)).toEqual(["Essay"]);
    expect(purchases(b.data)).toEqual([]);
    expect(backups(b.storage).map(names)).toEqual([["Novel"]]);
    const account = await accountData(remote, "u1");
    expect(names(account)).toEqual(["Essay"]);
    expect(purchases(account)).toEqual([]);
    expect(tokenBalance(a.data)).toBe(balance);
  });
});

describe("sync engine: when the cloud's listener stops", () => {
  it("the session ends and says so, the device stays signed in, and the next connect catches up", async () => {
    const remote = new FakeRemote();
    const made = withProject("Essay");
    const lost = vi.fn();
    const a = device(remote, "Laptop", made.data, ABBY, memoryStorage(), { onConnectionLost: lost });
    await a.engine.connect("u1");
    const subscribe = vi.spyOn(remote, "subscribe");
    const error = new Error("permission-denied");
    remote.failListeners("u1", error);
    expect(lost).toHaveBeenCalledWith(error);
    expect(loadSyncState(a.storage)).toMatchObject({ uid: "u1", owner: "u1" });

    a.advance(60_000);
    const editedAt = a.now().toISOString();
    a.edit((d) => A.updateProject(d, made.id, { name: "Thesis" }));
    a.engine.localChanged(); // not connected: stamped, sent by the next connect
    await a.engine.flush();
    expect(names(await accountData(remote, "u1"))).toEqual(["Essay"]);
    a.advance(60_000);
    expect(await a.engine.connect("u1")).toEqual({ kind: "synced" });
    await a.engine.flush();
    expect(subscribe).toHaveBeenCalledTimes(1);
    expect((await remote.load("u1"))?.projects[made.id]).toMatchObject({ updatedAt: editedAt, value: { project: { name: "Thesis" } } });
  });

  it("a write the cloud refuses is reported the same way", async () => {
    const remote = new FakeRemote();
    const made = withProject("Essay");
    const lost = vi.fn();
    const a = device(remote, "Laptop", made.data, ABBY, memoryStorage(), { onConnectionLost: lost });
    await a.engine.connect("u1");
    const error = new Error("permission-denied");
    vi.spyOn(remote, "write").mockRejectedValueOnce(error);
    a.advance(1_000);
    a.edit((d) => A.updateProject(d, made.id, { name: "Thesis" }));
    a.engine.localChanged();
    await a.engine.flush();
    expect(lost).toHaveBeenCalledWith(error);
  });
});

describe("sync engine: backups", () => {
  const keys = (storage: Storage) => {
    const out: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i) as string;
      if (k.startsWith(BACKUP_PREFIX)) out.push(k);
    }
    return out.sort();
  };
  const at = (minutes: number) => `${BACKUP_PREFIX}${new Date(NOW.getTime() + minutes * 60_000).toISOString()}`;

  it("only the 5 newest are kept, the one just written always among them", async () => {
    const remote = new FakeRemote();
    await accountWithNovel(remote);
    const storage = memoryStorage();
    for (const m of [-60, -50, -40, -30, -20, -10]) storage.setItem(at(m), "{}");
    const a = device(remote, "Laptop", withProject("Essay").data, ABBY, storage);
    await a.engine.connect("u2"); // a guest's data linked to u2...
    a.engine.stop();
    a.advance(60_000);
    await a.engine.connect("u1"); // ...then another account signs in here: backed up and replaced
    expect(keys(storage)).toEqual([at(-40), at(-30), at(-20), at(-10), at(1)]);
  });

  it("a backup written while the clock is behind older ones still stays", async () => {
    const remote = new FakeRemote();
    await accountWithNovel(remote);
    const storage = memoryStorage();
    for (const m of [10, 20, 30, 40, 50, 60]) storage.setItem(at(m), "{}");
    const a = device(remote, "Laptop", withProject("Essay").data, ABBY, storage);
    await a.engine.connect("u2");
    a.engine.stop();
    await a.engine.connect("u1");
    expect(keys(storage)).toEqual([at(0), at(30), at(40), at(50), at(60)]);
    expect(JSON.parse(storage.getItem(at(0)) as string).projects[0].name).toBe("Essay");
  });
});

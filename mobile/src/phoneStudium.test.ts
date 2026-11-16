import * as A from "@shared/store/actions";
import { buildSeed, emptyData } from "@shared/store/seed";
import { createSyncEngine } from "@shared/sync/syncEngine";
import { liveRecords } from "@shared/sync/merge";
import { fromRecords, type SyncedSettings } from "@shared/sync/records";
import { FakeAuth } from "@shared/test/fakeAuth";
import { FakeRemote } from "@shared/test/fakeRemote";
import type { StudiumData } from "@shared/planner/types";
import { createPhoneStudium, REPLACED_MESSAGE } from "./phoneStudium";

const NOW = new Date(2026, 10, 16, 12, 0, 0);
const EMAIL = "abby@example.com";
const UID = `u-${EMAIL}`;

function memory(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}

/** A computer already on the account, holding `data`; returns its engine and a way to read what it holds. */
async function computer(remote: FakeRemote, data: StudiumData) {
  let local: { data: StudiumData; settings: SyncedSettings } = { data, settings: { nickname: "Abby", petInvolvement: "mild", petOrder: "project" } };
  const engine = createSyncEngine({
    remote,
    storage: memory(),
    clock: () => NOW,
    device: "Computer",
    getLocal: () => local,
    applyLocal: (d, s) => {
      local = { data: d, settings: s };
      return true;
    },
  });
  await engine.connect(UID);
  await engine.flush();
  return { engine, data: () => local.data };
}

async function accountData(remote: FakeRemote): Promise<StudiumData> {
  const r = await remote.load(UID);
  return fromRecords(liveRecords(r!)).data;
}

function phone(remote: FakeRemote, auth = new FakeAuth()) {
  return createPhoneStudium({ auth, remote, storage: memory(), clock: () => NOW });
}

const settle = () => new Promise((r) => setTimeout(r, 0));

test("signing in takes the account's save, with no picker", async () => {
  const remote = new FakeRemote();
  await computer(remote, buildSeed(NOW));
  const p = phone(remote);
  await p.signIn(EMAIL, "pw");
  expect(p.state().account?.email).toBe(EMAIL);
  expect(p.state().data.projects.map((x) => x.id)).toEqual((await accountData(remote)).projects.map((x) => x.id));
});

test("a quick add reaches the account, and a tick pays what the desktop would", async () => {
  const remote = new FakeRemote();
  await computer(remote, buildSeed(NOW));
  const p = phone(remote);
  await p.signIn(EMAIL, "pw");
  const project = p.state().data.projects[0];
  p.quickAdd({ projectId: project.id, title: "Email TA", addToToday: true });
  const open = p.state().data.tasks.find((t) => !t.done && t.requirementId !== null && !A.isPending(t))!;
  const expected = A.completeTask(p.state().data, open.id, null, NOW).payout;
  expect(p.complete(open.id, null)).toEqual(expected);
  await p.flush();
  const account = await accountData(remote);
  expect(account.tasks.find((t) => t.title === "Email TA")).toMatchObject({ pending: true });
  expect(account.tasks.find((t) => t.id === open.id)?.done).toBe(true);
  p.reopen(open.id);
  await p.flush();
  expect((await accountData(remote)).tasks.find((t) => t.id === open.id)?.done).toBe(false);
});

test("a quick add made while the cloud can't be reached gets there once it can", async () => {
  const remote = new FakeRemote();
  await computer(remote, buildSeed(NOW));
  const p = phone(remote);
  await p.signIn(EMAIL, "pw");
  const write = remote.write.bind(remote);
  const offline = jest.spyOn(remote, "write").mockRejectedValueOnce(Object.assign(new Error("offline"), { code: "unavailable" }));
  p.quickAdd({ projectId: p.state().data.projects[0].id, title: "Offline idea", addToToday: false });
  await p.flush();
  await settle();
  expect(p.state().syncing).toBe(false);
  offline.mockImplementation(write);
  await p.reconnect();
  await p.flush();
  expect((await accountData(remote)).tasks.some((t) => t.title === "Offline idea")).toBe(true);
  expect(p.state().syncing).toBe(true);
});

test("when another device replaces the save, the phone takes the new one and says so", async () => {
  const remote = new FakeRemote();
  await computer(remote, buildSeed(NOW));
  const p = phone(remote);
  await p.signIn(EMAIL, "pw");
  p.quickAdd({ projectId: p.state().data.projects[0].id, title: "Queued", addToToday: false });
  const r = await remote.load(UID);
  await remote.replaceAll(UID, { ...r!, saveId: "replaced-elsewhere" }, { savedAt: NOW.toISOString(), savedBy: "Computer" });
  await p.flush();
  await settle();
  await p.reconnect();
  await p.flush();
  expect(p.state().message).toBe(REPLACED_MESSAGE);
  expect(p.state().data.tasks.some((t) => t.title === "Queued")).toBe(false);
  expect(p.state().syncing).toBe(true);
});

test("an account with no projects gives the phone none, without failing", async () => {
  const remote = new FakeRemote();
  const p = phone(remote);
  await p.signIn(EMAIL, "pw");
  expect(p.state().data.projects).toEqual([]);
});

test("signing out leaves the phone empty, and signing back in doesn't delete the account's data", async () => {
  const remote = new FakeRemote();
  await computer(remote, buildSeed(NOW));
  const before = (await accountData(remote)).projects.length;
  const p = phone(remote);
  await p.signIn(EMAIL, "pw");
  await p.signOut();
  expect(p.state().account).toBeNull();
  expect(p.state().data.projects).toEqual([]);
  await p.signIn(EMAIL, "pw");
  await p.flush();
  expect((await accountData(remote)).projects.length).toBe(before);
  expect(p.state().data.projects.length).toBe(before);
});

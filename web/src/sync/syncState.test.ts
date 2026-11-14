import { describe, expect, it } from "vitest";
import { memoryStorage } from "../test/render";
import type { Task } from "../planner/types";
import type { Records } from "./records";
import { recordHashes } from "./records";
import { EMPTY_SYNC_STATE, SYNC_KEY, loadSyncState, saveSyncState, stampLocalChanges, type SyncState } from "./syncState";

const task = (id: string, title: string): Task => ({
  id, projectId: "p1", requirementId: null, title, estimateMin: 5, blockedBy: [], priority: false, done: false, actualMin: null,
  createdAt: "2026-11-09T09:00:00.000Z",
});
const records = (tasks: Task[]): Records => ({
  user: { startingTokens: 100, defaultBeds: false, today: { date: "2026-11-09", taskIds: [] }, settings: { nickname: "A", petInvolvement: "mild", petOrder: "project" } },
  projects: {},
  requirements: {},
  tasks: Object.fromEntries(tasks.map((t) => [t.id, t])),
  events: {},
});

describe("syncState", () => {
  it("bad or missing saved state gives the empty state", () => {
    const s = memoryStorage();
    expect(loadSyncState(s)).toEqual(EMPTY_SYNC_STATE);
    expect(loadSyncState(null)).toEqual(EMPTY_SYNC_STATE);
    for (const bad of ["not json", "null", "[]", "5", '{"uid":3}', '{"uid":null,"owner":null,"stamps":[],"hashes":{},"tombstones":{},"changedWhileSignedOut":false}']) {
      s.setItem(SYNC_KEY, bad);
      expect(loadSyncState(s)).toEqual(EMPTY_SYNC_STATE);
    }
    expect(loadSyncState(s)).not.toBe(EMPTY_SYNC_STATE);
  });

  it("a changed record is stamped now, a removed one gets a tombstone, an unchanged one keeps its stamp", () => {
    const before = records([task("keep", "K"), task("edit", "E"), task("gone", "G")]);
    const h = recordHashes(before);
    const old = "2026-11-01T00:00:00.000Z";
    const s: SyncState = {
      ...EMPTY_SYNC_STATE, uid: "u1", owner: "u1",
      stamps: { user: old, "task:keep": old, "task:edit": old, "task:gone": old },
      hashes: h, tombstones: { "task:added": old },
    };
    const now = new Date("2026-11-09T12:00:00.000Z");
    const after = records([task("keep", "K"), task("edit", "E2"), task("added", "N")]);
    const out = stampLocalChanges(s, after, now);
    expect(out.stamps["task:keep"]).toBe(old);
    expect(out.stamps["user"]).toBe(old);
    expect(out.stamps["task:edit"]).toBe(now.toISOString());
    expect(out.stamps["task:added"]).toBe(now.toISOString());
    expect(out.tombstones["task:added"]).toBeUndefined();
    expect(out.stamps["task:gone"]).toBeUndefined();
    expect(out.tombstones["task:gone"]).toBe(now.toISOString());
    expect(out.hashes).toEqual(recordHashes(after));
    expect(out.uid).toBe("u1");
    expect(out.owner).toBe("u1");
  });

  it("saving and loading round-trips", () => {
    const s = memoryStorage();
    const state: SyncState = {
      uid: "u1", owner: "u2", stamps: { user: "a" }, hashes: { user: "h" }, tombstones: { "task:x": "b" }, changedWhileSignedOut: true, saveId: "s1",
    };
    saveSyncState(s, state);
    expect(loadSyncState(s)).toEqual(state);
  });

  it("a state saved before save generations loads with none", () => {
    const s = memoryStorage();
    s.setItem(SYNC_KEY, JSON.stringify({ uid: "u1", owner: "u1", stamps: {}, hashes: {}, tombstones: {}, changedWhileSignedOut: false }));
    expect(loadSyncState(s)).toEqual({ ...EMPTY_SYNC_STATE, uid: "u1", owner: "u1" });
  });
});

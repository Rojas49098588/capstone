import { describe, expect, it, vi } from "vitest";
import type { StampedRecords } from "../sync/merge";
import { FakeRemote } from "./fakeRemote";

const T1 = "2026-01-01T00:00:00.000Z";
const T2 = "2026-01-02T00:00:00.000Z";
const meta = { savedAt: T1, savedBy: "dev" };
const empty = (): StampedRecords => ({
  user: { updatedAt: T1, deleted: false, value: null },
  projects: {},
  requirements: {},
  tasks: {},
  events: {},
});

describe("FakeRemote", () => {
  it("loads null for an unknown account, then a copy of what was pushed", async () => {
    const remote = new FakeRemote();
    expect(await remote.load("u1")).toBeNull();
    const r = empty();
    remote.push("u1", r);
    const loaded = await remote.load("u1");
    expect(loaded).toEqual(r);
    expect(loaded).not.toBe(r);
  });

  it("applies upserts and deletes by key, and records savedInfo", async () => {
    const remote = new FakeRemote();
    remote.push("u1", empty());
    await remote.write(
      "u1",
      [
        { kind: "upsert", key: "task:t1", updatedAt: T1, value: { id: "t1" } },
        { kind: "upsert", key: "event:e1", updatedAt: T1, value: { eventId: "e1" } },
      ],
      meta,
    );
    await remote.write(
      "u1",
      [
        { kind: "delete", key: "task:t1", updatedAt: T2 },
        { kind: "delete", key: "event:e1", updatedAt: T2 },
      ],
      { savedAt: T2, savedBy: "dev" },
    );
    const r = (await remote.load("u1"))!;
    expect(r.tasks.t1).toEqual({ updatedAt: T2, deleted: true, value: null });
    expect(r.events.e1).toEqual({ eventId: "e1" });
    expect(await remote.savedInfo("u1")).toEqual({ savedAt: T2, savedBy: "dev" });
  });

  it("notifies subscribers of pushes and writes until unsubscribed", async () => {
    const remote = new FakeRemote();
    const cb = vi.fn();
    const off = remote.subscribe("u1", cb);
    remote.push("u1", empty());
    await remote.write("u1", [{ kind: "upsert", key: "task:t1", updatedAt: T1, value: {} }], meta);
    await remote.replaceAll("u1", empty(), meta);
    expect(cb).toHaveBeenCalledTimes(3);
    off();
    remote.push("u1", empty());
    expect(cb).toHaveBeenCalledTimes(3);
  });

  it("deleteAll removes the account's data", async () => {
    const remote = new FakeRemote();
    await remote.replaceAll("u1", empty(), meta);
    await remote.deleteAll("u1");
    expect(await remote.load("u1")).toBeNull();
    expect(await remote.savedInfo("u1")).toBeNull();
  });

  it("failListeners stops the account's listeners with the error; nothing more arrives", () => {
    const remote = new FakeRemote();
    const seen = vi.fn();
    const failed = vi.fn();
    remote.subscribe("u1", seen, failed);
    const error = new Error("permission-denied");
    remote.failListeners("u1", error);
    expect(failed).toHaveBeenCalledWith(error);
    remote.push("u1", empty());
    expect(seen).not.toHaveBeenCalled();
  });
});

import { describe, expect, it } from "vitest";
import { tokenBalance } from "../planner/history";
import type { StudiumEvent, Task } from "../planner/types";
import { eventId, type UserRecord } from "./records";
import { dedupeCompletions, liveRecords, mergeRecords, type Stamped, type StampedRecords } from "./merge";

const ZERO = { base: 0, unblockBonus: 0, neglectBonus: 0, finish: 0, dailyCurve: 1, sickMultiplier: 1, foodMultiplier: 1 };
const at = (hm: string) => `2026-11-09T${hm}:00.000Z`;

const task = (title: string): Task => ({
  id: "t1", projectId: "p1", requirementId: null, title, estimateMin: 5, blockedBy: [], priority: false, done: false, actualMin: null,
  createdAt: at("09:00"),
});
const stamp = <T,>(value: T, hm: string): Stamped<T> => ({ updatedAt: at(hm), deleted: false, value });
const gone = <T,>(hm: string): Stamped<T> => ({ updatedAt: at(hm), deleted: true, value: null });

const user: UserRecord = {
  startingTokens: 100,
  defaultBeds: false,
  today: { date: "2026-11-09", taskIds: [] },
  settings: { nickname: "A", petInvolvement: "mild", petOrder: "project" },
};
const empty = (): StampedRecords => ({ user: stamp(user, "09:00"), projects: {}, requirements: {}, tasks: {}, events: {} });
const withTask = (s: Stamped<Task>): StampedRecords => ({ ...empty(), tasks: { t1: s } });

const completed = (hm: string, tokens = 10): StudiumEvent => ({
  type: "task_completed", at: at(hm), taskId: "t1", actualMin: 5, tokens, breakdown: ZERO,
});
const reopened = (hm: string): StudiumEvent => ({ type: "task_reopened", at: at(hm), taskId: "t1" });
const eventsOf = (...es: StudiumEvent[]): StampedRecords["events"] => Object.fromEntries(es.map((e) => [eventId(e), e]));

describe("mergeRecords", () => {
  it("a later local edit beats an older remote one that arrives after it", () => {
    const { merged, pushToRemote } = mergeRecords(withTask(stamp(task("B"), "10:05")), withTask(stamp(task("A"), "10:00")));
    expect(merged.tasks.t1.value?.title).toBe("B");
    expect(pushToRemote).toContain("task:t1");
  });

  it("a later remote edit wins", () => {
    const { merged, pushToRemote } = mergeRecords(withTask(stamp(task("A"), "10:00")), withTask(stamp(task("B"), "10:05")));
    expect(merged.tasks.t1.value?.title).toBe("B");
    expect(pushToRemote).toEqual([]);
  });

  it("on a tie, remote wins and nothing is pushed", () => {
    const { merged, pushToRemote } = mergeRecords(withTask(stamp(task("L"), "10:00")), withTask(stamp(task("R"), "10:00")));
    expect(merged.tasks.t1.value?.title).toBe("R");
    expect(pushToRemote).toEqual([]);
  });

  it("a delete beats an edit, even an older delete", () => {
    const { merged, pushToRemote } = mergeRecords(withTask(gone("10:00")), withTask(stamp(task("A"), "10:05")));
    expect(merged.tasks.t1.deleted).toBe(true);
    expect(merged.tasks.t1.value).toBeNull();
    expect(merged.tasks.t1.updatedAt).toBe(at("10:05"));
    expect(pushToRemote).toContain("task:t1");
  });

  it("a remote delete beats a local edit and is not pushed", () => {
    const { merged, pushToRemote } = mergeRecords(withTask(stamp(task("A"), "10:05")), withTask(gone("10:00")));
    expect(merged.tasks.t1.deleted).toBe(true);
    expect(merged.tasks.t1.updatedAt).toBe(at("10:05"));
    expect(pushToRemote).toEqual([]);
  });

  it("a record only one side has is kept and, if local, pushed", () => {
    const local = withTask(stamp(task("L"), "10:00"));
    const a = mergeRecords(local, empty());
    expect(a.merged.tasks.t1.value?.title).toBe("L");
    expect(a.pushToRemote).toEqual(["task:t1"]);
    const b = mergeRecords(empty(), local);
    expect(b.merged.tasks.t1.value?.title).toBe("L");
    expect(b.pushToRemote).toEqual([]);
  });

  it("the user record merges like any other stamped record", () => {
    const local = { ...empty(), user: stamp({ ...user, defaultBeds: true }, "11:00") };
    const { merged, pushToRemote } = mergeRecords(local, empty());
    expect(merged.user.value?.defaultBeds).toBe(true);
    expect(pushToRemote).toEqual(["user"]);
  });

  it("events from both sides are combined, and local-only ones are pushed", () => {
    const a = completed("10:00");
    const b = completed("11:00", 20);
    const shared = reopened("10:30");
    const local = { ...empty(), events: eventsOf(a, shared) };
    const remote = { ...empty(), events: eventsOf(b, shared) };
    const { merged, pushToRemote } = mergeRecords(local, remote);
    expect(Object.keys(merged.events).sort()).toEqual([eventId(a), eventId(b), eventId(shared)].sort());
    expect(pushToRemote).toEqual([`event:${eventId(a)}`]);
  });
});

describe("dedupeCompletions", () => {
  it("the same task completed on two devices offline pays once", () => {
    const events = [completed("10:00"), completed("10:02")];
    expect(dedupeCompletions(events)).toEqual([events[0]]);
    expect(tokenBalance({ events, startingTokens: 0 })).toBe(20);
    expect(tokenBalance({ events: dedupeCompletions(events), startingTokens: 0 })).toBe(10);
  });

  it("complete, reopen, complete keeps both completions", () => {
    const events = [completed("10:00"), reopened("10:01"), completed("10:02")];
    expect(dedupeCompletions(events)).toEqual(events);
  });

  it("sorts by time and keeps other events", () => {
    const events = [completed("10:02"), completed("10:00")];
    expect(dedupeCompletions(events)).toEqual([events[1]]);
  });
});

describe("liveRecords", () => {
  it("drops deleted records and dedupes completions without touching the raw events", () => {
    const s: StampedRecords = {
      ...empty(),
      tasks: { t1: stamp(task("A"), "10:00"), t2: gone("10:00") },
      events: eventsOf(completed("10:00"), completed("10:02")),
    };
    const live = liveRecords(s);
    expect(Object.keys(live.tasks)).toEqual(["t1"]);
    expect(Object.values(live.events)).toHaveLength(1);
    expect(Object.keys(s.events)).toHaveLength(2);
    expect(live.user).toEqual(user);
  });

  it("a task's done and actualMin follow its latest completion or reopen, not a stale record", () => {
    const s = (...es: StudiumEvent[]): StampedRecords => ({ ...empty(), tasks: { t1: stamp(task("Renamed later"), "11:00") }, events: eventsOf(...es) });
    expect(liveRecords(s(completed("10:00"))).tasks.t1).toMatchObject({ title: "Renamed later", done: true, actualMin: 5 });
    expect(liveRecords(s(completed("10:00"), reopened("10:30"))).tasks.t1).toMatchObject({ done: false, actualMin: null });
    const doneRecord: StampedRecords = { ...s(completed("10:00"), reopened("10:30")), tasks: { t1: stamp({ ...task("A"), done: true, actualMin: 5 }, "11:00") } };
    expect(liveRecords(doneRecord).tasks.t1).toMatchObject({ done: false, actualMin: null });
    expect(liveRecords(s()).tasks.t1).toMatchObject({ done: false, actualMin: null }); // no events: the record stands
  });
});

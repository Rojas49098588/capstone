import { describe, expect, it } from "vitest";
import { NOW } from "../planner/testData";
import type { StudiumData, StudiumEvent } from "../planner/types";
import { buildSeed } from "../store/seed";
import { normalizeData } from "../store/storage";
import { eventId, eventProject, fromRecords, recordHashes, toRecords, type SyncedSettings } from "./records";

const settings: SyncedSettings = { nickname: "Abby", petInvolvement: "mild", petOrder: "project" };
const ZERO = { base: 0, unblockBonus: 0, neglectBonus: 0, finish: 0, dailyCurve: 1, sickMultiplier: 1, foodMultiplier: 1 };

describe("eventId", () => {
  it("is the same for the same event and differs when any field differs", () => {
    const a: StudiumEvent = { type: "task_completed", at: "2026-10-14T12:00:00.000Z", taskId: "t1", actualMin: 5, tokens: 3, breakdown: ZERO };
    const b = { breakdown: { ...ZERO }, tokens: 3, actualMin: 5, taskId: "t1", at: "2026-10-14T12:00:00.000Z", type: "task_completed" } as StudiumEvent;
    expect(eventId(a)).toBe(eventId(b));
    expect(eventId({ ...a, at: "2026-10-14T12:00:00.001Z" })).not.toBe(eventId(a));
    expect(eventId({ type: "focus_session", at: "x", id: "abc", projectId: "p1", taskId: null, startedAt: "y", minutes: 1 })).toBe("focus:abc");
  });
});

describe("records", () => {
  it("toRecords then fromRecords gives back the same data", () => {
    const d = buildSeed(NOW);
    const expected = normalizeData(d);
    expected.events = [...expected.events].sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || (eventId(a) < eventId(b) ? -1 : 1));
    const order = <T extends { id: string; createdAt: string }>(xs: T[]) =>
      [...xs].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || (a.id < b.id ? -1 : 1));
    expected.projects = order(expected.projects);
    expected.requirements = order(expected.requirements);
    expected.tasks = order(expected.tasks);
    expect(fromRecords(toRecords(d, settings))).toEqual({ data: expected, settings });
  });

  const small = (): StudiumData => ({
    version: 1,
    projects: [
      {
        id: "p1", name: "P", shortName: "p1", color: "#fff", deadline: "2026-12-01", description: "", petKind: "cat",
        hatchedAt: null, createdAt: "2026-10-01T00:00:00.000Z",
        pets: [{ id: "x1", kind: "dog", stage: "egg", boughtAt: "2026-10-02T00:00:00.000Z", hatchedAt: null, name: null, caresFor: null }],
      },
    ],
    requirements: [],
    tasks: [{ id: "t1", projectId: "p1", requirementId: null, title: "T", estimateMin: 5, blockedBy: [], priority: false, done: false, actualMin: null, createdAt: "2026-10-01T00:00:00.000Z" }],
    events: [],
    today: { date: "2026-10-14", taskIds: [] },
  });

  it("decor is filed under the project its habitat belongs to", () => {
    const d = { ...small(), decor: { x1: { wallpaper: "w" }, ghost: { wallpaper: "g" } } };
    const r = toRecords(d, settings);
    expect(r.projects.p1.decor).toEqual({ x1: { wallpaper: "w" } });
  });

  it("events go to their project, purchases are personal", () => {
    const d = small();
    expect(eventProject({ type: "task_completed", at: "a", taskId: "t1", actualMin: null, tokens: 0, breakdown: ZERO }, d)).toBe("p1");
    expect(eventProject({ type: "fed", at: "a", projectId: "p1", petId: "p1", productId: "f" }, d)).toBe("p1");
    expect(eventProject({ type: "purchase", at: "a", productId: "f", price: 1 }, d)).toBeNull();
  });

  it("a record's hash changes only when the record changes", () => {
    const d = small();
    const before = recordHashes(toRecords(d, settings));
    const d2 = { ...d, tasks: [{ ...d.tasks[0], title: "Changed" }] };
    const after = recordHashes(toRecords(d2, settings));
    expect(after["task:t1"]).not.toBe(before["task:t1"]);
    expect(after["project:p1"]).toBe(before["project:p1"]);
    expect(after.user).toBe(before.user);
  });

  it("fromRecords puts projects, requirements and tasks back in creation order", () => {
    const d = small();
    const p2 = { ...d.projects[0], id: "p0", createdAt: "2026-10-05T00:00:00.000Z", pets: undefined };
    const t2 = { ...d.tasks[0], id: "t0", createdAt: "2026-10-05T00:00:00.000Z" };
    const r = toRecords({ ...d, projects: [p2, d.projects[0]], tasks: [t2, d.tasks[0]] }, settings);
    const rev = { ...r, projects: Object.fromEntries(Object.entries(r.projects).reverse()), tasks: Object.fromEntries(Object.entries(r.tasks).reverse()) };
    const out = fromRecords(rev).data;
    expect(out.projects.map((p) => p.id)).toEqual(["p1", "p0"]);
    expect(out.tasks.map((t) => t.id)).toEqual(["t1", "t0"]);
  });

  it("round-trips non-default startingTokens, defaultBeds and decor on project and extra-pet habitats", () => {
    const d: StudiumData = { ...small(), startingTokens: 900, defaultBeds: true, decor: { p1: { wallpaper: "a" }, x1: { flooring: "b" } } };
    expect(fromRecords(toRecords(d, settings))).toEqual({ data: d, settings });
  });
});

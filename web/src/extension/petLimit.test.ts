// Tests for "Pets on screen at once" and "Which pets show first" (User Settings) in
// extension/content/logic.js.
import { describe, expect, it } from "vitest";
import "../../../extension/content/logic.js";
import { SETTINGS_EVENT, SETTINGS_KEY } from "../store/settings";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const L = (globalThis as unknown as { PetLogic: any }).PetLogic;

const pets = (...list: [string, string | null][]) => list.map(([projectId, deadline]) => ({ projectId, deadline }));

describe("pets on screen", () => {
  it("uses the same names as Studium", () => {
    expect(L.SETTINGS_KEY).toBe(SETTINGS_KEY);
    expect(L.SETTINGS_EVENT).toBe(SETTINGS_EVENT);
  });

  it("reads the limit and order from Studium's saved settings, replacing anything invalid", () => {
    expect(L.screenFromSettings(JSON.stringify({ petCount: 2, petOrder: "dueDate", difficulty: "easy" }))).toEqual({ limit: 2, order: "dueDate" });
    expect(L.screenFromSettings(JSON.stringify({ petCount: "all" }))).toEqual({ limit: null, order: "project" });
    expect(L.screenFromSettings(JSON.stringify({ petCount: 0, petOrder: "random" }))).toEqual({ limit: null, order: "project" });
    expect(L.screenFromSettings(JSON.stringify({ petCount: 1.5 })).limit).toBeNull();
    expect(L.screenFromSettings("{not json")).toEqual({ limit: null, order: "project" });
    expect(L.screenFromSettings(null)).toEqual({ limit: null, order: "project" });
    expect(L.cleanScreen({ limit: 3, order: "dueDate" })).toEqual({ limit: 3, order: "dueDate" });
    expect(L.cleanScreen({ limit: "3" })).toEqual({ limit: null, order: "project" });
    expect(L.cleanScreen(undefined)).toEqual({ limit: null, order: "project" });
  });

  it("project order: the first pets, skipping away pets", () => {
    const list = pets(["a", "2026-12-01"], ["b", "2026-11-01"], ["c", "2026-10-01"], ["d", null]);
    expect([...L.petsOnScreen(list, {}, { limit: null, order: "project" })]).toEqual(["a", "b", "c", "d"]);
    expect([...L.petsOnScreen(list, {}, { limit: 2, order: "project" })]).toEqual(["a", "b"]);
    expect([...L.petsOnScreen(list, { a: { kind: "nap" } }, { limit: 2, order: "project" })]).toEqual(["b", "c"]);
    expect([...L.petsOnScreen(list, {}, { limit: 10, order: "project" })]).toEqual(["a", "b", "c", "d"]);
  });

  it("closest due date: overdue and soonest first; ties and no due date keep project order", () => {
    const list = pets(["a", "2026-12-01"], ["b", null], ["c", "2026-10-01"], ["d", "2026-11-01"], ["e", "2026-11-01"]);
    expect([...L.petsOnScreen(list, {}, { limit: 3, order: "dueDate" })]).toEqual(["c", "d", "e"]);
    expect([...L.petsOnScreen(list, { c: { kind: "sleep" } }, { limit: 3, order: "dueDate" })]).toEqual(["d", "e", "a"]);
    expect([...L.petsOnScreen(list, {}, { limit: null, order: "dueDate" })]).toEqual(["c", "d", "e", "a", "b"]);
  });

  it("keeps each pet's due date from its status (null from older Studium builds)", () => {
    const base = { projectId: "a", petKind: "cat", mood: "Happy" };
    expect(L.parseStatuses({ pets: [{ ...base, deadline: "2026-11-30" }] }).pets[0].deadline).toBe("2026-11-30");
    expect(L.parseStatuses({ pets: [base] }).pets[0].deadline).toBeNull();
    expect(L.parseStatuses({ pets: [{ ...base, deadline: "soon" }] }).pets[0].deadline).toBeNull();
  });
});

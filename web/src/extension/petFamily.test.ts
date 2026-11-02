// Several pets per project (pet family spec, Part 2): the pet rules key pets by pet id, and keep the
// project id only where a project is meant (focus sessions, Studium links).
import { describe, expect, it } from "vitest";
import "../../../extension/content/logic.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const L = (globalThis as unknown as { PetLogic: any }).PetLogic;

const T = Date.parse("2026-10-19T12:00:00.000Z");
const MIN = 60_000;
const iso = (ms: number) => new Date(ms).toISOString();

const pet = (o: Record<string, unknown> = {}) => ({
  projectId: "p1",
  petId: "p1",
  shortName: "proj",
  name: "Project",
  color: "#2d3a8c",
  petKind: "cat",
  mood: "Happy",
  ...o,
});
const family = () => L.parseStatuses({ pets: [pet(), pet({ petId: "x1", shortName: "Frog", petKind: "frog" })] });

let ids = 0;
const ctx = (now = T, statuses = family()) => ({ now, statuses, napMinutes: 15, newId: () => `n${++ids}` });
const empty = () => ({ petAway: {}, focusOutbox: {}, petCheckIn: null });

describe("statuses keyed by pet id", () => {
  it("keeps two pets of one project, and fills a missing pet id with the project id", () => {
    expect(family().pets.map((p: { petId: string; projectId: string }) => [p.petId, p.projectId])).toEqual([
      ["p1", "p1"],
      ["x1", "p1"],
    ]);
    expect(L.parseStatuses({ pets: [pet({ petId: undefined })] }).pets[0].petId).toBe("p1");
  });
});

describe("requests carry a pet id", () => {
  it("reads petId, or projectId from older callers", () => {
    expect(L.parseRequest({ type: "nap", projectId: "p1", taskId: null })).toEqual({ type: "nap", petId: "p1", taskId: null });
    expect(L.parseRequest({ type: "nap", petId: "x1", taskId: null })).toEqual({ type: "nap", petId: "x1", taskId: null });
    expect(L.parseRequest({ type: "wake", petId: "x1" })).toEqual({ type: "wake", petId: "x1" });
    expect(L.parseRequest({ type: "openProject", petId: "x1" })).toEqual({ type: "openProject", petId: "x1" });
    expect(L.parseRequest({ type: "sleep", petId: "x1", hours: 1 })).toEqual({ type: "sleep", petId: "x1", hours: 1 });
  });
});

describe("a bought pet's nap", () => {
  it("records its focus session and check-in under its project", () => {
    const napped = L.applyAwayRequest(empty(), { type: "nap", petId: "x1", taskId: null }, ctx());
    expect(napped.state.petAway.x1).toMatchObject({ kind: "nap", projectId: "p1" });
    const ended = L.applyAwayRequest(napped.state, { type: "end", petId: "x1" }, ctx(T + 15 * MIN));
    const [session] = Object.values(ended.state.focusOutbox) as { projectId: string }[];
    expect(session.projectId).toBe("p1");
    expect(ended.state.petCheckIn).toMatchObject({ petId: "x1", projectId: "p1" });
  });

  it("blocks a nap for another pet (one nap at a time)", () => {
    const napped = L.applyAwayRequest(empty(), { type: "nap", petId: "x1", taskId: null }, ctx());
    expect(L.applyAwayRequest(napped.state, { type: "nap", petId: "p1", taskId: null }, ctx()).changed).toBe(false);
  });

  it("ends cleanly when the pet is gone, with its saved project", () => {
    const napped = L.applyAwayRequest(empty(), { type: "nap", petId: "x1", taskId: null }, ctx());
    const gone = L.parseStatuses({ pets: [pet()] });
    const ended = L.applyAwayRequest(napped.state, { type: "endOverdue" }, ctx(T + 20 * MIN, gone));
    const [session] = Object.values(ended.state.focusOutbox) as { projectId: string }[];
    expect(session.projectId).toBe("p1");
    expect(ended.state.petAway).toEqual({});
  });
});

describe("state saved by 0.6.0", () => {
  it("an old nap (keyed by project, no projectId) still records under its project", () => {
    const old = { kind: "nap", id: "n0", startedAt: iso(T), until: iso(T + 15 * MIN), taskId: null, taskTitle: null };
    const state = { ...empty(), petAway: L.parseAway({ p1: old }, T) };
    const ended = L.applyAwayRequest(state, { type: "end", petId: "p1" }, ctx(T + 15 * MIN));
    expect((Object.values(ended.state.focusOutbox)[0] as { projectId: string }).projectId).toBe("p1");
  });

  it("an old check-in without a pet id belongs to the project's first pet", () => {
    const c = L.parseCheckIn({ projectId: "p1", taskId: null, taskTitle: null, minutes: 15, at: iso(T) });
    expect(c).toMatchObject({ petId: "p1", projectId: "p1" });
  });
});

describe("links to a pet's habitat", () => {
  it("adds the pet only when it isn't the first", () => {
    expect(L.projectLink("p 1", "x1")).toBe("project=p%201&pet=x1");
    expect(L.projectLink("p1", "p1")).toBe("project=p1");
  });

  it("Done on a check-in without a task opens the pet's habitat", () => {
    const state = { ...empty(), petCheckIn: { petId: "x1", projectId: "p1", taskId: null, taskTitle: null, minutes: 15, at: iso(T) } };
    expect(L.applyAwayRequest(state, { type: "checkIn", answer: "done" }, ctx()).effects).toEqual([{ type: "open", hash: "project=p1&pet=x1" }]);
  });
});

describe("which pets show", () => {
  const pets = family().pets;

  it("the overlay leaves out every pet whose habitat shows in Studium", () => {
    const shown = L.shownPets({ surface: "overlay", pets, petAway: {}, screen: null, boxIds: [], liveHabitats: ["p1", "x1"] });
    expect([...shown]).toEqual([]);
  });

  it("the Studium window shows the pet of every box on the page", () => {
    const shown = L.shownPets({ surface: "habitat", pets, petAway: {}, screen: null, boxIds: ["p1", "x1"], liveHabitats: [] });
    expect([...shown]).toEqual(["p1", "x1"]);
  });

  it("counts bought pets toward the limit", () => {
    expect([...L.petsOnScreen(pets, {}, { limit: 1, order: "project" })]).toEqual(["p1"]);
  });
});

describe("menus, notes and mischief by pet", () => {
  it("names a pet that's gone in the wake menu", () => {
    expect(L.wakeMenuEntries({ ghost: {} }, family())).toEqual([{ id: "wake:ghost", title: "Wake your pet" }]);
    expect(L.wakeMenuEntries({ x1: {} }, family())).toEqual([{ id: "wake:x1", title: "Wake Frog" }]);
  });

  it("opens a sick bought pet's project at its habitat", () => {
    const statuses = L.parseStatuses({ pets: [pet(), pet({ petId: "x1", mood: "Sick" })] }).pets;
    const choice = L.chooseOpenProject({
      statuses,
      prefs: { involvement: "moderate" },
      petAway: {},
      checkIn: null,
      hidden: false,
      now: T,
      lastOpenAt: 0,
      studiumSeenAt: 0,
      timing: { openGapMs: 1, studiumRecentMs: 1 },
    });
    expect(choice).toEqual({ projectId: "p1", petId: "x1" });
  });

  it("celebrations are seen per pet", () => {
    const at = iso(T);
    const statuses = L.parseStatuses({ pets: [pet({ celebration: { at, kind: "task" } }), pet({ petId: "x1", celebration: { at, kind: "task" } })] });
    const r = L.newCelebrations({ p1: iso(T - MIN) }, statuses);
    expect(r.seen).toEqual({ p1: at, x1: at });
    expect(r.celebrate).toEqual([
      { petId: "p1", kind: "task" },
      { petId: "x1", kind: "task" },
    ]);
  });
});

// Tests for the pet interaction rules in extension/content/logic.js: naps, sleep, check-ins,
// the focus outbox, the pet menu and celebrations.
import { describe, expect, it } from "vitest";
import "../../../extension/content/logic.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const L = (globalThis as unknown as { PetLogic: any }).PetLogic;

const T = Date.parse("2026-10-19T12:00:00.000Z");
const MIN = 60_000;
const iso = (ms: number) => new Date(ms).toISOString();

const pet = (o: Record<string, unknown> = {}) => ({
  projectId: "webDev",
  shortName: "webDev",
  name: "Web Development Portfolio",
  color: "#2d3a8c",
  petKind: "pigeon",
  mood: "Happy",
  recovering: false,
  idleRequirement: null,
  ...o,
});

const statuses = (appDevSuggestion: unknown = { taskId: "t1", title: "Push", estimateMin: 30 }) =>
  L.parseStatuses({
    pets: [pet(), pet({ projectId: "appDev", shortName: "appDev", petKind: "dog", suggestion: appDevSuggestion })],
  });

let ids = 0;
const ctx = (now = T, s = statuses()) => ({ now, statuses: s, napMinutes: 15, newId: () => `n${++ids}` });
type State = { petAway: Record<string, unknown>; focusOutbox: Record<string, unknown>; petCheckIn: unknown };
const empty = (): State => ({ petAway: {}, focusOutbox: {}, petCheckIn: null });

const napEntry = (o: Record<string, unknown> = {}) => ({
  kind: "nap",
  id: "n0",
  startedAt: iso(T),
  until: iso(T + 15 * MIN),
  taskId: "t1",
  taskTitle: "Push",
  ...o,
});

describe("statuses with suggestions and celebrations", () => {
  it("reads suggestion and celebration", () => {
    const s = L.parseStatuses({
      pets: [pet({ suggestion: { taskId: "t1", title: "Push", estimateMin: 30 }, celebration: { at: iso(T), kind: "firstTask" } })],
    });
    expect(s.pets[0].suggestion).toEqual({ taskId: "t1", title: "Push", estimateMin: 30 });
    expect(s.pets[0].celebration).toEqual({ at: iso(T), kind: "firstTask" });
  });

  it("treats missing or damaged ones as null", () => {
    expect(L.parseStatuses({ pets: [pet()] }).pets[0]).toMatchObject({ suggestion: null, celebration: null });
    const s = L.parseStatuses({
      pets: [pet({ suggestion: { title: 5 }, celebration: { at: iso(T), kind: "party" } })],
    });
    expect(s.pets[0]).toMatchObject({ suggestion: null, celebration: null });
    expect(L.parseStatuses({ pets: [pet({ suggestion: { taskId: "t", title: "x", estimateMin: 0 } })] }).pets[0].suggestion).toBeNull();
  });

  it("statusesEqual ignores suggestion and celebration", () => {
    const a = L.parseStatuses({ pets: [pet()] });
    const b = L.parseStatuses({
      pets: [pet({ suggestion: { taskId: "t1", title: "Push", estimateMin: 30 }, celebration: { at: iso(T), kind: "task" } })],
    });
    expect(L.statusesEqual(a, b)).toBe(true);
    expect(L.statusesEqual(a, L.parseStatuses({ pets: [pet({ mood: "Sick" })] }))).toBe(false);
  });
});

describe("validators", () => {
  it("parseAway drops damaged entries and ones more than 2 hours ahead", () => {
    const raw = {
      good: napEntry(),
      atLimit: napEntry({ kind: "sleep", until: iso(T + 120 * MIN), taskId: null, taskTitle: null }),
      tooFar: napEntry({ kind: "sleep", until: iso(T + 120 * MIN + 1000) }),
      coma: napEntry({ kind: "coma" }),
      badTime: napEntry({ until: "x" }),
      backwards: napEntry({ until: iso(T - MIN) }),
      noId: napEntry({ id: 3 }),
    };
    expect(Object.keys(L.parseAway(raw, T)).sort()).toEqual(["atLimit", "good"]);
    expect(L.parseAway(raw, T).good).toEqual(napEntry());
    expect(L.parseAway("nope", T)).toEqual({});
    expect(L.parseAway(null, T)).toEqual({});
  });

  it("parseOutbox keeps valid sessions keyed by their id", () => {
    const s = { id: "a", projectId: "webDev", taskId: null, startedAt: iso(T), at: iso(T + MIN), minutes: 1 };
    const out = L.parseOutbox({ a: s, b: { ...s, id: "b", minutes: -1 }, c: { ...s, id: "other" }, d: "x" });
    expect(out).toEqual({ a: s });
    expect(L.parseOutbox([])).toEqual({});
  });

  it("parseCheckIn returns null for damaged input", () => {
    const c = { projectId: "appDev", taskId: "t1", taskTitle: "Push", minutes: 9, at: iso(T) };
    expect(L.parseCheckIn(c)).toEqual(c);
    expect(L.parseCheckIn({ ...c, taskId: null, taskTitle: null })).toEqual({ ...c, taskId: null, taskTitle: null });
    expect(L.parseCheckIn({ ...c, projectId: "" })).toBeNull();
    expect(L.parseCheckIn({ ...c, minutes: "9" })).toBeNull();
    expect(L.parseCheckIn(null)).toBeNull();
  });

  it("napMinutesFrom only accepts shorter naps (for the browser check)", () => {
    expect(L.napMinutesFrom({ napMinutes: 0.5 })).toBe(0.5);
    for (const bad of [{ napMinutes: 0 }, { napMinutes: 99 }, { napMinutes: "1" }, undefined, null]) {
      expect(L.napMinutesFrom(bad)).toBe(15);
    }
  });

  it("parseRequest accepts the worker's messages only", () => {
    const good = [
      { type: "nap", projectId: "a" },
      { type: "sleep", projectId: "a", hours: 1 },
      { type: "sleep", projectId: "a", hours: 2 },
      { type: "wake", projectId: "a" },
      { type: "checkIn", answer: "done" },
      { type: "checkIn", answer: "notYet" },
      { type: "checkIn", answer: "later" },
      { type: "openProject", projectId: "a" },
      { type: "delivered", ids: ["a"] },
    ];
    for (const m of good) expect(L.parseRequest({ ...m, extra: 1 })).toEqual(m);
    const bad = [
      { type: "sleep", projectId: "a", hours: 3 },
      { type: "nap" },
      { type: "nap", projectId: "" },
      { type: "checkIn", answer: "maybe" },
      { type: "delivered", ids: [1] },
      { type: "end", projectId: "a" }, // only the worker's own alarms end a pet
      { type: "dance" },
      null,
      "nap",
    ];
    for (const m of bad) expect(L.parseRequest(m)).toBeNull();
  });
});

describe("applyAwayRequest", () => {
  const nap = (state: State = empty(), c = ctx()) => L.applyAwayRequest(state, { type: "nap", projectId: "appDev" }, c);

  it("nap stores the pet's suggested task and sets an alarm", () => {
    const r = nap(empty(), { ...ctx(), newId: () => "n1" });
    expect(r.changed).toBe(true);
    expect(r.state.petAway.appDev).toEqual({
      kind: "nap",
      id: "n1",
      startedAt: iso(T),
      until: iso(T + 15 * MIN),
      taskId: "t1",
      taskTitle: "Push",
    });
    expect(r.effects).toEqual([{ type: "setAlarm", name: "away:appDev", when: T + 15 * MIN }]);
  });

  it("nap has no task when there is nothing to suggest", () => {
    const r = nap(empty(), ctx(T, statuses(null)));
    expect(r.state.petAway.appDev).toMatchObject({ taskId: null, taskTitle: null });
  });

  it("nap is refused while another pet naps, for a pet already away, and for an unknown pet", () => {
    const napping = { ...empty(), petAway: { webDev: napEntry() } };
    expect(nap(napping)).toMatchObject({ changed: false, effects: [] });
    const sleeping = { ...empty(), petAway: { appDev: napEntry({ kind: "sleep" }) } };
    expect(nap(sleeping).changed).toBe(false);
    expect(L.applyAwayRequest(empty(), { type: "nap", projectId: "nope" }, ctx()).changed).toBe(false);
  });

  it("sleep lasts 1 or 2 hours with no task, even while another pet naps", () => {
    const napping = { ...empty(), petAway: { webDev: napEntry() } };
    const r = L.applyAwayRequest(napping, { type: "sleep", projectId: "appDev", hours: 2 }, ctx());
    expect(r.state.petAway.appDev).toMatchObject({ kind: "sleep", until: iso(T + 120 * MIN), taskId: null, taskTitle: null });
    expect(r.effects).toEqual([{ type: "setAlarm", name: "away:appDev", when: T + 120 * MIN }]);
    expect(L.applyAwayRequest(empty(), { type: "sleep", projectId: "appDev", hours: 1 }, ctx()).state.petAway.appDev.until).toBe(
      iso(T + 60 * MIN),
    );
  });

  it("waking a nap records a session and asks for a check-in", () => {
    const started = nap(empty(), { ...ctx(), newId: () => "n1" }).state;
    const now = T + 9 * MIN + 50_000;
    const r = L.applyAwayRequest(started, { type: "wake", projectId: "appDev" }, ctx(now));
    expect(r.state.petAway).toEqual({});
    expect(r.state.focusOutbox).toEqual({
      n1: { id: "n1", projectId: "appDev", taskId: "t1", startedAt: iso(T), at: iso(now), minutes: 9 },
    });
    expect(r.state.petCheckIn).toEqual({ projectId: "appDev", taskId: "t1", taskTitle: "Push", minutes: 9, at: iso(now) });
    expect(r.effects).toEqual([{ type: "clearAlarm", name: "away:appDev" }]);
  });

  it("the alarm ends a nap the same way", () => {
    const started = nap().state;
    const r = L.applyAwayRequest(started, { type: "end", projectId: "appDev" }, ctx(T + 15 * MIN));
    expect(Object.values(r.state.focusOutbox)).toMatchObject([{ minutes: 15 }]);
  });

  it("waking a sleeping pet records nothing", () => {
    const started = L.applyAwayRequest(empty(), { type: "sleep", projectId: "appDev", hours: 1 }, ctx()).state;
    const r = L.applyAwayRequest(started, { type: "wake", projectId: "appDev" }, ctx(T + 30 * MIN));
    expect(r.state).toEqual(empty());
    expect(r.effects).toEqual([{ type: "clearAlarm", name: "away:appDev" }]);
  });

  it("ending a pet that isn't away changes nothing", () => {
    const once = L.applyAwayRequest(nap().state, { type: "wake", projectId: "appDev" }, ctx(T + 5 * MIN)).state;
    const twice = L.applyAwayRequest(once, { type: "wake", projectId: "appDev" }, ctx(T + 6 * MIN));
    expect(twice.changed).toBe(false);
    expect(twice.state).toBe(once);
    expect(Object.keys(twice.state.focusOutbox)).toHaveLength(1);
  });

  it("endOverdue ends late naps with at most their planned minutes, and re-arms the others", () => {
    const state = {
      ...empty(),
      petAway: {
        appDev: napEntry(),
        webDev: napEntry({ kind: "sleep", startedAt: iso(T + 240 * MIN), until: iso(T + 360 * MIN), taskId: null, taskTitle: null }),
      },
    };
    const r = L.applyAwayRequest(state, { type: "endOverdue" }, ctx(T + 300 * MIN));
    expect(Object.values(r.state.focusOutbox)).toMatchObject([{ projectId: "appDev", minutes: 15 }]);
    expect(Object.keys(r.state.petAway)).toEqual(["webDev"]);
    expect(r.effects).toContainEqual({ type: "clearAlarm", name: "away:appDev" });
    expect(r.effects).toContainEqual({ type: "setAlarm", name: "away:webDev", when: T + 360 * MIN });
  });

  describe("check-in answers", () => {
    const checkIn = (o: Record<string, unknown> = {}) => ({
      ...empty(),
      petCheckIn: { projectId: "appDev", taskId: "t1", taskTitle: "Push", minutes: 9, at: iso(T), ...o },
    });
    const answer = (state: unknown, a: string, c = ctx()) => L.applyAwayRequest(state, { type: "checkIn", answer: a }, c);

    it("Later clears it", () => {
      expect(answer(checkIn(), "later")).toMatchObject({ changed: true, state: { petCheckIn: null }, effects: [] });
    });

    it("Done clears it and opens the completion prompt, or the project without a task", () => {
      expect(answer(checkIn(), "done")).toMatchObject({ state: { petCheckIn: null }, effects: [{ type: "open", hash: "complete=t1" }] });
      expect(answer(checkIn({ taskId: null, taskTitle: null }), "done").effects).toEqual([{ type: "open", hash: "project=appDev" }]);
      expect(answer(checkIn({ taskId: "a b" }), "done").effects).toEqual([{ type: "open", hash: "complete=a%20b" }]);
    });

    it("Not yet starts a new nap on the same task", () => {
      const r = answer(checkIn(), "notYet", ctx(T, statuses({ taskId: "t2", title: "Other", estimateMin: 15 })));
      expect(r.state.petCheckIn).toBeNull();
      expect(r.state.petAway.appDev).toMatchObject({ kind: "nap", taskId: "t1", taskTitle: "Push" });
      expect(r.effects).toEqual([{ type: "setAlarm", name: "away:appDev", when: T + 15 * MIN }]);
    });

    it("does nothing without a check-in", () => {
      expect(answer(empty(), "done").changed).toBe(false);
    });

    it("a new nap on the same pet replaces its check-in, but not another pet's", () => {
      expect(nap(checkIn()).state.petCheckIn).toBeNull();
      expect(nap(checkIn({ projectId: "webDev" })).state.petCheckIn).not.toBeNull();
    });
  });

  it("delivered removes those sessions from the outbox", () => {
    const s = { projectId: "webDev", taskId: null, startedAt: iso(T), at: iso(T), minutes: 1 };
    const state = { ...empty(), focusOutbox: { a: { ...s, id: "a" }, b: { ...s, id: "b" } } };
    const r = L.applyAwayRequest(state, { type: "delivered", ids: ["a", "zz"] }, ctx());
    expect(Object.keys(r.state.focusOutbox)).toEqual(["b"]);
    expect(L.applyAwayRequest(state, { type: "delivered", ids: ["zz"] }, ctx()).changed).toBe(false);
  });

  it("doesn't change the state it was given", () => {
    const state = {
      petAway: { appDev: napEntry() },
      focusOutbox: { x: { id: "x", projectId: "webDev", taskId: null, startedAt: iso(T), at: iso(T), minutes: 1 } },
      petCheckIn: { projectId: "webDev", taskId: null, taskTitle: null, minutes: 1, at: iso(T) },
    };
    const snapshot = JSON.parse(JSON.stringify(state));
    for (const req of [
      { type: "wake", projectId: "appDev" },
      { type: "sleep", projectId: "webDev", hours: 1 },
      { type: "checkIn", answer: "later" },
      { type: "delivered", ids: ["x"] },
      { type: "endOverdue" },
    ]) {
      L.applyAwayRequest(state, req, ctx(T + 20 * MIN));
    }
    expect(state).toEqual(snapshot);
  });
});

describe("menus", () => {
  it("petMenuItems for a pet at home", () => {
    const items = L.petMenuItems("appDev", {}, statuses());
    expect(items.map((i: { label: string }) => i.label)).toEqual(["What should I work on?", "Nap (15 min)", "Sleep", "Open project"]);
    expect(items.map((i: { id: string }) => i.id)).toEqual(["suggest", "nap", "sleep", "open"]);
    expect(items[1].disabled).toBeFalsy();
    expect(items[2].children).toEqual([
      { id: "sleep1", label: "1 hour" },
      { id: "sleep2", label: "2 hours" },
    ]);
  });

  it("Nap is disabled while another pet naps, naming what it focuses on", () => {
    const withTask = L.petMenuItems("appDev", { webDev: napEntry() }, statuses())[1];
    expect(withTask).toMatchObject({ id: "nap", disabled: true, hint: "Already focusing on Push" });
    const noTask = L.petMenuItems("appDev", { webDev: napEntry({ taskId: null, taskTitle: null }) }, statuses())[1];
    expect(noTask.hint).toBe("Already focusing on webDev");
    // A sleeping pet doesn't block naps.
    expect(L.petMenuItems("appDev", { webDev: napEntry({ kind: "sleep" }) }, statuses())[1].disabled).toBeFalsy();
  });

  it("an away pet offers only Wake and Open project", () => {
    const items = L.petMenuItems("webDev", { webDev: napEntry() }, statuses());
    expect(items).toEqual([
      { id: "wake", label: "Wake" },
      { id: "open", label: "Open project" },
    ]);
  });

  it("wakeMenuEntries lists one Wake item per away pet", () => {
    expect(L.wakeMenuEntries({ appDev: napEntry(), gone: napEntry() }, statuses())).toEqual([
      { id: "wake:appDev", title: "Wake appDev" },
      { id: "wake:gone", title: "Wake gone" },
    ]);
    expect(L.wakeMenuEntries({}, statuses())).toEqual([]);
  });

  it("menuPosition keeps the menu inside the window", () => {
    const size = { width: 180, height: 160 };
    const viewport = { width: 800, height: 600 };
    expect(L.menuPosition({ x: 790, y: 590 }, size, viewport)).toEqual({ left: 612, top: 430 });
    expect(L.menuPosition({ x: 5, y: 5 }, size, viewport)).toEqual({ left: 8, top: 8 });
    expect(L.menuPosition({ x: 300, y: 200 }, size, viewport)).toEqual({ left: 300, top: 200 });
  });
});

describe("wording", () => {
  it("formatMinutes matches Studium", () => {
    expect([15, 60, 90, 480].map(L.formatMinutes)).toEqual(["15 min", "1 h", "1 h 30 min", "8 h"]);
  });

  it("suggestionText names the next task", () => {
    expect(L.suggestionText({ taskId: "t1", title: "Push", estimateMin: 30 })).toBe("Next up: Push (~30 min)");
    expect(L.suggestionText({ taskId: "t1", title: "Push", estimateMin: 90 })).toBe("Next up: Push (~1 h 30 min)");
    expect(L.suggestionText(null)).toBe("Nothing to suggest: everything's done or waiting on something.");
  });

  it("checkInPrompt asks about the task, or just how it went", () => {
    expect(L.checkInPrompt({ projectId: "appDev", taskId: "t1", taskTitle: "Push", minutes: 9, at: iso(T) })).toEqual({
      text: "Did you finish Push?",
      buttons: [
        { answer: "done", label: "Done" },
        { answer: "notYet", label: "Not yet" },
        { answer: "later", label: "Later" },
      ],
    });
    expect(L.checkInPrompt({ projectId: "appDev", taskId: null, taskTitle: null, minutes: 9, at: iso(T) })).toEqual({
      text: "Back! How did it go?",
      buttons: [
        { answer: "done", label: "Open project" },
        { answer: "later", label: "OK" },
      ],
    });
  });

  it("celebrations are bigger for a first task and a finished requirement", () => {
    expect(L.celebrationText("task")).toBe("Task done!");
    expect(L.celebrationText("firstTask")).toBe("First task done!");
    expect(L.celebrationText("requirement")).toBe("Requirement finished!");
    expect(L.celebrationText("other")).toBe("Task done!");
    expect(["task", "firstTask", "requirement"].map(L.celebrationHops)).toEqual([1, 2, 2]);
  });

  it("awayAttribute, isQuiet and studiumUrl", () => {
    expect(L.awayAttribute(napEntry())).toBe(`nap:${iso(T + 15 * MIN)}`);
    expect(L.isQuiet({ webDev: napEntry() })).toBe(true);
    expect(L.isQuiet({ webDev: napEntry({ kind: "sleep" }) })).toBe(false);
    expect(L.isQuiet({})).toBe(false);
    expect(L.studiumUrl()).toBe(L.HOMEPAGE_URL);
    expect(L.studiumUrl("project=x")).toBe(`${L.HOMEPAGE_URL}#project=x`);
  });
});

describe("newCelebrations", () => {
  const withCelebration = (at: string | null, kind = "task") =>
    L.parseStatuses({ pets: [pet({ celebration: at ? { at, kind } : null }), pet({ projectId: "appDev" })] });

  it("celebrates nothing from the first statuses a tab sees", () => {
    const r = L.newCelebrations(null, withCelebration(iso(T)));
    expect(r.celebrate).toEqual([]);
    expect(r.seen).toEqual({ webDev: iso(T) });
  });

  it("celebrates a newer completion once", () => {
    const first = L.newCelebrations(null, withCelebration(iso(T)));
    const next = L.newCelebrations(first.seen, withCelebration(iso(T + MIN), "requirement"));
    expect(next.celebrate).toEqual([{ projectId: "webDev", kind: "requirement" }]);
    expect(L.newCelebrations(next.seen, withCelebration(iso(T + MIN), "requirement")).celebrate).toEqual([]);
  });

  it("celebrates a pet's first completion after the tab started", () => {
    const first = L.newCelebrations(null, withCelebration(null));
    const next = L.newCelebrations(first.seen, withCelebration(iso(T), "firstTask"));
    expect(next.celebrate).toEqual([{ projectId: "webDev", kind: "firstTask" }]);
  });

  it("waits for real statuses before remembering anything", () => {
    expect(L.newCelebrations(null, null)).toEqual({ seen: null, celebrate: [] });
  });
});

// Tests for the browser extension's pure helpers (extension/content/logic.js). They live in web/
// because the extension has no build step or node_modules of its own.
import { describe, expect, it } from "vitest";
import "../../../extension/content/logic.js";
import { NICKNAME_MAX } from "../planner/tuning";

// logic.js is a plain browser script that sets globalThis.PetLogic.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const L = (globalThis as unknown as { PetLogic: any }).PetLogic;

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

describe("isStudiumUrl", () => {
  it("matches only Studium's origin", () => {
    expect(L.isStudiumUrl("http://localhost:5173/")).toBe(true);
    expect(L.isStudiumUrl("http://localhost:5173/projects?x=1")).toBe(true);
    expect(L.isStudiumUrl("http://localhost:4173/")).toBe(false);
    expect(L.isStudiumUrl("https://example.com/")).toBe(false);
    expect(L.isStudiumUrl("not a url")).toBe(false);
  });
});

describe("parseStatuses", () => {
  it("reads what Studium publishes", () => {
    const raw = JSON.stringify({
      updatedAt: "2026-10-14T12:00:00.000Z",
      pets: [pet(), pet({ projectId: "appDev", petKind: "dog", mood: "Upset", idleRequirement: { title: "Push", days: 9 } })],
    });
    const s = L.parseStatuses(raw);
    expect(s.updatedAt).toBe("2026-10-14T12:00:00.000Z");
    expect(s.pets.map((p: { projectId: string }) => p.projectId)).toEqual(["webDev", "appDev"]);
    expect(s.pets[1].idleRequirement).toEqual({ title: "Push", days: 9 });
  });

  it("drops pets it can't draw and rejects damaged data", () => {
    const s = L.parseStatuses({ pets: [pet({ petKind: "dragon" }), pet({ mood: "Bored" }), pet({ projectId: "" }), pet(), pet()] });
    expect(s.pets).toHaveLength(1);
    expect(L.parseStatuses("{broken")).toBeNull();
    expect(L.parseStatuses(null)).toBeNull();
    expect(L.parseStatuses({ pets: "nope" })).toBeNull();
  });
});

describe("statusesEqual", () => {
  it("ignores the time stamp", () => {
    const a = { updatedAt: "1", pets: [pet()] };
    expect(L.statusesEqual(a, { updatedAt: "2", pets: [pet()] })).toBe(true);
    expect(L.statusesEqual(a, { updatedAt: "1", pets: [pet({ mood: "Sick" })] })).toBe(false);
    expect(L.statusesEqual(null, null)).toBe(true);
    expect(L.statusesEqual(null, a)).toBe(false);
  });
});

describe("applyMood", () => {
  const dog = { walkSpeed: 60, idleMs: [400, 1800], sound: "Bark!", soundMs: [8000, 20000] };
  const cat = { walkSpeed: 28, idleMs: [3000, 8000], sound: "Meow!", soundMs: [20000, 45000], napChance: 0.4 };
  const pigeon = { walkSpeed: 40, idleMs: [1500, 5000], riseSpeed: 150, flyChance: 0.35, sound: "Coo!", soundMs: [10000, 25000] };
  const frog = { hops: true, jumpSideways: [120, 260], idleMs: [1500, 5000] };
  const turtle = { walkSpeed: 10, idleMs: [3000, 8000] };

  it("leaves a Happy pet as it is", () => {
    expect(L.applyMood(dog, "Happy")).toMatchObject({ ...dog, extraHopChance: 0, tint: false });
  });

  it("speeds up, talks more and hops when Delighted or Proud", () => {
    for (const mood of ["Delighted", "Proud"]) {
      const k = L.applyMood(dog, mood);
      expect(k.walkSpeed).toBeCloseTo(72);
      expect(k.soundMs).toEqual([4000, 10000]);
      expect(k.extraHopChance).toBeGreaterThan(0);
    }
  });

  it("slows down and talks half as often when Worried", () => {
    const k = L.applyMood(dog, "Worried");
    expect(k.walkSpeed).toBeCloseTo(42);
    expect(k.soundMs).toEqual([16000, 40000]);
  });

  it("says … , pauses longer and naps more when Upset", () => {
    const k = L.applyMood(cat, "Upset");
    expect(k.walkSpeed).toBeCloseTo(14);
    expect(k.sound).toEqual(["…", "*sigh*"]);
    expect(k.napChance).toBeCloseTo(0.6);
    expect(k.idleMs[0]).toBeGreaterThan(cat.idleMs[0]);
    expect(L.applyMood(turtle, "Upset").sound).toEqual(["…", "*sigh*"]);
  });

  it("is slow, sneezes, sniffles and coughs, and stays grounded when Sick", () => {
    const k = L.applyMood(cat, "Sick");
    expect(k).toMatchObject({ sound: ["Achoo!", "*sniffle*", "*cough*"], napChance: 0, tint: true });
    expect(k.walkSpeed).toBeCloseTo(8.4);
    expect(k.soundMs[0]).toBeGreaterThanOrEqual(30000);
    expect(L.applyMood(pigeon, "Sick").flyChance).toBe(0);
    expect(L.applyMood(pigeon, "Sick").riseSpeed).toBeCloseTo(45);
    const hop = L.applyMood(frog, "Sick").jumpSideways;
    expect(hop[0]).toBeCloseTo(36);
    expect(hop[1]).toBeCloseTo(78);
  });

  it("doesn't change the kind it was given", () => {
    L.applyMood(dog, "Sick");
    expect(dog.walkSpeed).toBe(60);
    expect(dog.soundMs).toEqual([8000, 20000]);
  });

  it("pickSound picks one of a mood's sounds, or keeps a single one", () => {
    expect(L.pickSound("Meow!")).toBe("Meow!");
    expect(L.pickSound(["Achoo!", "*sniffle*", "*cough*"], () => 0)).toBe("Achoo!");
    expect(L.pickSound(["Achoo!", "*sniffle*", "*cough*"], () => 0.99)).toBe("*cough*");
    expect(L.pickSound(undefined)).toBeUndefined();
  });

  it("treats an unknown mood as Happy", () => {
    expect(L.applyMood(dog, "Confused").walkSpeed).toBe(60);
  });
});

describe("idle requirement message", () => {
  it("names the requirement and waits at least 2 minutes between messages", () => {
    expect(L.idleMessage({ title: "Rigging", days: 9 })).toBe("Haven't seen Rigging in 9 days");
    expect(L.idleMessage(null)).toBeNull();
    expect(L.IDLE_MESSAGE_GAP_MS).toBe(120000);
    expect(L.nextIdleMessageAt(1000, () => 0)).toBe(1000 + L.IDLE_MESSAGE_GAP_MS);
    expect(L.nextIdleMessageAt(1000, () => 0.99)).toBeLessThan(1000 + 2 * L.IDLE_MESSAGE_GAP_MS);
  });
});

describe("habitat geometry", () => {
  const rect = { left: 100, top: 300, right: 500, bottom: 524, width: 400, height: 224 };

  it("turns the box on screen into the pet's world", () => {
    expect(L.windowWorld(1280, 800)).toEqual({ left: 0, bottom: 0, width: 1280, height: 800 });
    expect(L.worldFromRect(rect, 800)).toEqual({ left: 100, bottom: 276, width: 400, height: 224 });
  });

  it("places a dragged pet relative to its world's left wall and floor", () => {
    // In the window this matches the old formula: y = innerHeight - h - (clientY - offY).
    expect(L.dragPosition({ x: 300, y: 700 }, { x: 10, y: 20 }, L.windowWorld(1000, 800), 50, 800)).toEqual({ x: 290, y: 70 });
    // In the box, 200 px from its left wall; y is measured up from the box floor (524 on screen).
    expect(L.dragPosition({ x: 300, y: 450 }, { x: 10, y: 20 }, L.worldFromRect(rect, 800), 50, 800)).toEqual({ x: 190, y: 44 });
  });

  it("clips drawing to the box, with headroom for speech bubbles", () => {
    expect(L.habitatClip(rect, 1000, 800)).toBe("inset(260px 500px 276px 100px)");
    // Scrolled out of view above the window: nothing is left to draw.
    const gone = { left: 100, top: -400, right: 500, bottom: -176, width: 400, height: 224 };
    expect(L.habitatClip(gone, 1000, 800)).toBe("inset(0px 500px 976px 100px)");
  });
});

describe("parseStatuses colors", () => {
  it("only accepts hex colors, so a bad value can't restyle the pet layer", () => {
    const s = L.parseStatuses({
      pets: [
        pet({ projectId: "a", color: "#000;width:100vw;height:100vh" }),
        pet({ projectId: "b", color: "url(https://example.com/t.png)" }),
        pet({ projectId: "c", color: "#C9501A" }),
        pet({ projectId: "d", color: "#abc" }),
      ],
    });
    expect(s.pets.map((p: { color: string }) => p.color)).toEqual(["#2d3a8c", "#2d3a8c", "#C9501A", "#abc"]);
  });
});

describe("parsePositions", () => {
  it("keeps only usable saved positions", () => {
    expect(
      L.parsePositions({ webDev: { xRatio: 0.25 }, appDev: { xRatio: "x" }, petExt: null, Animation: { xRatio: 7 } }),
    ).toEqual({ webDev: { xRatio: 0.25 }, Animation: { xRatio: 1 } });
    expect(L.parsePositions(null)).toEqual({});
    expect(L.parsePositions([1, 2])).toEqual({});
  });
});

describe("pet stages", () => {
  it("draws juveniles at 75% of the adult height", () => {
    expect(L.petHeight(56, "juvenile")).toBe(42);
    expect(L.petHeight(56, "adult")).toBe(56);
  });

  it("treats statuses without a stage, or with an unknown one, as adults", () => {
    expect(L.parseStatuses({ pets: [pet()] }).pets[0].stage).toBe("adult");
    expect(L.parseStatuses({ pets: [pet({ stage: "egg" })] }).pets[0].stage).toBe("adult");
    expect(L.parseStatuses({ pets: [pet({ stage: "juvenile" })] }).pets[0].stage).toBe("juvenile");
  });

  it("rebuilds the pets when only the stage changes", () => {
    const young = L.parseStatuses({ updatedAt: "1", pets: [pet({ stage: "juvenile" })] });
    const old = L.parseStatuses({ updatedAt: "1", pets: [pet()] });
    expect(L.statusesEqual(young, old)).toBe(false);
  });
});

describe("interaction level and nickname", () => {
  it("prefsFromSettings reads the interaction level and nickname", () => {
    expect(L.prefsFromSettings(JSON.stringify({ petInvolvement: "moderate", nickname: " Abby " }))).toEqual({ involvement: "moderate", nickname: "Abby" });
    expect(L.prefsFromSettings(JSON.stringify({ petInvolvement: "notMuch" }))).toEqual({ involvement: "minimal", nickname: "" });
    expect(L.prefsFromSettings(JSON.stringify({ petInvolvement: "very" })).involvement).toBe("mild");
    expect(L.prefsFromSettings(JSON.stringify({ nickname: "A".repeat(25) })).nickname).toBe("A".repeat(20));
    expect(L.prefsFromSettings("{broken")).toEqual({ involvement: "mild", nickname: "" });
    expect(L.prefsFromSettings(null)).toEqual({ involvement: "mild", nickname: "" });
    expect(L.cleanPrefs({ involvement: "wild", nickname: 3 })).toEqual({ involvement: "mild", nickname: "" });
  });

  it("keeps the nickname limit equal to Studium's", () => {
    expect(L.NICKNAME_MAX).toBe(NICKNAME_MAX);
  });

  it("a Minimal pet stays put on web pages but not in its habitat; Mild and Moderate move", () => {
    expect(L.staysPut({ involvement: "minimal", nickname: "" }, false)).toBe(true);
    expect(L.staysPut({ involvement: "minimal", nickname: "" }, true)).toBe(false);
    expect(L.staysPut({ involvement: "mild", nickname: "" }, false)).toBe(false);
    expect(L.staysPut({ involvement: "moderate", nickname: "" }, false)).toBe(false);
    expect(L.staysPut(undefined, false)).toBe(false); // older storage: Mild
  });
});

describe("sticky notes (Moderate)", () => {
  const status = (o: Record<string, unknown> = {}) => pet({ shortName: "portraits", projectId: "p", idleRequirement: null, deadline: null, ...o });
  const today = "2026-10-28";

  it("writesNotes: a Moderate pet on a web page writes notes instead of chatting; in its habitat it chats", () => {
    expect(L.writesNotes({ involvement: "moderate", nickname: "" }, false)).toBe(true);
    expect(L.writesNotes({ involvement: "moderate", nickname: "" }, true)).toBe(false);
    expect(L.writesNotes({ involvement: "mild", nickname: "" }, false)).toBe(false);
    expect(L.writesNotes(undefined, false)).toBe(false);
  });

  it("noteGapMs: the worse the mood, the more often", () => {
    const min = 60_000;
    expect(L.noteGapMs("Proud")).toBe(60 * min);
    expect(L.noteGapMs("Delighted")).toBe(60 * min);
    expect(L.noteGapMs("Happy")).toBe(60 * min);
    expect(L.noteGapMs("Worried")).toBe(30 * min);
    expect(L.noteGapMs("Upset")).toBe(15 * min);
    expect(L.noteGapMs("Sick")).toBe(10 * min);
    expect(L.noteGapMs("Confused")).toBe(60 * min);
  });

  it("noteText: a sick pet says it feels unwell or needs medicine, before anything else", () => {
    const sick = status({ mood: "Sick", idleRequirement: { title: "x", days: 5 }, deadline: "2026-10-29" });
    const lines = [0, 0.3, 0.6, 0.99].map((r) => L.noteText(sick, "Abby", today, () => r));
    expect(new Set(lines).size).toBe(4);
    for (const line of lines) expect(line).toMatch(/^(\*\w+\* )?Abby, I/); // in the pet's own voice
    expect(lines.some((l) => /medicine/.test(l))).toBe(true);
    expect(lines.some((l) => /\*cough\*|\*sniffle\*|\*achoo\*/.test(l))).toBe(true);
    expect(L.noteText(status({ mood: "Sick" }), "", today, () => 0)).toMatch(/^I /);
  });

  it("noteText: an upset or worried pet always has something to say", () => {
    expect(L.noteText(status({ mood: "Upset" }), "Abby", today, () => 0)).toMatch(/^Abby, I'm upset/);
    expect(L.noteText(status({ mood: "Worried" }), "", today, () => 0)).toMatch(/^I'm getting worried/);
    // A reason to write still comes first.
    expect(L.noteText(status({ mood: "Upset", deadline: "2026-10-29" }), "", today)).toBe("We're due tomorrow.");
  });

  it("noteText prefers an idle requirement, then a near deadline", () => {
    const idle = status({ idleRequirement: { title: "Base colors", days: 5 }, deadline: "2026-10-29" });
    expect(L.noteText(idle, "Abby", today)).toBe("Abby, I miss you. It's been 5 days since you worked on Base colors.");
    expect(L.noteText(idle, "", today)).toBe("I miss you. It's been 5 days since you worked on Base colors.");
    expect(L.noteText(status({ idleRequirement: { title: "x", days: 1 } }), "", today)).toBe("I miss you. It's been 1 day since you worked on x.");
    expect(L.noteText(status({ deadline: "2026-10-31" }), "Abby", today)).toBe("Abby, we're due in 3 days.");
    expect(L.noteText(status({ deadline: "2026-10-29" }), "", today)).toBe("We're due tomorrow.");
    expect(L.noteText(status({ deadline: "2026-10-28" }), "", today)).toBe("We're due today!");
    expect(L.noteText(status({ deadline: "2026-11-01" }), "", today)).toBeNull(); // 4 days away
    expect(L.noteText(status({ deadline: "2026-10-20" }), "", today)).toBeNull(); // overdue
    expect(L.noteText(status(), "Abby", today)).toBeNull();
  });

  it("chooseNote only for Moderate, off Studium, with no nap, no open note and long enough since the last one", () => {
    const now = Date.parse("2026-10-28T12:00:00Z");
    const ctx = {
      statuses: [status({ idleRequirement: { title: "x", days: 5 } })],
      shown: new Set(["p"]),
      prefs: { involvement: "moderate", nickname: "Abby" },
      petAway: {},
      lastNoteAt: 0,
      now,
      today,
      onStudium: false,
      noteOpen: false,
    };
    expect(L.chooseNote(ctx)).toEqual({ projectId: "p", text: "Abby, I miss you. It's been 5 days since you worked on x.", signature: "- portraits", color: "#2d3a8c" });
    expect(L.chooseNote({ ...ctx, prefs: { involvement: "mild", nickname: "" } })).toBeNull();
    expect(L.chooseNote({ ...ctx, prefs: undefined })).toBeNull();
    expect(L.chooseNote({ ...ctx, onStudium: true })).toBeNull();
    expect(L.chooseNote({ ...ctx, noteOpen: true })).toBeNull();
    expect(L.chooseNote({ ...ctx, pageVisible: false })).toBeNull(); // a background tab leaves no note
    expect(L.chooseNote({ ...ctx, pageVisible: true })).not.toBeNull();
    expect(L.chooseNote({ ...ctx, petAway: { p: { kind: "nap", until: now + 60_000, startedAt: now } } })).toBeNull();
    expect(L.chooseNote({ ...ctx, lastNoteAt: now - 59 * 60_000 })).toBeNull(); // a Happy pet: an hour
    expect(L.chooseNote({ ...ctx, lastNoteAt: now - 60 * 60_000 })).not.toBeNull();
  });

  it("chooseNote skips pets with nothing to say and pets that aren't shown", () => {
    const now = Date.parse("2026-10-28T12:00:00Z");
    const quiet = status({ projectId: "q", shortName: "quiet" });
    const hidden = status({ projectId: "h", shortName: "hidden", idleRequirement: { title: "x", days: 9 } });
    const due = status({ projectId: "d", shortName: "novel", deadline: "2026-10-30" });
    const ctx = { statuses: [quiet, hidden, due], shown: new Set(["q", "d"]), prefs: { involvement: "moderate", nickname: "" }, petAway: {}, lastNoteAt: 0, now, today, onStudium: false, noteOpen: false };
    expect(L.chooseNote(ctx)).toEqual({ projectId: "d", text: "We're due in 2 days.", signature: "- novel", color: "#2d3a8c" });
    expect(L.chooseNote({ ...ctx, shown: new Set(["q"]) })).toBeNull();
  });

  it("chooseNote: the pet in the worst mood writes, and its mood sets the wait", () => {
    const now = Date.parse("2026-10-28T12:00:00Z");
    const happy = status({ projectId: "h", shortName: "happy", deadline: "2026-10-29" });
    const sick = status({ projectId: "s", shortName: "sick", mood: "Sick" });
    const upset = status({ projectId: "u", shortName: "upset", mood: "Upset" });
    const ctx = { statuses: [happy, upset, sick], shown: new Set(["h", "u", "s"]), prefs: { involvement: "moderate", nickname: "" }, petAway: {}, lastNoteAt: 0, now, today, onStudium: false, noteOpen: false, random: () => 0 };
    expect(L.chooseNote(ctx)?.projectId).toBe("s");
    expect(L.chooseNote({ ...ctx, lastNoteAt: now - 9 * 60_000 })).toBeNull();
    expect(L.chooseNote({ ...ctx, lastNoteAt: now - 10 * 60_000 })?.projectId).toBe("s");
    // Without the sick pet: the upset one, every 15 minutes.
    const noSick = { ...ctx, shown: new Set(["h", "u"]) };
    expect(L.chooseNote({ ...noSick, lastNoteAt: now - 14 * 60_000 })).toBeNull();
    expect(L.chooseNote({ ...noSick, lastNoteAt: now - 15 * 60_000 })?.projectId).toBe("u");
  });

  it("todayKey is the local date", () => {
    expect(L.todayKey(new Date(2026, 9, 5, 23, 30))).toBe("2026-10-05");
  });
});

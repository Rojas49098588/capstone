// Tests for the browser extension's pure helpers (extension/content/logic.js). They live in web/
// because the extension has no build step or node_modules of its own.
import { describe, expect, it } from "vitest";
import "../../../extension/content/logic.js";

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
    expect(k.sound).toBe("…");
    expect(k.napChance).toBeCloseTo(0.6);
    expect(k.idleMs[0]).toBeGreaterThan(cat.idleMs[0]);
    expect(L.applyMood(turtle, "Upset").sound).toBe("…");
  });

  it("is slow, only sneezes, and stays grounded when Sick", () => {
    const k = L.applyMood(cat, "Sick");
    expect(k).toMatchObject({ sound: "Achoo!", napChance: 0, tint: true });
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

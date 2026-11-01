// Tests for the desktop pets' mischief rules (Moderate only) in extension/content/logic.js.
import { describe, expect, it } from "vitest";
import "../../../extension/content/logic.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const L = (globalThis as unknown as { PetLogic: any }).PetLogic;
const T = Date.parse("2026-11-02T12:00:00Z");
const MIN = 60000;
const moderate = { involvement: "moderate", nickname: "" };
const nap = { kind: "nap", id: "n", startedAt: new Date(T).toISOString(), until: new Date(T + 15 * MIN).toISOString(), taskId: null, taskTitle: null };
const sleep = { ...nap, kind: "sleep" };
const status = (projectId: string, mood: string) => ({ projectId, mood });

describe("mischiefTiming", () => {
  it("is the MISCHIEF numbers without an override", () => {
    const M = L.MISCHIEF;
    expect(L.mischiefTiming(undefined)).toEqual({
      chaseGapMs: M.CHASE_GAP_MS,
      openGapMs: M.OPEN_GAP_MS,
      studiumRecentMs: M.STUDIUM_RECENT_MS,
      soundGapMs: M.SOUND_GAP_MS,
      noteGapMs: null,
    });
    expect(M).toMatchObject({ NOTE_STAY_MS: 15 * MIN, CHASE_GAP_MS: [10 * MIN, 20 * MIN], CHASE_MS: 10000, OPEN_GAP_MS: 120 * MIN, STUDIUM_RECENT_MS: 30 * MIN, SOUND_GAP_MS: 30000, SOUND_VOLUME: 0.3 });
  });

  it("uses mischiefMinutes for every gap when it's set (for checking by hand)", () => {
    expect(L.mischiefTiming({ mischiefMinutes: 0.5 })).toEqual({
      chaseGapMs: [30000, 30000],
      openGapMs: 30000,
      studiumRecentMs: 30000,
      soundGapMs: 30000,
      noteGapMs: 30000,
    });
    for (const bad of [{ mischiefMinutes: 0 }, { mischiefMinutes: 99 }, { mischiefMinutes: "1" }, null]) {
      expect(L.mischiefTiming(bad).noteGapMs).toBeNull();
    }
  });
});

describe("mischiefAllowed", () => {
  const ok = { prefs: moderate, petAway: {}, checkIn: null, hidden: false };
  it("allows mischief on Moderate with nothing going on", () => {
    expect(L.mischiefAllowed(ok)).toBe(true);
    expect(L.mischiefAllowed({ ...ok, petAway: { a: sleep } })).toBe(true); // a sleeping pet just isn't there
  });
  it("never on Mild or Minimal, during a nap, during a check-in, or with pets hidden", () => {
    expect(L.mischiefAllowed({ ...ok, prefs: { involvement: "mild", nickname: "" } })).toBe(false);
    expect(L.mischiefAllowed({ ...ok, prefs: { involvement: "minimal", nickname: "" } })).toBe(false);
    expect(L.mischiefAllowed({ ...ok, petAway: { a: nap } })).toBe(false);
    expect(L.mischiefAllowed({ ...ok, checkIn: { projectId: "a" } })).toBe(false);
    expect(L.mischiefAllowed({ ...ok, hidden: true })).toBe(false);
  });
});

describe("nextChaseAt", () => {
  const t = L.mischiefTiming(undefined);
  it("is 10 to 20 minutes away, half that when Proud or Delighted, never when Sick", () => {
    expect(L.nextChaseAt(T, "Happy", t, () => 0)).toBe(T + 10 * MIN);
    expect(L.nextChaseAt(T, "Happy", t, () => 0.999999)).toBeCloseTo(T + 20 * MIN, -2);
    expect(L.nextChaseAt(T, "Delighted", t, () => 0)).toBe(T + 5 * MIN);
    expect(L.nextChaseAt(T, "Proud", t, () => 0)).toBe(T + 5 * MIN);
    expect(L.nextChaseAt(T, "Sick", t, () => 0)).toBeNull();
  });
});

describe("cursorInOverlay", () => {
  const bounds = { x: 100, y: 0, width: 800, height: 600 };
  it("turns a screen point into an overlay point", () => {
    expect(L.cursorInOverlay({ x: 110, y: 60 }, bounds)).toEqual({ x: 10, y: 60 });
  });
  it("is null off the overlay: another monitor, or the taskbar below it", () => {
    expect(L.cursorInOverlay({ x: 50, y: 60 }, bounds)).toBeNull();
    expect(L.cursorInOverlay({ x: 950, y: 60 }, bounds)).toBeNull();
    expect(L.cursorInOverlay({ x: 300, y: 620 }, bounds)).toBeNull();
    expect(L.cursorInOverlay(null, bounds)).toBeNull();
  });
});

describe("chooseOpenProject", () => {
  const t = L.mischiefTiming(undefined);
  const base = {
    statuses: [status("a", "Upset"), status("b", "Sick"), status("c", "Happy")],
    prefs: moderate, petAway: {}, checkIn: null, hidden: false,
    now: T, lastOpenAt: 0, studiumSeenAt: T - 31 * MIN, timing: t,
  };
  it("picks the sick pet over the upset one", () => {
    expect(L.chooseOpenProject(base)).toBe("b");
    expect(L.chooseOpenProject({ ...base, statuses: [status("a", "Upset"), status("c", "Happy")] })).toBe("a");
  });
  it("only Upset or Sick pets, and not away ones", () => {
    expect(L.chooseOpenProject({ ...base, statuses: [status("c", "Happy"), status("d", "Worried")] })).toBeNull();
    expect(L.chooseOpenProject({ ...base, petAway: { b: sleep } })).toBe("a");
  });
  it("at most every 2 hours, and not within 30 minutes of Studium showing", () => {
    expect(L.chooseOpenProject({ ...base, lastOpenAt: T - 119 * MIN })).toBeNull();
    expect(L.chooseOpenProject({ ...base, lastOpenAt: T - 121 * MIN })).toBe("b");
    expect(L.chooseOpenProject({ ...base, studiumSeenAt: T - 29 * MIN })).toBeNull();
  });
  it("never on Mild or during a nap", () => {
    expect(L.chooseOpenProject({ ...base, prefs: { involvement: "mild", nickname: "" } })).toBeNull();
    expect(L.chooseOpenProject({ ...base, petAway: { c: nap } })).toBeNull();
  });
});

describe("noteCarries", () => {
  it("about 3 notes in 10 are carried in", () => {
    expect(L.noteCarries(() => 0.29)).toBe(true);
    expect(L.noteCarries(() => 0.3)).toBe(false);
  });
});

describe("soundKey", () => {
  it("maps what a pet says to the sound it makes", () => {
    const pairs = [["Meow!", "meow"], ["Meow?", "meow"], ["Bark!", "bark"], ["Ribbit!", "ribbit"], ["Coo!", "coo"], ["Achoo!", "sneeze"], ["*sniffle*", "sniffle"], ["*cough*", "cough"], ["*sigh*", "sigh"]];
    for (const [text, key] of pairs) expect(L.soundKey(text)).toBe(key);
  });
  it("nothing for other bubbles", () => {
    for (const text of ["…", "♥", "Haven't seen Rigging in 9 days", null]) expect(L.soundKey(text)).toBeNull();
  });
});

describe("soundAllowed", () => {
  const t = L.mischiefTiming(undefined);
  it("one sound every 30 seconds at most", () => {
    expect(L.soundAllowed(0, 30000, t)).toBe(true);
    expect(L.soundAllowed(10000, 30000, t)).toBe(false);
    expect(L.soundAllowed(10000, 40000, t)).toBe(true);
  });
});

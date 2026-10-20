// Tests for "Pets on screen at once" (User Settings) in extension/content/logic.js.
import { describe, expect, it } from "vitest";
import "../../../extension/content/logic.js";
import { SETTINGS_EVENT, SETTINGS_KEY } from "../store/settings";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const L = (globalThis as unknown as { PetLogic: any }).PetLogic;

describe("pets on screen", () => {
  it("uses the same names as Studium", () => {
    expect(L.SETTINGS_KEY).toBe(SETTINGS_KEY);
    expect(L.SETTINGS_EVENT).toBe(SETTINGS_EVENT);
  });

  it("reads the limit from Studium's saved settings: a whole number, or null for all", () => {
    expect(L.petLimitFromSettings(JSON.stringify({ petCount: 2, difficulty: "easy" }))).toBe(2);
    expect(L.petLimitFromSettings(JSON.stringify({ petCount: "all" }))).toBeNull();
    expect(L.petLimitFromSettings(JSON.stringify({ petCount: 0 }))).toBeNull();
    expect(L.petLimitFromSettings(JSON.stringify({ petCount: 1.5 }))).toBeNull();
    expect(L.petLimitFromSettings("{not json")).toBeNull();
    expect(L.petLimitFromSettings(null)).toBeNull();
    expect(L.cleanPetLimit(3)).toBe(3);
    expect(L.cleanPetLimit("3")).toBeNull();
    expect(L.cleanPetLimit(undefined)).toBeNull();
  });

  it("shows the first pets in project order, skipping away pets", () => {
    const ids = ["a", "b", "c", "d"];
    expect([...L.petsOnScreen(ids, {}, null)]).toEqual(ids);
    expect([...L.petsOnScreen(ids, {}, 2)]).toEqual(["a", "b"]);
    expect([...L.petsOnScreen(ids, { a: { kind: "nap" } }, 2)]).toEqual(["b", "c"]);
    expect([...L.petsOnScreen(ids, {}, 10)]).toEqual(ids);
  });
});

import { describe, expect, it } from "vitest";
import { memoryStorage } from "../test/render";
import { DEFAULT_SETTINGS, SETTINGS_KEY, loadSettings, parseSettings, saveSettings } from "./settings";

describe("settings", () => {
  it("defaults to Easy, all pets, bar progress and a very involved pet", () => {
    expect(DEFAULT_SETTINGS).toEqual({ difficulty: "easy", petCount: "all", progressStyle: "bar", petInvolvement: "very" });
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings("{not json")).toEqual(DEFAULT_SETTINGS);
  });

  it("keeps valid values and replaces invalid ones with defaults", () => {
    expect(parseSettings(JSON.stringify({ difficulty: "hard", petCount: 2, progressStyle: "circle", petInvolvement: "notMuch" }))).toEqual({
      difficulty: "hard",
      petCount: 2,
      progressStyle: "circle",
      petInvolvement: "notMuch",
    });
    expect(parseSettings(JSON.stringify({ difficulty: "extreme", petCount: 0, progressStyle: 5 }))).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings(JSON.stringify({ petCount: 1.5 })).petCount).toBe("all");
  });

  it("saves and loads", () => {
    const storage = memoryStorage();
    expect(saveSettings(storage, { ...DEFAULT_SETTINGS, difficulty: "medium" })).toBe(true);
    expect(JSON.parse(storage.getItem(SETTINGS_KEY) as string).difficulty).toBe("medium");
    expect(loadSettings(storage).difficulty).toBe("medium");
    expect(saveSettings(null, DEFAULT_SETTINGS)).toBe(false);
    expect(loadSettings(null)).toEqual(DEFAULT_SETTINGS);
  });
});

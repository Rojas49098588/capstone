import { describe, expect, it } from "vitest";
import { memoryStorage } from "../test/render";
import { DEFAULT_SETTINGS, SETTINGS_KEY, loadSettings, parseSettings, saveSettings } from "./settings";

describe("settings", () => {
  it("defaults to Steady, all pets in project order, circle progress, a Mild pet, School and no nickname", () => {
    expect(DEFAULT_SETTINGS).toEqual({
      difficulty: "steady",
      petCount: "all",
      petOrder: "project",
      progressStyle: "circle",
      petInvolvement: "mild",
      nickname: "",
      projectType: "school",
      setupDone: false,
      tutorialDone: false,
      shopTutorialDone: false,
    });
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings("{not json")).toEqual(DEFAULT_SETTINGS);
  });

  it("keeps valid values and replaces invalid ones with defaults", () => {
    expect(
      parseSettings(
        JSON.stringify({ difficulty: "strict", petCount: 2, petOrder: "dueDate", progressStyle: "circle", petInvolvement: "moderate", nickname: "Abby", projectType: "art", setupDone: true }),
      ),
    ).toEqual({
      difficulty: "strict",
      petCount: 2,
      petOrder: "dueDate",
      progressStyle: "circle",
      petInvolvement: "moderate",
      nickname: "Abby",
      projectType: "art",
      setupDone: true,
      tutorialDone: false,
      shopTutorialDone: false,
    });
    expect(parseSettings(JSON.stringify({ projectType: "poetry", setupDone: "yes" }))).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings(JSON.stringify({ difficulty: "extreme", petCount: 0, petOrder: "random", progressStyle: 5 }))).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings(JSON.stringify({ petCount: 1.5 })).petCount).toBe("all");
  });

  it("maps settings saved before setup", () => {
    expect(parseSettings(JSON.stringify({ difficulty: "hard", petInvolvement: "notMuch" }))).toMatchObject({ difficulty: "strict", petInvolvement: "minimal" });
    expect(parseSettings(JSON.stringify({ difficulty: "easy", petInvolvement: "very" }))).toMatchObject({ difficulty: "gentle", petInvolvement: "mild" });
    expect(parseSettings(JSON.stringify({ difficulty: "medium" })).difficulty).toBe("steady");
  });

  it("trims and shortens the nickname", () => {
    expect(parseSettings(JSON.stringify({ nickname: "  Abby  " })).nickname).toBe("Abby");
    expect(parseSettings(JSON.stringify({ nickname: "A".repeat(25) })).nickname).toBe("A".repeat(20));
    expect(parseSettings(JSON.stringify({ nickname: 5 })).nickname).toBe("");
  });

  it("counts the Shop tutorial as seen for someone who finished the old one-part tour", () => {
    expect(parseSettings(JSON.stringify({ tutorialDone: true })).shopTutorialDone).toBe(true);
    expect(parseSettings(JSON.stringify({ tutorialDone: true, shopTutorialDone: false })).shopTutorialDone).toBe(false);
    expect(parseSettings(JSON.stringify({ tutorialDone: false })).shopTutorialDone).toBe(false);
    expect(parseSettings(JSON.stringify({ shopTutorialDone: true })).tutorialDone).toBe(false);
  });

  it("saves and loads", () => {
    const storage = memoryStorage();
    expect(saveSettings(storage, { ...DEFAULT_SETTINGS, difficulty: "strict" })).toBe(true);
    expect(JSON.parse(storage.getItem(SETTINGS_KEY) as string).difficulty).toBe("strict");
    expect(loadSettings(storage).difficulty).toBe("strict");
    expect(saveSettings(null, DEFAULT_SETTINGS)).toBe(false);
    expect(loadSettings(null)).toEqual(DEFAULT_SETTINGS);
  });
});

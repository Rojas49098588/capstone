import { describe, expect, it } from "vitest";
import { memoryStorage } from "../test/render";
import { loadViewPrefs, saveViewPrefs, viewPrefsKey } from "./viewPrefs";

describe("view prefs", () => {
  it("round-trips per project", () => {
    const storage = memoryStorage();
    saveViewPrefs(storage, "p1", { filters: ["soon", "hideCompleted"], collapsed: ["a", "b"] });
    expect(loadViewPrefs(storage, "p1")).toEqual({ filters: ["hideCompleted", "soon"], collapsed: ["a", "b"] }); // in the menu's order
    expect(loadViewPrefs(storage, "p2")).toEqual({ filters: [], collapsed: [] });
    expect(viewPrefsKey("p1")).toBe("studium.requirementView.p1");
  });

  it("falls back to the defaults when the saved prefs are damaged", () => {
    const storage = memoryStorage();
    storage.setItem(viewPrefsKey("p1"), "{bad");
    expect(loadViewPrefs(storage, "p1")).toEqual({ filters: [], collapsed: [] });
    storage.setItem(viewPrefsKey("p1"), JSON.stringify({ filters: ["weird", "soon", "soon"], collapsed: ["a", 5] }));
    expect(loadViewPrefs(storage, "p1")).toEqual({ filters: ["soon"], collapsed: ["a"] });
    storage.setItem(viewPrefsKey("p1"), JSON.stringify(null));
    expect(loadViewPrefs(storage, "p1")).toEqual({ filters: [], collapsed: [] });
  });

  it("reads prefs saved with a single view (before filters stacked)", () => {
    const storage = memoryStorage();
    storage.setItem(viewPrefsKey("p1"), JSON.stringify({ view: "soon", collapsed: [] }));
    expect(loadViewPrefs(storage, "p1").filters).toEqual(["soon"]);
    storage.setItem(viewPrefsKey("p1"), JSON.stringify({ view: "all", collapsed: [] }));
    expect(loadViewPrefs(storage, "p1").filters).toEqual([]);
  });

  it("works without storage", () => {
    expect(loadViewPrefs(null, "p1")).toEqual({ filters: [], collapsed: [] });
    expect(() => saveViewPrefs(null, "p1", { filters: ["soon"], collapsed: [] })).not.toThrow();
    const full = memoryStorage();
    full.setItem = () => {
      throw new Error("QuotaExceededError");
    };
    expect(() => saveViewPrefs(full, "p1", { filters: ["soon"], collapsed: [] })).not.toThrow();
  });
});

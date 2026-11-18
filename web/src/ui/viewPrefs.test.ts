import { describe, expect, it } from "vitest";
import { memoryStorage } from "../test/render";
import { loadViewPrefs, saveViewPrefs, viewPrefsKey } from "./viewPrefs";

describe("view prefs", () => {
  it("round-trips per project", () => {
    const storage = memoryStorage();
    saveViewPrefs(storage, "p1", { view: "soon", collapsed: ["a", "b"] });
    expect(loadViewPrefs(storage, "p1")).toEqual({ view: "soon", collapsed: ["a", "b"] });
    expect(loadViewPrefs(storage, "p2")).toEqual({ view: "all", collapsed: [] });
    expect(viewPrefsKey("p1")).toBe("studium.requirementView.p1");
  });

  it("falls back to the defaults when the saved prefs are damaged", () => {
    const storage = memoryStorage();
    storage.setItem(viewPrefsKey("p1"), "{bad");
    expect(loadViewPrefs(storage, "p1")).toEqual({ view: "all", collapsed: [] });
    storage.setItem(viewPrefsKey("p1"), JSON.stringify({ view: "weird", collapsed: ["a", 5] }));
    expect(loadViewPrefs(storage, "p1")).toEqual({ view: "all", collapsed: ["a"] });
    storage.setItem(viewPrefsKey("p1"), JSON.stringify(null));
    expect(loadViewPrefs(storage, "p1")).toEqual({ view: "all", collapsed: [] });
  });

  it("works without storage", () => {
    expect(loadViewPrefs(null, "p1")).toEqual({ view: "all", collapsed: [] });
    expect(() => saveViewPrefs(null, "p1", { view: "soon", collapsed: [] })).not.toThrow();
    const full = memoryStorage();
    full.setItem = () => {
      throw new Error("QuotaExceededError");
    };
    expect(() => saveViewPrefs(full, "p1", { view: "soon", collapsed: [] })).not.toThrow();
  });
});

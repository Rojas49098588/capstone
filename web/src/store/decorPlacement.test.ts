import { describe, expect, it } from "vitest";
import { NOW } from "../planner/testData";
import type { StudiumData } from "../planner/types";
import { createProject, deleteProject, moveDecor, placeDecor, purchase, removeDecor } from "./actions";
import { DEFAULT_BED, cleanDecor, freeCopies, giveDefaultBeds, ownedCopies, placements } from "./decor";
import { buildSeed } from "./seed";

/** The example data with empty habitats (no built-in beds) plus one purchase of each id given. */
function owning(...ids: string[]): StudiumData {
  const data: StudiumData = { ...buildSeed(NOW), decor: {} };
  for (const productId of ids) data.events.push({ type: "purchase", at: NOW.toISOString(), productId, price: 0 });
  return data;
}

describe("placeDecor", () => {
  it("puts an owned copy in a slot", () => {
    const data = placeDecor(owning("pet-bed"), "webDev", "floorLeft", "pet-bed");
    expect(data.decor?.webDev).toEqual({ floorLeft: "pet-bed" });
    expect(ownedCopies(data, "pet-bed")).toBe(1);
    expect(freeCopies(data, "pet-bed")).toBe(0);
  });

  it("refuses without a free copy", () => {
    const once = placeDecor(owning("pet-bed"), "webDev", "floorLeft", "pet-bed");
    expect(placeDecor(once, "appDev", "floorLeft", "pet-bed")).toBe(once);
    const none = owning();
    expect(placeDecor(none, "webDev", "floorLeft", "pet-bed")).toBe(none);
  });

  it("refuses a slot the item can't use", () => {
    const data = owning("round-rug", "perch");
    expect(placeDecor(data, "webDev", "floorLeft", "round-rug")).toBe(data);
    expect(placeDecor(data, "webDev", "floorMiddle", "perch")).toBe(data);
  });

  it("refuses a second bed in one habitat", () => {
    const one = placeDecor(owning("pet-bed", "pet-bed"), "webDev", "floorLeft", "pet-bed");
    expect(placeDecor(one, "webDev", "floorRight", "pet-bed")).toBe(one);
    expect(placeDecor(one, "appDev", "floorRight", "pet-bed").decor?.appDev).toEqual({ floorRight: "pet-bed" });
  });

  it("replacing a slot frees the old item", () => {
    let data = placeDecor(owning("sage-stripes", "night-sky"), "webDev", "wallpaper", "sage-stripes");
    data = placeDecor(data, "webDev", "wallpaper", "night-sky");
    expect(data.decor?.webDev).toEqual({ wallpaper: "night-sky" });
    expect(placeDecor(data, "appDev", "wallpaper", "sage-stripes").decor?.appDev).toEqual({ wallpaper: "sage-stripes" });
  });

  it("an unknown project or item changes nothing", () => {
    const data = owning("pet-bed");
    expect(placeDecor(data, "nope", "floorLeft", "pet-bed")).toBe(data);
    expect(placeDecor(data, "webDev", "floorLeft", "nope")).toBe(data);
  });
});

describe("removeDecor and moveDecor", () => {
  it("removeDecor frees the copy", () => {
    const placed = placeDecor(owning("clock"), "webDev", "wallLeft", "clock");
    const removed = removeDecor(placed, "webDev", "wallLeft");
    expect(placements(removed, "clock")).toEqual([]);
    expect(freeCopies(removed, "clock")).toBe(1);
    expect(removeDecor(removed, "webDev", "wallLeft")).toBe(removed);
  });

  it("moveDecor keeps the copy count", () => {
    const placed = placeDecor(owning("pet-bed"), "appDev", "floorLeft", "pet-bed");
    const moved = moveDecor(placed, { projectId: "appDev", slot: "floorLeft" }, { projectId: "webDev", slot: "floorRight" });
    expect(placements(moved, "pet-bed")).toEqual([{ projectId: "webDev", slot: "floorRight" }]);
  });

  it("moveDecor changes nothing when the place is refused", () => {
    let data = placeDecor(owning("pet-bed", "pet-bed"), "appDev", "floorLeft", "pet-bed");
    data = placeDecor(data, "webDev", "floorLeft", "pet-bed");
    expect(moveDecor(data, { projectId: "appDev", slot: "floorLeft" }, { projectId: "webDev", slot: "floorRight" })).toBe(data);
    expect(moveDecor(data, { projectId: "appDev", slot: "wallLeft" }, { projectId: "webDev", slot: "floorRight" })).toBe(data);
  });

  it("moveDecor refuses when the source no longer holds the expected item", () => {
    let data = placeDecor(owning("clock", "study-poster"), "appDev", "wallLeft", "study-poster");
    const from = { projectId: "appDev", slot: "wallLeft" as const };
    expect(moveDecor(data, from, { projectId: "webDev", slot: "wallLeft" }, "clock")).toBe(data);
    data = placeDecor(removeDecor(data, "appDev", "wallLeft"), "appDev", "wallLeft", "clock");
    expect(moveDecor(data, from, { projectId: "webDev", slot: "wallLeft" }, "clock").decor).toEqual({ webDev: { wallLeft: "clock" } });
  });

  it("deleting a project returns its decor", () => {
    const placed = placeDecor(owning("pet-bed"), "appDev", "floorLeft", "pet-bed");
    const after = deleteProject(placed, "appDev");
    expect(after.decor?.appDev).toBeUndefined();
    expect(freeCopies(after, "pet-bed")).toBe(1);
  });
});

describe("cleanDecor", () => {
  it("drops what isn't valid", () => {
    const data = owning("pet-bed", "pet-bed", "clock", "round-rug");
    data.decor = {
      gone: { floorLeft: "pet-bed" },
      webDev: { floorLeft: "pet-bed", floorRight: "pet-bed", wallLeft: "nope", floorMiddle: "clock" },
      appDev: { floorLeft: "pet-bed", wallLeft: "clock", wallRight: "clock", floorMiddle: "round-rug" },
    };
    expect(cleanDecor(data)).toEqual({
      webDev: { floorLeft: "pet-bed" }, // a second bed, an unknown item and a clock on the floor are dropped
      appDev: { floorLeft: "pet-bed", wallLeft: "clock", floorMiddle: "round-rug" }, // only one clock is owned
    });
  });

  it("returns nothing for damaged decor", () => {
    for (const junk of ["junk", 5, null, [], { webDev: "x" }, { webDev: { floorLeft: 3 } }]) {
      const data = owning("pet-bed");
      (data as unknown as { decor: unknown }).decor = junk;
      const cleaned = cleanDecor(data);
      expect(Object.values(cleaned).every((h) => Object.keys(h).length === 0) || Object.keys(cleaned).length === 0).toBe(true);
    }
  });
});

describe("the built-in bed", () => {
  const bed = DEFAULT_BED.id;
  const input = { name: "Thesis", shortName: "thesis", color: "#aa3366", deadline: "2026-12-01", description: "", petKind: "cat" as const };

  it("every example habitat starts with one", () => {
    const data = buildSeed(NOW);
    expect(data.defaultBeds).toBe(true);
    for (const p of data.projects) expect(data.decor?.[p.id]).toEqual({ floorLeft: bed });
    expect(ownedCopies(data, bed)).toBe(data.projects.length);
    expect(freeCopies(data, bed)).toBe(0);
  });

  it("a new project comes with one", () => {
    const { data, project } = createProject(buildSeed(NOW), input, NOW);
    expect(data.decor?.[project.id]).toEqual({ floorLeft: bed });
    expect(freeCopies(data, bed)).toBe(0);
    expect(cleanDecor(data)[project.id]).toEqual({ floorLeft: bed });
  });

  it("older data gets one per habitat, once, next to what is already there", () => {
    const { defaultBeds: _, ...old } = { ...buildSeed(NOW), decor: { webDev: { floorLeft: "pet-bed" }, appDev: { floorLeft: "mini-sofa" } } };
    const data = giveDefaultBeds(old);
    expect(data.decor?.webDev).toEqual({ floorLeft: "pet-bed" }); // already has a bed
    expect(data.decor?.appDev).toEqual({ floorLeft: "mini-sofa", floorRight: bed });
    const removed = removeDecor(data, "appDev", "floorRight");
    expect(giveDefaultBeds(removed)).toBe(removed); // a removed bed stays removed
  });

  it("can be removed and placed again, but not bought", () => {
    const data = removeDecor(buildSeed(NOW), "webDev", "floorLeft");
    expect(freeCopies(data, bed)).toBe(1);
    expect(placeDecor(data, "webDev", "floorRight", bed).decor?.webDev).toEqual({ floorRight: bed });
    expect(purchase(data, bed, NOW).ok).toBe(false);
  });
});

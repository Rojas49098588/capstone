import { describe, expect, it } from "vitest";
import { DECOR_GROUPS, DECOR_ITEMS, DECOR_SLOTS, findDecor } from "./decor";

const ofType = (type: string) => DECOR_ITEMS.filter((i) => i.type === type);

describe("decor catalog", () => {
  it("has the agreed items and prices", () => {
    const counts = ["wallpaper", "flooring", "rug", "wallDecor", "bed", "petFurniture"].map((t) => ofType(t).length);
    expect(counts).toEqual([3, 3, 2, 2, 1, 5]);
    const prices = ["wallpaper", "flooring", "rug", "wallDecor", "bed", "petFurniture"].map((t) => [...new Set(ofType(t).map((i) => i.price))]);
    expect(prices).toEqual([[100], [90], [60], [40], [150], [200]]);
    expect(ofType("wallpaper").map((i) => i.name)).toEqual(["Sage Stripes", "Library Gold", "Night Sky"]);
    expect(ofType("flooring").map((i) => i.name)).toEqual(["Oak Planks", "Stone Tiles", "Grass"]);
    expect(ofType("petFurniture").map((i) => i.name)).toEqual(["Scratching Post", "Heat Lamp", "Perch", "Mini Sofa", "Log"]);
    expect(new Set(DECOR_ITEMS.map((i) => i.id)).size).toBe(DECOR_ITEMS.length);
    for (const i of DECOR_ITEMS) expect(i.image).toBe(`decor/${i.id}.svg`);
  });

  it("slots follow the type rules", () => {
    const floor = ["floorLeft", "floorMiddle", "floorRight"];
    expect(DECOR_SLOTS).toEqual(["wallpaper", "flooring", ...floor, "wallLeft", "wallRight"]);
    for (const i of ofType("wallpaper")) expect(i.slots).toEqual(["wallpaper"]);
    for (const i of ofType("flooring")) expect(i.slots).toEqual(["flooring"]);
    for (const i of ofType("rug")) expect(i.slots).toEqual(["floorMiddle"]);
    for (const i of ofType("wallDecor")) expect(i.slots).toEqual(["wallLeft", "wallRight"]);
    expect(findDecor("pet-bed")).toMatchObject({ slots: floor, use: "bed" });
    expect(findDecor("perch")).toMatchObject({ slots: ["wallLeft", "wallRight"], use: "perch", forKind: "pigeon" });
    expect(findDecor("heat-lamp")).toMatchObject({ slots: floor, use: "bask", forKind: "turtle" });
    expect(findDecor("scratching-post")).toMatchObject({ use: "scratch", forKind: "cat" });
    expect(findDecor("mini-sofa")).toMatchObject({ use: "lounge", forKind: "dog" });
    expect(findDecor("log")).toMatchObject({ use: "lounge", forKind: "frog" });
    expect(findDecor("nope")).toBeUndefined();
  });

  it("groups decor for the Shop and the inventory", () => {
    expect(DECOR_GROUPS.map((g) => g.label)).toEqual(["Wallpaper", "Flooring", "Rugs", "Wall decor", "Beds", "Pet furniture"]);
  });
});

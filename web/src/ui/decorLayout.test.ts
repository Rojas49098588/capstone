import { describe, expect, it } from "vitest";
import { SLOT_LAYOUT, itemBox } from "./decorLayout";

describe("SLOT_LAYOUT", () => {
  it("keeps every slot inside the box", () => {
    for (const s of Object.values(SLOT_LAYOUT)) {
      expect(s.x - s.w / 2).toBeGreaterThanOrEqual(0);
      expect(s.x + s.w / 2).toBeLessThanOrEqual(1);
      expect(s.y).toBeGreaterThanOrEqual(0);
      expect(s.y + s.h).toBeLessThanOrEqual(1);
    }
  });

  it("doesn't overlap the floor slots", () => {
    const { floorLeft: l, floorMiddle: m, floorRight: r } = SLOT_LAYOUT;
    expect(l.x + l.w / 2).toBeLessThanOrEqual(m.x - m.w / 2);
    expect(m.x + m.w / 2).toBeLessThanOrEqual(r.x - r.w / 2);
  });

  it("has the planned positions", () => {
    expect(SLOT_LAYOUT).toEqual({
      floorLeft: { x: 0.18, y: 0.04, w: 0.2, h: 0.32 },
      floorMiddle: { x: 0.5, y: 0.02, w: 0.3, h: 0.16 },
      floorRight: { x: 0.82, y: 0.04, w: 0.2, h: 0.32 },
      wallLeft: { x: 0.14, y: 0.5, w: 0.14, h: 0.28 },
      wallRight: { x: 0.86, y: 0.5, w: 0.14, h: 0.28 },
    });
  });
});

describe("itemBox", () => {
  it("draws a bed in the middle spot as big as in a side spot", () => {
    const side = itemBox("floorLeft", "bed");
    const middle = itemBox("floorMiddle", "bed");
    expect({ w: middle.w, h: middle.h, y: middle.y }).toEqual({ w: side.w, h: side.h, y: side.y });
    expect(middle.x).toBe(SLOT_LAYOUT.floorMiddle.x);
    expect(itemBox("floorMiddle", "petFurniture").h).toBe(side.h);
  });

  it("keeps rugs and other spots in their own box", () => {
    expect(itemBox("floorMiddle", "rug")).toEqual(SLOT_LAYOUT.floorMiddle);
    expect(itemBox("floorRight", "bed")).toEqual(SLOT_LAYOUT.floorRight);
    expect(itemBox("wallLeft", "wallDecor")).toEqual(SLOT_LAYOUT.wallLeft);
  });
});

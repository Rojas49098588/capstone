// Where each decor spot sits in the habitat box, as fractions of the box. The extension uses the
// same numbers (SLOT_POSITIONS in extension/content/logic.js) to walk pets to their furniture;
// src/extension/decorLayout.test.ts keeps the two identical.
//   x: the item's centre from the left; y: its bottom edge above the box's bottom; w/h: its size.
import type { DecorSlot } from "../planner/types";

export type SpotSlot = Exclude<DecorSlot, "wallpaper" | "flooring">;
export type SlotBox = { x: number; y: number; w: number; h: number };

export const SLOT_LAYOUT: Record<SpotSlot, SlotBox> = {
  floorLeft: { x: 0.18, y: 0.04, w: 0.2, h: 0.32 },
  floorMiddle: { x: 0.5, y: 0.02, w: 0.3, h: 0.16 },
  floorRight: { x: 0.82, y: 0.04, w: 0.2, h: 0.32 },
  wallLeft: { x: 0.14, y: 0.5, w: 0.14, h: 0.28 },
  wallRight: { x: 0.86, y: 0.5, w: 0.14, h: 0.28 },
};

export const SPOT_SLOTS = Object.keys(SLOT_LAYOUT) as SpotSlot[];

/** How a spot is named on screen ("the left floor spot"). */
export const SLOT_NAMES: Record<SpotSlot, string> = {
  floorLeft: "the left floor spot",
  floorMiddle: "the middle floor spot",
  floorRight: "the right floor spot",
  wallLeft: "the left wall spot",
  wallRight: "the right wall spot",
};

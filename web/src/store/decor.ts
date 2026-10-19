// Habitat decor (spec 2026-10-19-habitat-decor-design.md): what the Shop's Habitat tab sells and
// where each piece can go. Art lives in web/public/<image>; replacing that file swaps the art.
import { inventory } from "../planner/history";
import type { DecorSlot, HabitatDecor, PetKind, StudiumData } from "../planner/types";

export type DecorType = "wallpaper" | "flooring" | "rug" | "wallDecor" | "bed" | "petFurniture";
/** What a pet does with a piece of furniture (extension/content/logic.js uses the same names). */
export type FurnitureUse = "bed" | "scratch" | "bask" | "perch" | "lounge";

export type DecorItem = {
  id: string;
  name: string;
  description: string;
  type: DecorType;
  price: number;
  image: string; // under web/public/
  slots: DecorSlot[]; // where it may go
  use?: FurnitureUse;
  forKind?: PetKind; // pet furniture: the kind of pet that uses it
};

export const DECOR_SLOTS: DecorSlot[] = ["wallpaper", "flooring", "floorLeft", "floorMiddle", "floorRight", "wallLeft", "wallRight"];
const FLOOR: DecorSlot[] = ["floorLeft", "floorMiddle", "floorRight"];
const WALL: DecorSlot[] = ["wallLeft", "wallRight"];

export const DECOR_GROUPS: { type: DecorType; label: string }[] = [
  { type: "wallpaper", label: "Wallpaper" },
  { type: "flooring", label: "Flooring" },
  { type: "rug", label: "Rugs" },
  { type: "wallDecor", label: "Wall decor" },
  { type: "bed", label: "Beds" },
  { type: "petFurniture", label: "Pet furniture" },
];

const item = (
  id: string,
  name: string,
  description: string,
  type: DecorType,
  price: number,
  slots: DecorSlot[],
  extra: Pick<DecorItem, "use" | "forKind"> = {},
): DecorItem => ({ id, name, description, type, price, image: `decor/${id}.svg`, slots, ...extra });

export const DECOR_ITEMS: DecorItem[] = [
  item("sage-stripes", "Sage Stripes", "Calm green stripes for a focused den.", "wallpaper", 100, ["wallpaper"]),
  item("library-gold", "Library Gold", "Warm gold like an old reading room.", "wallpaper", 100, ["wallpaper"]),
  item("night-sky", "Night Sky", "Deep blue with tiny stars for late study nights.", "wallpaper", 100, ["wallpaper"]),
  item("oak-planks", "Oak Planks", "Honey-colored wooden boards.", "flooring", 90, ["flooring"]),
  item("stone-tiles", "Stone Tiles", "Cool grey tiles, easy to keep tidy.", "flooring", 90, ["flooring"]),
  item("grass", "Grass", "A soft patch of lawn indoors.", "flooring", 90, ["flooring"]),
  item("round-rug", "Round Rug", "A cozy round rug for the middle of the room.", "rug", 60, ["floorMiddle"]),
  item("striped-runner", "Striped Runner", "A long striped rug.", "rug", 60, ["floorMiddle"]),
  item("study-poster", "Study Poster", "Keep going! A little motivation on the wall.", "wallDecor", 40, WALL),
  item("clock", "Clock", "A round wall clock that keeps you on schedule.", "wallDecor", 40, WALL),
  item("pet-bed", "Pet Bed", "A plush bed any pet will nap in.", "bed", 150, FLOOR, { use: "bed" }),
  item("scratching-post", "Scratching Post", "A sturdy post for claws.", "petFurniture", 200, FLOOR, { use: "scratch", forKind: "cat" }),
  item("heat-lamp", "Heat Lamp", "A warm glow to bask under.", "petFurniture", 200, FLOOR, { use: "bask", forKind: "turtle" }),
  item("perch", "Perch", "A wall perch with a view.", "petFurniture", 200, WALL, { use: "perch", forKind: "pigeon" }),
  item("mini-sofa", "Mini Sofa", "A tiny sofa to lounge on.", "petFurniture", 200, FLOOR, { use: "lounge", forKind: "dog" }),
  item("log", "Log", "A mossy log to lie on.", "petFurniture", 200, FLOOR, { use: "lounge", forKind: "frog" }),
];

export function findDecor(id: string): DecorItem | undefined {
  return DECOR_ITEMS.find((i) => i.id === id);
}

// ---- Copies and placements ----
// Invariant: for every item, the copies placed across all habitats <= the copies owned.

export function ownedCopies(data: StudiumData, itemId: string): number {
  return inventory(data.events)[itemId] ?? 0;
}

/** Where the copies of an item are, in project order and then slot order. */
export function placements(data: StudiumData, itemId: string): { projectId: string; slot: DecorSlot }[] {
  const out: { projectId: string; slot: DecorSlot }[] = [];
  for (const p of data.projects) {
    const habitat = data.decor?.[p.id];
    if (!habitat) continue;
    for (const slot of DECOR_SLOTS) if (habitat[slot] === itemId) out.push({ projectId: p.id, slot });
  }
  return out;
}

export function freeCopies(data: StudiumData, itemId: string): number {
  return Math.max(0, ownedCopies(data, itemId) - placements(data, itemId).length);
}

const isBed = (itemId: string | undefined) => (itemId ? findDecor(itemId)?.type === "bed" : false);

/** Can this item go in this slot of this habitat (ignoring what is in that slot now)? */
export function allowedIn(habitat: HabitatDecor, slot: DecorSlot, itemId: string): boolean {
  const item = findDecor(itemId);
  if (!item || !item.slots.includes(slot)) return false;
  // One bed per habitat.
  return !(item.type === "bed" && DECOR_SLOTS.some((s) => s !== slot && isBed(habitat[s])));
}

/**
 * Saved decor with everything invalid dropped: unknown projects or items, slots an item can't use,
 * a second bed, and copies beyond what's owned (the earliest placements win). Never throws.
 */
export function cleanDecor(data: StudiumData): Record<string, HabitatDecor> {
  const raw: unknown = data.decor;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const owned = inventory(data.events);
  const used: Record<string, number> = {};
  const out: Record<string, HabitatDecor> = {};
  for (const p of data.projects) {
    const saved: unknown = (raw as Record<string, unknown>)[p.id];
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) continue;
    const habitat: HabitatDecor = {};
    for (const slot of DECOR_SLOTS) {
      const itemId: unknown = (saved as Record<string, unknown>)[slot];
      if (typeof itemId !== "string" || !allowedIn(habitat, slot, itemId)) continue;
      if ((used[itemId] ?? 0) >= (owned[itemId] ?? 0)) continue;
      used[itemId] = (used[itemId] ?? 0) + 1;
      habitat[slot] = itemId;
    }
    if (Object.keys(habitat).length > 0) out[p.id] = habitat;
  }
  return out;
}

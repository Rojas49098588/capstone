# Habitat Decor — Design

_Date: 2026-10-19. Status: drafted from conversation, awaiting the user's review._
_Builds on: `2026-10-14-studium-planner-design.md` (Plans 1–3) and `2026-10-19-pet-interactions-design.md` (branch `feature/pet-interactions`, PR open). This work is on `feature/habitat-decor`, branched from `feature/pet-interactions`._

## Goal

Give tokens something lasting to buy. The Shop gets a **Habitat** tab of decor: wallpaper, flooring, rugs, wall decor, a pet bed, and one piece of furniture for each kind of pet. The user places what they own into any project's habitat, and the pets **use** their furniture there.

This round is also the start of the **inventory redesign** that the pet interactions spec set aside. An inventory box under each habitat lists everything the user owns.

## Decisions made in conversation

| Topic | Decision |
|---|---|
| Ownership | Buy once, **own it**, can buy **several copies**, and choose which habitat each copy goes in. |
| Placement | **Fixed spots**, not free dragging. |
| Art | **Placeholders for now.** The user will draw the real furniture later, so swapping art must not need code changes. |
| Inventory | A box **below the habitat** with two tabs, **Items** and **Furniture**, each grouped by type (Wallpaper, Flooring, …). Items = today's shop things (Medicine, food, clothes, toys). |
| Shop | Today's products move into a **Supplies** tab, next to the new **Habitat** tab. |
| Pet furniture | Interactive. One piece per pet kind for now: **scratching post** (cat), **heat lamp** (turtle), **perch** (pigeon), **mini sofa** (dog), **log** (frog), plus a **pet bed** for any pet. More will come later, and the user will say how each behaves. |
| Catalog and prices | As proposed (below); accepted by the user. |
| Look of both screens | The mockups in conversation were accepted ("looks good"): Shop with Supplies \| Habitat tabs; inventory under the habitat with a "Placing …: pick a free spot" banner and Move here / Remove on each item. |

## Goals, non-goals, anti-goals

- **Goals:** spend tokens on decor; decorate each project's habitat; pets visibly use their own furniture; art can be replaced by dropping in files.
- **Non-goals (this round):** using food, clothes or toys (they're only listed in Items); free dragging; decor on normal web pages (decor shows only in the Studium habitat box); selling items back; more than one piece of furniture per pet kind.
- **Anti-goals:**
  - Decor must never change tokens, progress or mood beyond its purchase price.
  - Old saved data must keep loading.
  - A placement must never point at more copies than the user owns.

## 1. Catalog

| Type | Items (ids are the builder's call) | Price | Spot |
|---|---|---|---|
| Wallpaper | 3: Sage Stripes, Library Gold, Night Sky | 100 | the whole back wall |
| Flooring | 3: Oak Planks, Stone Tiles, Grass | 90 | the whole floor strip |
| Rug | 2 (e.g. Round Rug, Striped Runner) | 60 | the middle floor spot only |
| Wall decor | 2: Study Poster, Clock | 40 | a wall spot |
| Pet bed | 1, used by any pet | 150 | a floor spot |
| Pet furniture | Scratching Post (cat), Heat Lamp (turtle), Perch (pigeon), Mini Sofa (dog), Log (frog) | 200 | a floor spot; the Perch goes on a wall spot |

- Every item has a name, a short description, a price, a type, the spots it can go in, and an **image path** (for example `decor/oak-planks.svg` in `web/public/`). Replacing the art means replacing that file, or changing that one path.
- Wallpaper and flooring images tile.
- Prices live with the other shop products and numbers, not in components.

## 2. Spots and placement

Each habitat has:
- **wallpaper:** one, default "Plain" (free, always available);
- **flooring:** one, default "Plain" (free, always available);
- **floor spots:** `left`, `middle`, `right`;
- **wall spots:** `left`, `right`.

Rules:
- **A spot holds one item.** A rug may only go in the middle floor spot. Other floor items may go in any floor spot.
- **At most one pet bed per habitat.**
- **Copies:** a copy is in one habitat at a time. "Placed copies of an item across all habitats ≤ copies owned" always holds.
- **Placing:** in the inventory's Furniture tab, pick an item with a free copy. The allowed free spots light up in the habitat box. Click one to place it. "Cancel" or Escape stops placing.
- **Move here:** takes a copy from another habitat when no copy is free.
- **Remove:** sends the copy back to the inventory.
- **Wallpaper and flooring:** picking one in the Furniture tab applies it to this habitat. It replaces the current one, which goes back to the inventory. "Plain" is always free.
- **Deleting a project:** its decor goes back to the inventory.

## 3. Data

- **Purchases** use the existing `purchase` event with the decor product's id, so tokens and owned counts keep working through `tokenBalance` and `inventory`.
- **Placements** are new saved state per project, for example:

  ```ts
  decor?: {
    [projectId: string]: {
      wallpaper: string | null;
      flooring: string | null;
      spots: { floorLeft, floorMiddle, floorRight, wallLeft, wallRight: string | null };
    };
  };
  ```

  The exact shape is the builder's call. It must be **optional**, so data saved before this round still loads, and `version` stays `1`.
- **Validation:** a placement with an unknown item, a spot the item can't use, a second bed, or more placed copies than owned is **dropped when loading**. Damaged decor must not throw away the rest of the saved data.
- Placements are pure actions in `store/actions.ts`, like the others. Each takes `now`, and Studium saves after each one.

## 4. Screens

### Shop
- Two tabs: **Supplies** (today's products, unchanged) and **Habitat** (decor grouped by type).
- Each decor card shows its placeholder art, name, price, **Buy**, and "Owned N" once bought.
- Buying works and is refused exactly as today (not enough tokens).

### Inventory box (under the habitat on each project page)
- Tabs **Items** | **Furniture**, each grouped by type. Empty groups are hidden, and an empty tab says what to buy and links to the Shop.
- **Items:**
  - Medicine keeps its **Give** button (moved here from the habitat's side panel; the side panel keeps its "Buy medicine in the Shop" prompt).
  - Food, clothes and toys show only their name and how many you own.
- **Furniture:** each item shows how many you own and where the copies are ("1 here · 1 in appDev · 1 free"), with **Place**, **Move here** and **Remove** as they apply.

### Habitat box
- Draws the wallpaper behind everything and the flooring in the floor strip, then the items in their spots.
- While placing, it outlines the allowed free spots.
- The still picture (no extension) still shows on top of the decor.
- The decor is part of Studium's page: the extension only draws the pet, as it does today.

## 5. The pets use their furniture (extension)

Only inside the Studium habitat box, and only for that project's pet.

- **What Studium publishes:** `PetStatus` gains what is placed in that habitat that the pet can use, with its spot. For example, `furniture: [{ use: 'bed' | 'scratch' | 'bask' | 'perch' | 'lounge', spot }]`.
- **Shared geometry:** the spots' positions are fixed fractions of the box, the same on both sides, so the extension can turn a spot into a position. They live once in `extension/content/logic.js` and once in Studium's habitat code.
- **Parsing:** the extension's `parseStatuses` keeps parsing old statuses (no `furniture` means none).

Behavior:
- **Pet bed (any pet):**
  - Naps it takes on its own in the habitat happen in the bed: it walks there first.
  - An **away** pet (Nap or Sleep from its menu) lies asleep in the bed instead of on the floor.
- **Its own furniture, now and then, instead of a walk:**
  - **Cat:** walks to the scratching post and scratches (a short wiggle).
  - **Turtle:** walks under the heat lamp and stays there a while.
  - **Pigeon:** flies up and sits on the perch for a bit.
  - **Dog:** hops onto the mini sofa and lounges.
  - **Frog:** hops onto the log and lies there.
- **Other furniture:** a pet ignores furniture meant for another kind of pet.
- Dragging or throwing a pet still works and interrupts whatever it was doing.
- How often a pet uses its furniture, and for how long, are tuning numbers next to `KINDS` (the builder's call; "now and then" means it should feel occasional, not constant).

## 6. Error handling

| Situation | Behavior |
|---|---|
| Saved decor is damaged | Bad placements are dropped; everything else loads. |
| More placed than owned (hand-edited data) | Extra placements are dropped on load. |
| An item's image file is missing | The habitat shows nothing for that item, and the inventory shows its name; nothing breaks. |
| A project is deleted | Its decor goes back to the inventory. |
| No extension | Decor still shows; the still picture sits on top. |

## 7. Testing

- **Vitest:**
  - the catalog;
  - placement actions (copies, spots, one bed, rugs only in the middle, move, remove, project deletion);
  - loading old data and damaged decor;
  - Shop tabs and buying;
  - the inventory tabs and grouping;
  - the placing flow;
  - the habitat drawing decor;
  - `furniture` in `buildPetStatuses`;
  - the extension's parsing and spot positions.
- **Playwright with the real extension:**
  - buy and place a bed and the cat's post;
  - the cat uses the post and naps in the bed;
  - an away pet sleeps in the bed;
  - decor survives a reload.
- `npm test` and `npm run build` must pass.

## Left to the builder

- Item ids, descriptions and the placeholder art (simple SVGs are fine).
- The exact saved shape of placements.
- The spots' exact fractions, the furniture animations, and the timing numbers.

## Calls I made (not discussed in detail)

- **Free default:** "Plain" wallpaper and flooring are free and always available.
- **Medicine:** its **Give** button moves into the inventory's Items tab.
- **Rugs:** only the middle floor spot.
- **Beds:** one per habitat.
- **Spot count:** five spots per habitat.
- **Project deletion:** decor goes back to the inventory.
- **Decor is Studium-only:** it never appears on normal web pages.

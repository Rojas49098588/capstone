# Habitat Decor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Habitat tab in the Shop sells decor. The user places owned copies into fixed slots of any project's habitat from an inventory box under it, and pets use their own furniture there.

**Architecture:**
- **Studium side.**
  - A decor catalog (`store/decor.ts`).
  - One unified notion of **slots**: `wallpaper`, `flooring`, `floorLeft`, `floorMiddle`, `floorRight`, `wallLeft`, `wallRight`.
  - Placements are saved in an optional `StudiumData.decor` map. They're cleaned on load and on cross-tab sync, never rejected.
  - Pure actions in `store/actions.ts`.
  - The Shop gets Supplies | Habitat tabs.
  - The habitat box draws the decor layer.
  - A new Inventory box (Items | Furniture) sits under it. `ProjectDetail` holds the "placing" state the two share.
  - `buildPetStatuses` publishes each pet's usable furniture.
- **Extension side.**
  - `logic.js` parses `furniture` and owns the slot positions. A test keeps them identical to Studium's layout table.
  - `pet.js` gives the habitat pet new activities: walk/fly/hop to its furniture, use it, and nap or sleep in the bed.

**Tech Stack:** React 19, TypeScript 5.9 (strict, lib ES2020), Tailwind v4, Vitest 5 + jsdom, Chrome MV3 plain JS, Playwright (scratch) for the browser check.

**Spec:** `docs/superpowers/specs/2026-10-19-habitat-decor-design.md`. **Builds on:** `feature/pet-interactions` (this branch, `feature/habitat-decor`, starts from it). Read `HANDOFF.md` "Gotchas" first.

## Global Constraints

- Branch `feature/habitat-decor`. Run web commands from `web/`: `npm test`, `npm run build` (type-checks tests too; run it after every task).
- TS lib ES2020 (no `.at`, no `Object.hasOwn`). Components take time from `s.now`; store and planner functions never call `new Date()`.
- `StudiumData.version` stays `1`. `decor` is **optional**: data saved before this round must load unchanged. Damaged decor is cleaned, never a reason to reject or reset the data.
- Decor never changes tokens, progress or mood except through its `purchase` price. Purchases reuse the existing `purchase` event.
- Invariant everywhere: for every item, the copies placed across all habitats ≤ the copies owned (`inventory(events)[id]`). Each slot holds at most one item, and each habitat holds at most one bed.
- Catalog (exact names and prices):
  - **Wallpaper**, 100 each: Sage Stripes, Library Gold, Night Sky.
  - **Flooring**, 90 each: Oak Planks, Stone Tiles, Grass.
  - **Rugs**, 60 each: Round Rug, Striped Runner.
  - **Wall decor**, 40 each: Study Poster, Clock.
  - **Pet Bed**, 150.
  - **Pet furniture**, 200 each: Scratching Post (cat), Heat Lamp (turtle), Perch (pigeon), Mini Sofa (dog), Log (frog).
- Which slots each type may use:
  - wallpaper → `wallpaper`; flooring → `flooring`;
  - rug → `floorMiddle` only;
  - wall decor → `wallLeft`, `wallRight`;
  - Pet Bed and pet furniture → the three floor slots, except the Perch → `wallLeft`, `wallRight`.
- "Plain" wallpaper and flooring = the slot is empty. It's free and always available.
- Art: each item has `image: "decor/<id>.svg"`, served from `web/public/decor/`. Replacing a file (or changing that one string) swaps the art.
- Copy: Shop tabs "Supplies" / "Habitat"; inventory tabs "Items" / "Furniture"; group headings "Wallpaper", "Flooring", "Rugs", "Wall decor", "Beds", "Pet furniture" (Items: "Care", "Food", "Clothes", "Toys"); banner "Placing <name>: pick a free spot in the habitat." with "Cancel"; buttons "Place", "Use here", "Move here", "Remove", "Plain".
- Extension: nothing in `extension/` starts with `_`. `logic.js` stays free of `chrome.*`/DOM. Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Moving the last copy between habitats.** Owning one bed placed in appDev, then "Move here" in webDev, should leave exactly one placed bed. Pinned in Task 2 (`moveDecor keeps the copy count`).
2. **Another tab saves data with damaged or over-owned decor.** The provider should adopt it cleaned, not crash and not keep extra placements. Pinned in Task 2 (`cross-tab data is cleaned too`).
3. **A missing or broken art file.** The habitat should simply not draw that item, and the inventory still lists it by name. Pinned in Task 4 (`hides an item whose image fails to load`).
4. **Phone width (390 px).** The five slots and the inventory should fit without horizontal scrolling. Pinned in Task 8's browser check (`decor fits at 390 px`).
5. **Furniture removed or moved while the pet is using it.** The pet should drop back to the floor and carry on, never hover in mid-air. Pinned in Task 8's browser check (`removing the post mid-scratch lands the cat`) and by `statusesEqual` treating `furniture` as part of the looks (Task 7).

---

## File Structure

```
web/src/
  planner/types.ts           + DecorSlot, HabitatDecor, StudiumData.decor?
  store/decor.ts             NEW: DECOR_ITEMS catalog, DECOR_SLOTS, findDecor, cleanDecor, copy counts
  store/products.ts          + priceOf(id) covering supplies and decor
  store/actions.ts           purchase uses priceOf; + placeDecor, removeDecor, moveDecor; deleteProject drops decor
  store/storage.ts           loadData cleans decor (normalizeData)
  store/useStudium.tsx       cross-tab data cleaned; exposes the three decor actions
  store/petStatus.ts         + furniture
  ui/decorLayout.ts          NEW: SLOT_LAYOUT (fractions), shared with the extension
  ui/format.ts               + copiesLabel
  components/Shop.tsx        Supplies | Habitat tabs
  components/DecorShop.tsx   NEW: Habitat tab contents
  components/HabitatDecor.tsx NEW: wallpaper, flooring, items, slot outlines inside the habitat box
  components/Habitat.tsx     draws HabitatDecor; Give medicine moves out
  components/Inventory.tsx   NEW: Items | Furniture
  components/ProjectDetail.tsx  holds `placing`, renders Inventory under Habitat
  public/decor/*.svg         NEW: 16 placeholder images
  extension/decorLayout.test.ts NEW: extension slot table == Studium's
extension/content/logic.js   + parse furniture, SLOT_POSITIONS, furniturePosition, ownUse
extension/content/pet.js     furniture activities, bed naps, away pet in bed
README.md, HANDOFF.md, spec status   Task 9
```

---

### Task 1: Catalog and buying decor

**Files:** Create `web/src/store/decor.ts`. Modify `web/src/planner/types.ts`, `web/src/store/products.ts`, `web/src/store/actions.ts`. Test: `web/src/store/decor.test.ts` (new), `web/src/store/actions.test.ts`.

**Interfaces:**
- Produces:
  - `type DecorSlot = "wallpaper" | "flooring" | "floorLeft" | "floorMiddle" | "floorRight" | "wallLeft" | "wallRight"`;
  - `type HabitatDecor = Partial<Record<DecorSlot, string>>` (slot → item id; a missing slot is empty, i.e. Plain);
  - `StudiumData.decor?: Record<string, HabitatDecor>` (types.ts);
  - `type DecorType = "wallpaper" | "flooring" | "rug" | "wallDecor" | "bed" | "petFurniture"`;
  - `type FurnitureUse = "bed" | "scratch" | "bask" | "perch" | "lounge"`;
  - `type DecorItem = { id; name; description; type: DecorType; price; image; slots: DecorSlot[]; use?: FurnitureUse; forKind?: PetKind }`;
  - `DECOR_ITEMS: DecorItem[]`, `DECOR_SLOTS: DecorSlot[]` (order above), `DECOR_GROUPS: { type: DecorType; label: string }[]` (headings order from Global Constraints), `findDecor(id)` (decor.ts);
  - `priceOf(id: string): number | undefined` (products.ts).
- Uses per item: bed → `bed`; Scratching Post → `scratch`/cat; Heat Lamp → `bask`/turtle; Perch → `perch`/pigeon; Mini Sofa → `lounge`/dog; Log → `lounge`/frog.

- [ ] **Step 1: Failing tests**
  - `decor.test.ts`:
    - `the catalog has the agreed items and prices`: per-type counts 3/3/2/2/1/5; prices 100/90/60/40/150/200; ids unique; every `image` is `decor/<id>.svg`.
    - `slots follow the type rules`: a rug → `["floorMiddle"]`; Perch → `["wallLeft","wallRight"]`; Heat Lamp → the three floor slots; the furniture uses and kinds as listed.
  - `actions.test.ts`:
    - `buys decor like any product`: `purchase(seed, "pet-bed", NOW)` → ok, balance −150, `inventory(...)["pet-bed"] === 1`.
    - `refuses decor it can't afford` (balance below 200 for a 200 item).
- [ ] **Step 2:** `npm test -- decor actions` → FAIL.
- [ ] **Step 3: Implement.** Ids are kebab-case names (`sage-stripes`, `pet-bed`, `scratching-post`, …). `purchase` uses `priceOf` instead of `findProduct`.
- [ ] **Step 4:** `npm test`, `npm run build` → pass.
- [ ] **Step 5: Commit** `feat(studium): habitat decor catalog and buying decor`

---

### Task 2: Placing decor, and keeping it valid

**Files:** Modify `web/src/store/decor.ts`, `web/src/store/actions.ts`, `web/src/store/storage.ts`, `web/src/store/useStudium.tsx`. Test: `decor.test.ts`, `actions.test.ts`, `storage.test.ts`, `useStudium.test.tsx`.

**Interfaces:**
- Consumes: Task 1 types and catalog.
- Produces (decor.ts):
  - `ownedCopies(data, itemId): number` (from `inventory(data.events)`);
  - `placements(data, itemId): { projectId: string; slot: DecorSlot }[]` (in project order, then `DECOR_SLOTS` order);
  - `freeCopies(data, itemId): number`;
  - `cleanDecor(data: StudiumData): Record<string, HabitatDecor>` — keeps only known projects, known items, allowed slots, the first bed per habitat, and placements up to the owned count (earliest in project and slot order win). Non-object input → `{}`.
  - `normalizeData(data)` (storage.ts) — `{ ...data, decor: cleanDecor(data) }`.
- Produces (actions.ts), each returning the same object when refused:
  - `placeDecor(data, projectId, slot, itemId)` — refused for an unknown project or item, a slot the item can't use, no free copy, or a second bed. When the slot is taken, the old item goes back to the inventory.
  - `removeDecor(data, projectId, slot)`.
  - `moveDecor(data, from: { projectId; slot }, to: { projectId; slot })` — remove, then place; refused (no change) if the place would be refused.
  - `deleteProject` also drops `decor[projectId]`.
- The provider exposes `placeDecor`, `removeDecor` and `moveDecor` (via `change`).

No `now`: these actions append no events.

- [ ] **Step 1: Failing tests** (helper `owning(...ids)` = seed plus one purchase event per id)
  - `placeDecor puts an owned copy in a slot` / `refuses without a free copy` / `refuses a slot the item can't use` (a rug in `floorLeft`) / `refuses a second bed in one habitat` (two beds owned) / `replacing a slot frees the old item` (Sage Stripes → Night Sky, then Sage Stripes can be placed in appDev) / `an unknown project or item changes nothing`.
  - `removeDecor frees the copy`.
  - `moveDecor keeps the copy count`: one bed in appDev `floorLeft` → move to webDev `floorRight` → `placements` is `[{ webDev, floorRight }]`; moving a bed into a habitat that already has one changes nothing.
  - `deleting a project returns its decor`: `freeCopies` goes back up.
  - `cleanDecor drops what isn't valid`: unknown project, unknown item, wrong slot, a second bed, more placed than owned (keeps the first), and `decor: "junk"` → `{}`.
  - `storage.test.ts`: `loads data saved before decor existed` (no `decor` → loads, not damaged); `cleans damaged decor instead of resetting the data` (notice stays `null`, tasks intact).
  - `useStudium.test.tsx`: `cross-tab data is cleaned too` (a `storage` event whose data places an unowned item → `result.current.data.decor` has no placement).
- [ ] **Step 2:** `npm test -- decor actions storage useStudium` → FAIL.
- [ ] **Step 3: Implement.** `loadData` returns `normalizeData(parsed)` for valid data. The provider's `storage` handler adopts `normalizeData(next)`. `isValidData` doesn't look at `decor` at all.
- [ ] **Step 4:** `npm test`, `npm run build` → pass.
- [ ] **Step 5: Commit** `feat(studium): place, move and remove decor; clean saved decor`

---

### Task 3: Shop tabs

**Files:** Create `web/src/components/DecorShop.tsx`. Modify `web/src/components/Shop.tsx`. Test: `web/src/components/Shop.test.tsx`.

**Interfaces:** Consumes `DECOR_ITEMS`, `DECOR_GROUPS`, `s.purchase`.

- [ ] **Step 1: Failing tests**
  - `opens on Supplies with today's products` (existing tests keep passing under the Supplies tab).
  - `the Habitat tab lists decor grouped by type`: click tab `Habitat` → headings `Wallpaper`, `Flooring`, `Rugs`, `Wall decor`, `Beds`, `Pet furniture`; `Scratching Post` shows `For the cat`.
  - `buys decor`: `Buy · 150 tokens` on Pet Bed → balance `500`, `Owned ×1`.
  - `tabs are a tablist` (`role="tab"`, `aria-selected`).
- [ ] **Step 2:** `npm test -- Shop` → FAIL.
- [ ] **Step 3: Implement.**
  - `Shop` keeps its header and balance, and adds a tablist.
  - The Supplies panel is today's sections.
  - The Habitat panel is `<DecorShop />`: the same card style, with the item's `<img src={BASE_URL + image}>` instead of `ProductIcon`. Pet furniture shows "For the <kind>".
  - The tab is kept in component state (it opens on Supplies).
- [ ] **Step 4:** `npm test`, `npm run build` → pass.
- [ ] **Step 5: Commit** `feat(studium): Habitat tab in the Shop`

---

### Task 4: Decor in the habitat box, and placeholder art

**Files:** Create `web/src/ui/decorLayout.ts`, `web/src/components/HabitatDecor.tsx`, `web/public/decor/*.svg` (16 files). Modify `web/src/components/Habitat.tsx`. Test: `web/src/components/Habitat.test.tsx`, `web/src/ui/decorLayout.test.ts` (new).

**Interfaces:**
- Produces:
  - `SLOT_LAYOUT: Record<"floorLeft" | "floorMiddle" | "floorRight" | "wallLeft" | "wallRight", { x: number; y: number; w: number; h: number }>`. These are fractions of the box: `x` is the item's centre from the left; `y` is its bottom edge above the box's bottom; `w`/`h` are its size. Values:

    | Slot | x | y | w | h |
    |---|---|---|---|---|
    | floorLeft | 0.18 | 0.04 | 0.2 | 0.32 |
    | floorMiddle | 0.5 | 0.02 | 0.3 | 0.16 |
    | floorRight | 0.82 | 0.04 | 0.2 | 0.32 |
    | wallLeft | 0.14 | 0.5 | 0.14 | 0.28 |
    | wallRight | 0.86 | 0.5 | 0.14 | 0.28 |

  - `<HabitatDecor projectId placing onPickSlot />`, where `placing: { itemId: string } | null` and `onPickSlot(slot)`.
  - `Habitat` props gain `placing?` and `onPickSlot?` (passed through).

- [ ] **Step 1: Failing tests**
  - `decorLayout.test.ts`: every slot is inside the box (`x ± w/2` within 0–1, `y + h` ≤ 1); floor slots don't overlap each other.
  - `Habitat.test.tsx`:
    - `draws placed decor`: data with Oak Planks in `flooring` and a Pet Bed in `floorLeft` → an `img` named `Pet Bed`; the box's flooring layer uses `decor/oak-planks.svg`.
    - `outlines the free slots while placing`: `placing={{ itemId: "pet-bed" }}` → buttons `Put Pet Bed in the left floor spot`, `… middle …`, `… right …` (none for wall slots; none for a taken slot); clicking one calls `onPickSlot("floorRight")`.
    - `hides an item whose image fails to load`: fire `error` on the bed's `img` → no `img` named `Pet Bed`.
    - existing tests still pass, except "gives medicine…", which Task 5 moves.
- [ ] **Step 2:** `npm test -- decorLayout Habitat` → FAIL.
- [ ] **Step 3: Implement.**
  - `HabitatDecor` is absolutely positioned at `inset-0` inside the `data-pet-habitat` box, behind the still picture and the away line.
  - The wallpaper is a CSS background (repeat) over the wall area. The flooring goes on the existing floor strip.
  - Items go in their slots as `img` with `alt` = the item's name and `onError` → hide.
  - Slot outline buttons use accessible names `Put <item> in the <left|middle|right> floor spot` / `… <left|right> wall spot`.
  - Placeholder SVGs are simple flat shapes in the project palette, each labelled with its name in a `<title>`. Wallpaper and flooring SVGs are seamless tiles.
- [ ] **Step 4:** `npm test`, `npm run build` → pass.
- [ ] **Step 5: Commit** `feat(studium): draw habitat decor with placeholder art`

---

### Task 5: The inventory box and placing flow

**Files:** Create `web/src/components/Inventory.tsx`. Modify `web/src/components/ProjectDetail.tsx`, `web/src/components/Habitat.tsx` (medicine button out), `web/src/ui/format.ts`. Test: `web/src/components/Inventory.test.tsx` (new), `ProjectDetail.test.tsx`, `Habitat.test.tsx`, `format.test.ts`.

**Interfaces:**
- Consumes: Task 2 actions and counts; Task 4 `placing`/`onPickSlot`.
- Produces:
  - `copiesLabel(here: number, elsewhere: { shortName: string; count: number }[], free: number): string` → for example `"1 here · 1 in appDev · 1 free"` (parts with 0 are left out; nothing at all → `"none"`).
  - `<Inventory projectId placing onPlace(itemId) onCancel />`.
  - `ProjectDetail` holds `placing` and wires both.

- [ ] **Step 1: Failing tests**
  - `format.test.ts`: `copiesLabel` cases above.
  - `Inventory.test.tsx`:
    - `Items lists supplies by type with Give for Medicine`: owning Medicine and Berry Bites on Sick seniorCap → headings `Care`, `Food`; `Give medicine (1 left)` cures (the moved test).
    - `Furniture lists owned decor by type with where the copies are`.
    - `an empty tab points to the Shop`.
    - `Use here and Plain set the wallpaper`: owned Sage Stripes → `Use here` → saved `decor.webDev.wallpaper === "sage-stripes"`; `Plain` clears it.
    - `Move here takes a copy from another habitat` (only copy is in appDev).
    - `Remove sends it back`.
  - `ProjectDetail.test.tsx`: `placing flow`: owning a Pet Bed → `Place` → banner `Placing Pet Bed: pick a free spot in the habitat.` → click `Put Pet Bed in the right floor spot` → saved in `floorRight`, banner gone. Also `Cancel` and Escape end placing.
  - `Habitat.test.tsx`: the side panel no longer has `Give medicine`, but still shows `Buy medicine in the Shop` when sick with none.
- [ ] **Step 2:** `npm test -- format Inventory ProjectDetail Habitat` → FAIL.
- [ ] **Step 3: Implement.**
  - **Layout:** `Inventory` is a `CARD` under the Habitat, with a tablist (Items opens first).
  - **Items:** grouped by `ShopCategory` in the Shop's order.
  - **Furniture:** grouped by `DECOR_GROUPS`, and only items owned ≥ 1.
  - **Wallpaper and flooring:** rows offer `Use here` when a copy is free (or `Move here`), plus one `Plain` button per group when this habitat has one set.
  - **Spot items:** `Place` when free, which calls `onPlace(itemId)`; `Move here` when none are free. Move here starts placing with `from` = that copy, and the slot pick calls `moveDecor`. `Remove` appears for copies in this habitat.
  - **Picking a slot:** `ProjectDetail` calls `placeDecor` (or `moveDecor` when `placing.from` is set), then clears `placing`. The banner is part of `Inventory` while `placing` is set.
- [ ] **Step 4:** `npm test`, `npm run build` → pass.
- [ ] **Step 5: Commit** `feat(studium): inventory under the habitat with placing`

---

### Task 6: Pets learn about their furniture

**Files:** Modify `web/src/store/petStatus.ts`. Test: `web/src/store/petStatus.test.ts`.

**Interfaces:** Produces `PetStatus.furniture: { use: FurnitureUse; slot: DecorSlot }[]`: the habitat's bed (any kind) plus pet furniture whose `forKind` is the project's `petKind`, in `DECOR_SLOTS` order.

- [ ] **Step 1: Failing tests**
  - `lists the bed and the pet's own furniture`: seniorCap (cat) with a Pet Bed in `floorLeft`, a Scratching Post in `floorRight` and a Perch in `wallLeft` → `[{ use: "bed", slot: "floorLeft" }, { use: "scratch", slot: "floorRight" }]`.
  - `no decor, no furniture` → `[]`.
- [ ] **Step 2:** `npm test -- petStatus` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** `npm test`, `npm run build` → pass.
- [ ] **Step 5: Commit** `feat(studium): publish each pet's furniture`

---

### Task 7: Extension logic for furniture

**Files:** Modify `extension/content/logic.js`. Test: `web/src/extension/decorLayout.test.ts` (new), `web/src/extension/petInteractions.test.ts`.

**Interfaces:**
- Produces on `PetLogic`:
  - `SLOT_POSITIONS`: the same five slots and numbers as `SLOT_LAYOUT`;
  - `FURNITURE_USES = ['bed', 'scratch', 'bask', 'perch', 'lounge']`;
  - `KIND_USE = { cat: 'scratch', turtle: 'bask', pigeon: 'perch', dog: 'lounge', frog: 'lounge' }`;
  - `parseStatuses` → each pet gets `furniture` (valid entries only; missing → `[]`);
  - `statusesEqual` → **does** compare `furniture` (a change rebuilds the habitat pet so it knows);
  - `ownFurniture(petKind, furniture)` → the entry whose `use` is `KIND_USE[petKind]`, or `null`;
  - `bedOf(furniture)` → the bed entry or `null`;
  - `furnitureSpot(entry, world, petW)` → `{ x, y }` in the pet's world coordinates (left-wall x of the pet, height above the floor):
    - `x = slot.x * world.width - petW / 2`, clamped to the world;
    - `y`: floor slots → `SEAT[use] * world.height`, with `SEAT = { bed: 0.06, lounge: 0.14, scratch: 0, bask: 0 }`; wall slots (perch) → `(slot.y + slot.h * 0.35) * world.height`.

- [ ] **Step 1: Failing tests**
  - `decorLayout.test.ts` imports both: `PetLogic.SLOT_POSITIONS` deep-equals `SLOT_LAYOUT`.
  - `petInteractions.test.ts`:
    - `parseStatuses reads furniture and drops damaged entries` (`use: "dance"`, `slot: "roof"`, non-array → `[]`).
    - `statusesEqual notices furniture changes`.
    - `ownFurniture picks the pet's own use` (frog gets `lounge`, the cat ignores a `perch`).
    - `bedOf`.
    - `furnitureSpot`: world 600×224, petW 46: bed at floorLeft → `{ x: 85, y: 13.44 }`; perch at wallRight → `{ x: 493, y: ≈133.95 }` (`toBeCloseTo`); clamped at the edges.
- [ ] **Step 2:** `npm test -- decorLayout petInteractions` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** `npm test`, `npm run build` → pass.
- [ ] **Step 5: Commit** `feat(extension): furniture positions and parsing`

---

### Task 8: Pets use their furniture

**Files:** Modify `extension/content/pet.js`. Test: existing jsdom tests still pass; scratch Playwright `decor-check.mjs`.

**Interfaces:** Consumes Task 7.

- [ ] **Step 1: Implement**
  - **Tuning:** add to `KINDS`:
    - `furnitureChance` (0.3 for every kind);
    - `furnitureMs`: cat scratch `[2000, 3000]`, turtle bask `[20000, 40000]`, pigeon perch `[8000, 15000]`, dog lounge `[8000, 15000]`, frog lounge `[8000, 15000]`.
  - **Only in the box:** furniture is used only while the pet is in its habitat box (`box !== null`), from `status.furniture`.
  - **New modes:**
    - `'goto'`: walk to a target x; the frog hops there, and the pigeon flies to a target x/y. It ends by running the planned activity.
    - `'use'`: hold the spot until `useUntil`, with no gravity. It ends with `mode = 'fall'` so a raised pet drops back to the floor.
  - **Choosing what to do:** `act()` first rolls `furnitureChance` for `ownFurniture`. The cat's nap roll walks to `bedOf` first and sleeps there (at the bed's `y`) when there is a bed.
  - **Classes:** `scratching` (a quick side-to-side wiggle), `basking` (a warm drop-shadow glow), `lounging` (same as `sleeping`, without the "Zzz").
  - **Away pet:** `setAway(true)` with a bed in the box puts the pet at the bed's spot.
  - **Interruptions:** dragging, a click hop and `leaveBox` cancel any activity. A rebuild (furniture changed) starts the pet fresh.
- [ ] **Step 2:** `npm test`, `npm run build`, `node --check ../extension/content/pet.js` → pass.
- [ ] **Step 3: Browser check** (scratch, the same setup as `ext-check.mjs`). Each check prints PASS/FAIL:
  1. `buy and place a bed and the cat's post` through the Shop and the seniorCap inventory.
  2. `decor survives a reload`.
  3. `the cat uses its post` within 90 s (class `scratching`, x near floorRight).
  4. `an away cat sleeps in the bed` (Sleep 1 h from the menu → x near the bed slot, `y > 0`).
  5. `the pigeon sits on its perch` (place a Perch in webDev; within 90 s, `y` near the perch spot).
  6. `removing the post mid-scratch lands the cat` (y back to 0 within 2 s).
  7. `decor fits at 390 px` (viewport 390×844: no horizontal scroll, all slot images inside the box).
  8. `no page errors`.
- [ ] **Step 4: Commit** `feat(extension): pets use their habitat furniture`

---

### Task 9: Docs and final check

- [ ] **Step 1:**
  - **README:** Shop tabs, placing decor, swapping the art in `web/public/decor/`.
  - **HANDOFF:** a status row; code-map entries for `decor.ts`, `decorLayout.ts`, `Inventory`, `HabitatDecor`; the decisions (unified slots, cleaned-not-rejected decor, no `now` on decor actions).
  - **Spec status:** "Approved; implemented by `docs/superpowers/plans/2026-10-19-habitat-decor.md`."
- [ ] **Step 2:** `npm test`, `npm run build` → pass.
- [ ] **Step 3: Commit** `docs: habitat decor`

---

## Coverage map (spec → task)

| Spec | Task |
|---|---|
| Catalog, prices, art files | 1, 4 |
| Spots, rules, copies, move, remove, plain, project deletion | 2, 5 |
| Data shape, optional, cleaned on load | 2 |
| Shop tabs | 3 |
| Inventory Items / Furniture, Medicine Give | 5 |
| Habitat drawing, placing outlines, still picture on top | 4 |
| `PetStatus.furniture`, shared geometry, old statuses | 6, 7 |
| Bed naps, away pet in bed, per-kind furniture, ignore others, drag interrupts | 8 |
| Error handling table | 2, 4, 8 |
| Testing | all; browser check in 8 |

**Ruling vs the spec:** the spec says placement actions "take `now`". They append no events and use no time, so they don't take it, the same as `togglePriority`.

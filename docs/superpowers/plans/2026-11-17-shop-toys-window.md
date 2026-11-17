# More food, working toys, and a window: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** add 6 new foods (with flavors, a favorite flavor per kind of pet, and cheap bland foods),
remove clothes and the Puzzle Cube with a full refund, make two toys work on the desktop pets, and
add a Window decor item that follows the computer's clock.

**Architecture:**
- The food rules stay in the planner, as plain functions of events and `now`. A food catalog in
  `web/src/planner/foods.ts` replaces the two hard-coded product ids.
- The refund is worked out from purchases that already exist. No new record is saved.
- Studium tells the desktop pets which toys the user owns and when a pet last ate its favorite food,
  through `PetStatuses`. Toys live in the shared `extension/content/pet.js` and only appear on the
  `overlay` surface.
- The window is a decor item. The habitat draws its sky and the room's light from `dayPeriod(now)`.

**Tech stack:**
- React, TypeScript and Vitest (`web/`).
- Vanilla JavaScript pet scripts (`extension/content/`), tested from `web/src/extension/*.test.ts`
  with jsdom.
- Electron (`desktop/`).

**Spec:** `docs/superpowers/specs/2026-11-17-shop-toys-window-design.md`. Read its "Settled after the
builder check" section too.

**Branch:** `feature/shop-toys-window`, created from `docs/roadmap-schedule`, which holds the spec.

## Global constraints

- **Tests:** `cd web && npx vitest run` and `cd desktop && npx vitest run` must pass after every task.
  The phone also uses `web/src/companion/view.ts`, so `cd mobile && npx jest` must pass after Task 3.
- **Food never helps a Sick or Recovering pet.** Food never changes the planner's mood, the schedule,
  or the neglect clock. A snack only changes the mood the pet shows.
- **Every snack's lift must end before the next snack is allowed,** including Meaty Stew's shorter
  wait.
- **No food returns as many tokens as it costs**, counting its instant tokens and the favorite gift
  together.
- **Toys never give tokens, mood or progress.**
- **Old saves keep loading.** That includes `fed` events without `tokens`, purchases of the removed
  products, and statuses without `toys` or `favoriteFedAt`.
- **Numbers live in `web/src/planner/tuning.ts` or the food catalog**, never in components.
- **Placeholder art is one file per image**, referenced from one place, so replacing it needs no code
  change.
- **Commit trailer:** `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Gate before Task 8 (toys)

Investigate the overdue bug "Desktop: pets and sticky notes stop responding to clicks" (`bugs.md`)
with superpowers:systematic-debugging. That investigation is separate work and is not a task in this
plan. Tasks 8–10 start once it is fixed, or once it is ruled out as something toys could make worse.

## Review focus

1. **An old save with a running Berry Bites or Power Bento effect** keeps the same lift (2 h) and boost
   (× 1.1, Bento extends). Covered in Task 1.
2. **Two pets on one project eating different meals** (Salad, then Bento) earn the higher boost, then
   fall back to the lower one, with no multiplying. Covered in Task 1.
3. **Local midnight:** the Salad boost and Stew's shorter wait end at 00:00, and the meal limit resets.
   Covered in Task 1, with tests at 23:59 and 00:00.
4. **A save that bought clothes:** the balance goes up by exactly what was paid, the inventory no longer
   lists them, and the notice shows once. Covered in Task 2.
5. **A toy whose pet goes away** (project deleted, pet asleep or hidden) is removed, and right-clicking
   a pet still works after a toy was put away. Covered in Task 8.

---

### Task 1: Food catalog and rules

**Files:**
- Create: `web/src/planner/foods.ts`
- Modify: `web/src/planner/food.ts`, `web/src/planner/value.ts:101`, `web/src/planner/tuning.ts` (the food block)
- Test: `web/src/planner/food.test.ts`

**Interfaces:**
- Produces, in `foods.ts`:
  ```ts
  export type Flavor = "sweet" | "savory" | "sour" | "seedy" | "leafy" | "meaty" | "bland";
  export type FoodEffect =
    | { type: "lift"; hours: number }                         // shown mood +1 step
    | { type: "tokens"; tokens: number }                      // instant tokens
    | { type: "boost"; multiplier: number; hours: number; extends: boolean } // project tokens
    | { type: "boostToday"; multiplier: number }              // until local midnight
    | { type: "snackWait"; hours: number };                   // this pet's snack wait until local midnight
  export type FoodSpec = { id: string; kind: FoodKind; flavor: Flavor; price: number; effect: FoodEffect };
  export const FOODS: FoodSpec[];
  export const FAVORITE_FLAVOR: Record<PetKind, Flavor>;
  export function findFood(productId: string): FoodSpec | undefined;
  export function isFavorite(productId: string, petKind: PetKind): boolean;
  ```
- Produces, in `food.ts`:
  - `canFeed(data, pet, mood, productId: string, now)`: the 4th parameter was `kind`.
  - `snackLiftUntil(events, petId, now)`: the same signature, but uses the last snack's own lift hours.
  - `snackWaitHours(events, petId, now): number`.
  - `runningBoosts(events, projectId, now): { productId: string; multiplier: number; until: Date }[]`.
  - `mealMultiplier(events, projectId, now): number`.
  - `mealBoostUntil` stays, and returns the end of the highest running boost.
  - `foodKind(productId)` now reads the catalog.

The catalog values, copied from the spec:

| id | kind | flavor | price | effect |
|---|---|---|---|---|
| `plain-crackers` | snack | bland | 10 | lift 1 h |
| `berry-bites` | snack | sweet | 35 | lift 2 h |
| `sour-gummies` | snack | sour | 40 | tokens 15 |
| `seed-crunch` | snack | seedy | 50 | lift 2.25 h |
| `plain-rice` | meal | bland | 15 | boost × 1.03, 4 h, extends: false |
| `power-bento` | meal | savory | 60 | boost × 1.1, 4 h, extends: true |
| `garden-salad` | meal | leafy | 55 | boostToday × 1.05 |
| `meaty-stew` | meal | meaty | 50 | snackWait 2.5 h |

`FAVORITE_FLAVOR`: cat savory, dog meaty, frog sour, pigeon seedy, turtle leafy.

In `tuning.ts`:
- Remove `SNACK_PRODUCT_ID`, `MEAL_PRODUCT_ID`, `SNACK_HOURS`, `MEAL_HOURS` and `MEAL_TOKEN_MULTIPLIER`
  once nothing uses them. Their values now live in the catalog.
- Keep `SNACK_WAIT_HOURS = 3`.
- Add `FAVORITE_BONUS_SHARE = 0.2`.

- [ ] **Step 1: Write the failing tests** in `food.test.ts`. Keep the existing tests and update the
  ones that pass `"snack"` or `"meal"` to pass product ids.
  - `it("every snack's lift ends before the shortest snack wait")`: for each food with a `lift` effect,
    `hours` < 2.5 and < `SNACK_WAIT_HOURS`.
  - `it("no food pays back its price")`: for each food and each `PetKind`,
    `instantTokens + (isFavorite ? Math.floor(price * FAVORITE_BONUS_SHARE) : 0) < price`.
  - `it("bland food uses up the snack and the meal slot")`:
    - Feed Plain Crackers at 09:00. `canFeed(..., "berry-bites", 10:00)` is refused with reason `"wait"`
      and `nextAt` 12:00.
    - Feed Plain Rice. `canFeed(..., "power-bento", same day)` is refused with `"wait"` and `nextAt`
      the next local midnight.
  - `it("Sour Gummies can be fed to a Happy pet but not a Sick one")`: ok when the mood is Happy, and
    refused `"sick"` when the pet is sick.
  - `it("a lifting snack still needs a Worried or Upset pet")`: Seed Crunch fed to a Happy pet is
    refused `"not-hungry"`.
  - `it("lift length follows the snack eaten")`:
    - Crackers at 09:00: lifted at 09:59, not at 10:00.
    - Seed Crunch at 09:00: lifted at 11:14, not at 11:15.
  - `it("Meaty Stew shortens this pet's snack wait until midnight")`:
    - Stew at 08:00 and Berry at 09:00: the next snack is allowed at 11:30.
    - The next day, the wait is 3 h again.
    - Another pet on the same project still waits 3 h.
  - `it("the highest running boost counts, not the product")`:
    - Salad at 09:00 (pet A) and Bento at 10:00 (pet B) on the same project.
    - `mealMultiplier` is 1.1 at 11:00, 1.05 at 14:30, and 1 at 00:00 the next day.
  - `it("only Bento extends a running Bento")`:
    - Bento A at 09:00 and Bento B at 10:00: the boost runs until 17:00.
    - Rice at 09:00 and Bento at 10:00: the Rice boost ends at 13:00 and the Bento boost at 14:00.
  - `it("an old save's Berry Bites and Power Bento behave as before")`: use `fed` events without
    `tokens`. The lift lasts 2 h, the boost is × 1.1, and a second Bento extends it by 4 h.
  - `it("value uses the meal multiplier")`: a task completed during a Salad boost has
    `breakdown.foodMultiplier === 1.05`.

- [ ] **Step 2: Run** `cd web && npx vitest run src/planner/food.test.ts`. Expected: FAIL (`foods.ts`
  doesn't exist yet).
- [ ] **Step 3: Implement** `foods.ts`, then the `food.ts` functions above. In `value.ts:101`, use
  `mealMultiplier`.
  - A snack's lift and wait come from the pet's **last** snack event at or before `now`.
  - The wait is `2.5` when the pet ate a `snackWait` food earlier on `localDateKey(now)`'s day, and
    `SNACK_WAIT_HOURS` otherwise.
  - `canFeed` refuses `"not-hungry"` only for `lift` foods. It counts `"none-owned"` per product id.
  - `extendsBoost` is true only for an `extends: true` food while a boost from that same product is
    running on the project.
- [ ] **Step 4: Fix the callers** so that `npx tsc --noEmit -p web` is clean:
  - `web/src/components/FoodPanel.tsx`: Task 3 rewrites it, so the smallest change is fine here.
  - `web/src/companion/view.ts`.
  - `web/src/store/actions.ts` `feedPet`: now `canFeed(..., productId, ...)`.
- [ ] **Step 5: Run** `cd web && npx vitest run` and `cd mobile && npx jest`. Expected: PASS.
- [ ] **Step 6: Commit** with the message `feat(food): food catalog with flavors, bland foods and per-food rules`.

### Task 2: Food tokens, favorite bonus, and the clothes refund

**Files:**
- Modify:
  - `web/src/planner/types.ts:110` (the `fed` event gets `tokens?: number`)
  - `web/src/planner/history.ts` (`tokenBalance`, `inventory`, new `retiredRefund`)
  - `web/src/planner/tuning.ts` (`RETIRED_PRODUCT_IDS`)
  - `web/src/store/actions.ts` (`feedPet`)
  - `web/src/store/storage.ts:109` (validate optional `tokens`)
  - `web/src/store/products.ts`
  - `web/src/store/useStudium.tsx` (the refund notice)
- Test: `web/src/planner/food.test.ts`, `web/src/store/actions.test.ts`, `web/src/planner/history.test.ts`, `web/src/store/storage.test.ts`

**Interfaces:**
- Consumes `findFood` and `isFavorite` (Task 1).
- Produces:
  - `feedTokens(productId: string, petKind: PetKind): number` in `food.ts`. It returns the instant
    tokens plus `Math.floor(price * FAVORITE_BONUS_SHARE)` when the food is the pet's favorite.
  - `RETIRED_PRODUCT_IDS = ["scholar-scarf", "rainy-day-coat", "puzzle-cube"]`.
  - `retiredRefund(events): { tokens: number; count: number }`.
  - `SHOP_PRODUCTS` without the retired products, with the 8 foods (price from `findFood`), and with
    `robo-mouse` (Toys, 120).
  - `ShopProduct` gains `image?: string`, a path under `web/public/`. Task 3 fills these in.
  - `ShopCategory` loses `"Clothes"`.

- [ ] **Step 1: Write the failing tests.**
  - `feedTokens("sour-gummies", "frog") === 23`, `feedTokens("sour-gummies", "cat") === 15`,
    `feedTokens("power-bento", "cat") === 12`, and `feedTokens("berry-bites", "frog") === 0`.
  - `feedPet` records `tokens` on the `fed` event, and `tokenBalance` goes up by that amount. A frog
    fed Sour Gummies gets +23. An old `fed` event without `tokens` adds 0.
  - A save that bought a Scholar Scarf at 120 and two Rainy-Day Coats at 180:
    - `tokenBalance` equals the same save without those purchases.
    - `inventory` has no `scholar-scarf` or `rainy-day-coat`.
    - `retiredRefund` returns `{ tokens: 480, count: 3 }`.
  - `loadData` accepts a `fed` event with `tokens: 23` and one without, and rejects `tokens: "x"`.
  - `SHOP_PRODUCTS` has no `"Clothes"` item, includes `robo-mouse`, and has 8 `Food` items whose prices
    match `FOODS`.
- [ ] **Step 2: Run** `cd web && npx vitest run src/planner src/store`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - **`tokenBalance`:** skip purchases whose `productId` is retired, and add `e.tokens ?? 0` for `fed`
    events.
  - **`inventory`:** skip retired purchases.
  - **Food effect texts:** give the 6 new foods' `effect` text in `products.ts` exactly as follows:
    - Plain Crackers: "Lifts a Worried or Upset pet's mood one step for 1 hour. Uses the pet's snack. Doesn't help a Sick pet."
    - Sour Gummies: "Gives you 15 tokens right away. Uses the pet's snack. Doesn't help a Sick pet."
    - Seed Crunch: "Lifts a Worried or Upset pet's mood one step for 2 h 15 min. One snack every 3 hours. Doesn't help a Sick pet."
    - Plain Rice: "Tasks on this pet's project earn × 1.03 tokens for 4 hours. Uses the pet's meal for the day."
    - Garden Salad: "Tasks on this pet's project earn × 1.05 tokens until midnight. One meal a day."
    - Meaty Stew: "This pet can have a snack every 2 h 30 min instead of 3 hours, until midnight. One meal a day."
  - **Descriptions** are the builder's call. The Robo Mouse's is "A wind-up mouse your pet loves to
    chase."
  - **Refund notice:** when `retiredRefund(...).count > 0` and the device flag `studium.refundNoticeSeen`
    isn't set, show it through the existing `notice`: "Clothes are gone for now, so you got N tokens
    back." Set the flag when it's dismissed.
- [ ] **Step 4: Run** `cd web && npx vitest run`. Expected: PASS. Also run `cd mobile && npx jest`.
- [ ] **Step 5: Commit** with the message `feat(food): instant tokens and favorite bonus; refund removed clothes`.

### Task 3: Food in the Shop and the habitat, with placeholder art

**Files:**
- Create: `web/public/food/<id>.svg` (8 files, one for each food in the catalog)
- Modify: `web/src/components/Shop.tsx`, `web/src/components/FoodPanel.tsx`, `web/src/companion/view.ts`, `web/src/store/products.ts` (`image` paths)
- Test: `web/src/components/Shop.test.tsx`, a new `web/src/components/FoodPanel.test.tsx`, `mobile/src/shared.test.ts` (if wording changes)

**Interfaces:**
- Consumes `canFeed(…, productId, …)`, `runningBoosts`, `snackLiftUntil`, `snackWaitHours` and
  `FAVORITE_FLAVOR` (Task 1), and `SHOP_PRODUCTS` with `image` (Task 2).
- Produces `flavorLabel(flavor: Flavor): string` in `foods.ts`, for example `"Sour"`.

- [ ] **Step 1: Write the failing tests.**
  - **Shop:**
    - Each Food card shows its flavor label, for example "Sour", and its image.
    - There's no Clothes section.
  - **FoodPanel:**
    - The panel shows a "Loves sour food" line for a frog.
    - It shows a feed button for each food the user owns (none for foods they don't own), and a
      "Buy food in the Shop" button when they own none.
    - Favorite foods are marked "♥ Favorite".
    - While a Salad boost runs, it shows "Meal: × 1.05 tokens until midnight".
    - While a Bento boost runs, it shows "Meal: × 1.1 tokens for 2h 45m more", in the existing
      duration style.
    - After a Stew, it shows "Snacks every 2h 30m today".
    - A disabled button keeps today's refusal wording.
  - **Companion `petGroups`:** the meal line names the running multiplier. Existing Bento lines are
    unchanged.
- [ ] **Step 2: Run** `cd web && npx vitest run src/components/Shop.test.tsx src/components/FoodPanel.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - The FoodPanel lists owned foods grouped as Snacks and Meals, in catalog order.
  - The placeholder SVGs follow the style of `web/public/decor/*.svg`: simple flat shapes, about
    64×64, with a transparent background.
- [ ] **Step 4: Run** `cd web && npx vitest run` and `cd mobile && npx jest`. Expected: PASS.
- [ ] **Step 5: Commit** with the message `feat(food): flavors and favorites in the Shop and habitat; food art placeholders`.

### Task 4: Time of day and the Window item

**Files:**
- Create:
  - `web/src/planner/timeOfDay.ts`
  - `web/public/decor/window.svg` (the frame)
  - `web/public/decor/window-sky-{sunrise,day,sunset,night}.svg`
- Modify: `web/src/store/decor.ts` (the `window` item), `web/src/components/HabitatDecor.tsx`, `web/src/components/Habitat.tsx`, `web/src/index.css` (the cloud and shooting-star animation, plus `prefers-reduced-motion`)
- Test: `web/src/planner/timeOfDay.test.ts`, `web/src/components/Habitat.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  export type DayPeriod = "sunrise" | "day" | "sunset" | "night";
  export function dayPeriod(now: Date): DayPeriod;          // local time
  export const ROOM_TINT: Record<DayPeriod, string | null>; // CSS color with alpha; day = null
  export function hasPlacedWindow(decor: HabitatDecor | undefined): boolean;
  ```
- The decor item is `item("window", "Window", <description>, "wallDecor", 80, WALL)`, with the image
  `decor/window.svg`.

- [ ] **Step 1: Write the failing tests.**
  - **`dayPeriod`:**
    - 05:59 is night, 06:00 is sunrise, 07:59 is sunrise, and 08:00 is day.
    - 17:59 is day, 18:00 is sunset, 19:59 is sunset, and 20:00 is night.
  - **`ROOM_TINT`:** `day` is `null`, and the others are strings.
  - **`hasPlacedWindow`:** true for `{ wallLeft: "window" }`, and false for `{}` and
    `{ wallLeft: "clock" }`.
  - **Habitat:**
    - With a placed window and `now` at 22:00, the room has a tint layer
      (`data-testid="room-tint"`) and the window shows the night sky (`data-period="night"`).
    - At 12:00 there's no tint layer.
    - With no window placed at 22:00, there's no tint layer.
    - With two windows placed, there's exactly one tint layer.
    - The pet status panel is outside the tint layer.
- [ ] **Step 2: Run** `cd web && npx vitest run src/planner/timeOfDay.test.ts src/components/Habitat.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - The habitat reads `now` from `useStudium` (it already refreshes on a timer).
  - The window draws the sky SVG for the period inside the frame. The day sky has drifting clouds and
    the night sky has an occasional shooting star, both as CSS animations that are turned off under
    `prefers-reduced-motion: reduce`.
  - The tint is an absolutely positioned layer over the wallpaper, floor and decor, with
    `pointer-events: none` and a `transition` on its color.
  - Whether pets are tinted is the builder's call.
- [ ] **Step 4: Run** `cd web && npx vitest run`. Expected: PASS.
- [ ] **Step 5: Commit** with the message `feat(habitat): Window decor that follows the clock; the room dims at night`.

### Task 5: Statuses carry owned toys and the favorite-food moment

**Files:**
- Modify: `web/src/store/petStatus.ts`, `extension/content/logic.js` (`parseStatuses`, `cleanStatus`)
- Test: `web/src/store/petStatus.test.ts` (or wherever `buildPetStatuses` is tested), `web/src/extension/petLogic.test.ts`

**Interfaces:**
- Produces:
  - `PetStatuses = { updatedAt; pets; toys: string[] }`. `toys` holds the owned toy ids, in
    `TOY_PRODUCT_IDS` order.
  - `PetStatus.favoriteFedAt: string | null`: the `at` of this pet's latest `fed` event whose food is
    its favorite.
  - `TOY_PRODUCT_IDS = ["focus-ball", "robo-mouse"]` in `tuning.ts`.
  - `parseStatuses` returns `toys` (only known ids, `[]` when missing) and `favoriteFedAt` (a string or
    `null`).

- [ ] **Step 1: Write the failing tests.**
  - `buildPetStatuses`:
    - With a bought Focus Ball, `toys` is `["focus-ball"]`. With nothing bought, it's `[]`.
    - A frog fed Sour Gummies has `favoriteFedAt` set to that event's `at`.
    - A frog fed Berry Bites has `null`.
  - `parseStatuses`:
    - An old status JSON with no `toys` gives `toys: []` and `favoriteFedAt: null`.
    - `toys: ["focus-ball", "bogus", 3]` gives `["focus-ball"]`.
- [ ] **Step 2: Run** the two test files. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `cd web && npx vitest run` and `cd desktop && npx vitest run`. Expected: PASS.
- [ ] **Step 5: Commit** with the message `feat(pets): statuses carry owned toys and when a pet ate its favorite`.

### Task 6: Favorite-food heart on the pets

**Files:**
- Modify: `extension/content/pet.js`, `extension/content/logic.js`
- Test: a new `web/src/extension/petFavoriteScript.test.ts`, using the same harness style as
  `petChaseScript.test.ts`

**Interfaces:**
- Consumes `favoriteFedAt` (Task 5).
- Produces `L.favoriteHeartText = "♥"`.
- When a status arrives with a newer `favoriteFedAt` than the one the pet last showed, the pet says "♥"
  for about 2.5 s. This works on every surface, the habitat included.
- A `favoriteFedAt` older than 1 minute when first seen, for example after a restart, doesn't show.

- [ ] **Step 1: Write the failing test.**
  - Load statuses with `favoriteFedAt: null`, then push one stamped `now`. The pet's bubble shows "♥".
  - Pushing the same stamp again doesn't show it again.
  - A stamp 5 minutes old at the first load doesn't show.
- [ ] **Step 2: Run** `cd web && npx vitest run src/extension/petFavoriteScript.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Follow how `celebrate` notices a new `celebration`.
- [ ] **Step 4: Run** `cd web && npx vitest run`. Expected: PASS.
- [ ] **Step 5: Commit** with the message `feat(pets): a heart when a pet eats its favorite food`.

### Task 7: Docs for the food and window work

**Files:**
- Modify: `HANDOFF.md`, `docs/ROADMAP.md`

- [ ] **Step 1: Update `HANDOFF.md`.** Add a section covering:
  - the food catalog and where its numbers live;
  - the derived refund and its notice flag;
  - the window and `dayPeriod`;
  - `toys` and `favoriteFedAt` in the statuses.
- [ ] **Step 2: Update `docs/ROADMAP.md`.** Mark the food and window parts as done.
- [ ] **Step 3: Commit** with the message `docs: handoff and roadmap for food and the window`.

**The gate applies here: Tasks 8–10 start only after the click-bug investigation.**

### Task 8: Toys menu, summon, and put away (desktop overlay)

**Files:**
- Modify: `extension/content/logic.js` (`petMenuItems`), `extension/content/pet.js`
- Test: `web/src/extension/petLogic.test.ts`, a new `web/src/extension/petToysScript.test.ts`

**Interfaces:**
- Consumes `statuses.toys` (Task 5).
- Produces:
  - `petMenuItems(petId, petAway, statuses, toys)`, where
    `toys: { owned: string[]; out: string | null } | null`. `null` means this surface has no toys, so
    there's no Toys item.
  - The items:
    - **With toys:** `{ id: "toys", label: "Toys", children: owned.map(id => ({ id: "toy:" + id, label: <product name> })) }`.
    - **With none:** `{ id: "toys", label: "Toys", disabled: true, hint: "Buy toys in the Shop" }`.
    - **While a toy is out:** add `{ id: "toy:away", label: "Put away" }` after Toys.
    - **For an away pet:** no Toys item.
  - Toy names live in `logic.js`: `TOY_NAMES = { "focus-ball": "Focus Ball", "robo-mouse": "Robo Mouse" }`.
  - `pet.js` passes `toys` only when `PetSurface === "overlay"`.
  - A toy is a DOM element inside the pets' shadow root (so `desktop/src/overlay/mouse.js` already
    treats it as "over a pet"), with the class `pet-toy` and `data-toy=<id>`. It uses the image
    `extension/assets/toys/<id>.svg`.
- Create: `extension/assets/toys/focus-ball.svg`, `extension/assets/toys/robo-mouse.svg` (placeholder
  art, about 32 px, with a transparent background).

- [ ] **Step 1: Write the failing tests.**
  - `petMenuItems`:
    - With `toys: null`, there's no `toys` item.
    - With `owned: []`, the item is disabled with its hint.
    - With `owned: ["focus-ball", "robo-mouse"]`, there are two children with those names.
    - With `out: "focus-ball"`, the list includes `toy:away`.
    - An away pet has no Toys item.
  - **Script test** (overlay surface):
    - Picking `toy:focus-ball` adds one `.pet-toy[data-toy="focus-ball"]` next to the pet.
    - Picking `toy:robo-mouse` swaps it, so there's still exactly one toy for that pet.
    - Picking `toy:away` removes it.
    - Two pets can each have one toy out.
    - A toy is removed when its pet is put to sleep (`sleep1`), and when its pet disappears from the
      statuses.
    - After a toy is put away, right-clicking the pet still opens its menu.
  - **Script test** (page surface): the menu has no Toys item.
- [ ] **Step 2: Run** `cd web && npx vitest run src/extension/petLogic.test.ts src/extension/petToysScript.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** While a toy is out, the pet doesn't start its own random walks, naps or
  furniture trips. Toy behavior comes in Tasks 9 and 10: here, a toy only sits on the bottom edge.
- [ ] **Step 4: Run** `cd web && npx vitest run` and `cd desktop && npx vitest run`. Expected: PASS.
- [ ] **Step 5: Commit** with the message `feat(toys): Toys menu on desktop pets; summon and put away`.

### Task 9: Focus Ball: throw and fetch

**Files:**
- Modify: `extension/content/pet.js`, `extension/content/logic.js`
- Test: `web/src/extension/petToysScript.test.ts`, `web/src/extension/petLogic.test.ts`

**Interfaces:**
- Produces `L.ballFlight(start: {x, y}, velocity: {vx, vy}, floorY: number, width: number)`, which
  returns `{ x: number }`, the x where the ball comes to rest. It clamps to `[0, width - ballSize]`.
  This is a pure function; the arc and bounce are the builder's call.
- Dragging the ball and letting go throws it, using the release velocity from the last pointer moves.
  The pet goes to the ball (the existing `walkTo`), carries it (like a carried note), walks back to
  where the throw started, and drops it there.
- A click without any drag doesn't throw.

- [ ] **Step 1: Write the failing tests.**
  - `ballFlight`:
    - A throw to the right lands to the right of the start.
    - A throw left from x=10 lands at x=0.
    - A zero velocity lands at the start.
  - **Script test:**
    - Drag the ball from (300, floor) to (400, floor−50) and release. After the fake timers run, the
      ball lands right of 300, the pet reaches it, the ball moves with the pet, and the ball ends near
      x=300.
    - A second throw works the same.
    - Dragging the pet during a fetch drops the ball where the pet was, and the pet stays draggable.
- [ ] **Step 2: Run** the tests. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `cd web && npx vitest run`. Expected: PASS.
- [ ] **Step 5: Commit** with the message `feat(toys): throw the Focus Ball and the pet fetches it`.

### Task 10: Robo Mouse: plays by itself

**Files:**
- Modify: `extension/content/pet.js`, `extension/content/logic.js`
- Test: `web/src/extension/petToysScript.test.ts`

**Interfaces:**
- Produces `ROBO_MOUSE` tuning in `logic.js`: `{ speed, pounceEveryMs: [min, max], pauseMs }`.
- The mouse scoots back and forth along the bottom edge within about 300 px of the pet. Now and then
  the pet walks toward it and pounces (the existing jump), and the mouse stops for `pauseMs` while the
  pet says a happy bubble from `L.toyCatchText` (for example "Got it!"). Then it scoots on.

- [ ] **Step 1: Write the failing test** (script, fake timers):
  - After summoning, the mouse's x changes over time and stays within the pet's range and the screen.
  - Within `pounceEveryMs[1]` the pet jumps and shows the catch bubble.
  - During `pauseMs` the mouse doesn't move.
  - Putting it away stops all its timers: no movement or bubble afterwards.
- [ ] **Step 2: Run** the test. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `cd web && npx vitest run` and `cd desktop && npx vitest run`. Expected: PASS.
- [ ] **Step 5: Commit** with the message `feat(toys): Robo Mouse scoots and the pet pounces on it`.

### Task 11: Check by hand, then docs

- [ ] **Step 1: Run the desktop app** (`cd desktop && npm start`) and go through every check in the
  spec's "Done means":
  - feed each food;
  - see the heart for a favorite;
  - buy a window and see its sky;
  - summon, throw and put away the ball;
  - summon the mouse and watch a pounce;
  - after toys, right-click and drag pets for a minute.
- [ ] **Step 2: Update `HANDOFF.md` and `docs/ROADMAP.md`** for toys.
- [ ] **Step 3: Commit** with the message `docs: handoff and roadmap for toys`.

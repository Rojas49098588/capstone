# More food, working toys, and a window — design

Date: 2026-11-17. Status: decided in conversation; awaiting the owner's review of this document.
Builds on: `2026-11-02-food-design.md` (food limits and effects), `2026-10-19-habitat-decor-design.md`
(decor, spots, swappable art), `2026-10-19-pet-interactions-design.md` (the pet's right-click menu).

## Why

The final demo is on **December 3**: 30 minutes, the **desktop app only**. New features are mostly
done; the time left goes to making the app feel finished. Three parts of it don't yet:

- The Shop sells only two foods, both with one effect each.
- Clothes and toys are sold but **do nothing**. They only show in the inventory.
- The habitat doesn't change through the day.

This round makes food a small choice with personality, makes toys fun, drops clothes for now, and
adds a window that follows the computer's clock.

## Goals

1. **Food:** 8 foods (6 new). Each has a **flavor** and does **one clear thing**. Each kind of pet has a
   **favorite flavor**, and feeding a favorite gives a small token bonus. Cheap **bland** foods teach
   how food works.
2. **Clothes are removed** for now, and their buyers get their tokens back.
3. **Toys work on the desktop:** the **Focus Ball** (you throw it and the pet fetches it) and a new
   **Robo Mouse** (it scoots around and the pet pounces on it by itself). Toys are for play only, with
   no rewards.
4. **Window:** a wall decor item showing the sky for the local time. A habitat with a window also
   gets **lighter and darker** through the day.
5. **Placeholder art** for everything new. Each image is one file that can be replaced later with no
   code change, as decor art works today.

## Non-goals (after December 3)

- Pet personalities, dislikes, or different tastes for two pets of the same kind.
- Clothes (no art, no wearing).
- Different toy behavior per kind of pet. For now every pet plays with every toy the same way.
- Toys in the browser extension or inside the Studium habitat box. The desktop pets only.
- Time of day anywhere outside a habitat that has a window: not on the desktop pets, and not in a
  habitat without one.
- Weather, seasons, or sunrise times that follow the real sun.
- Final art and the real pet sounds. Those are separate roadmap items.

## Anti-goals

These rules still hold from the food design:

- Food never helps a **Sick** pet.
- Food never moves the schedule, the idle (neglect) clock, the schedule gap, or the mood the planner
  works from. A snack only changes the mood the pet **shows**.
- Someone who keeps buying food must not be able to keep a behind-schedule pet looking happy all day.
  **Every snack's mood lift must end before the next snack is allowed**, with any wait shortening
  included.

New rules:

- **Food is never a token farm.** No food may return as many tokens as it costs, counting its instant
  tokens and the favorite bonus together.
- **Toys never give tokens, mood, or progress.**
- **A refund is never paid twice,** even when the same account is open on two devices (see Sync).
- **Old saved data keeps loading.** That includes saves that own clothes or the Puzzle Cube, and any
  Berry Bites or Power Bento effect running at the time.
- **Toys must not make clicking the desktop pets less reliable.** The overdue bug "pets and sticky notes
  stop responding to clicks" (`bugs.md`, opened 11/05) is in the same code (`extension/content/pet.js`).
  Anything that adds windows, layers, or click-through changes must be checked against it.

## 1. Food

### Flavors and favorites

| Kind of pet | Favorite flavor |
|---|---|
| Cat | savory |
| Dog | meaty |
| Frog | sour |
| Pigeon | seedy |
| Turtle | leafy |

The flavors are sweet, savory, sour, seedy, leafy, meaty and bland. No pet's favorite is **bland**,
and nothing is favored by an egg, because an egg doesn't eat. Every pet of a kind shares its favorite.

### The foods

**Snacks** share the per-pet snack limit: one snack, then a wait before the next. **Meals** share the
per-pet meal limit: one meal per local day, resetting at local midnight. **Bland foods use up the slot
like any other food.** This was the owner's decision, so cheap food can't be abused.

| Food | Kind | Flavor | Price | What it does |
|---|---|---|---|---|
| Plain Crackers (new) | snack | bland | 10 | Lifts a Worried or Upset pet's mood one step for **1 hour**. |
| Berry Bites | snack | sweet | 35 | Unchanged: lifts mood one step for **2 hours**. |
| Sour Gummies (new) | snack | sour | 40 | Gives **15 tokens** right away. It doesn't change mood. |
| Seed Crunch (new) | snack | seedy | 50 | Lifts mood one step for **2 hours 15 minutes**. |
| Plain Rice (new) | meal | bland | 15 | Tasks on this pet's project earn **× 1.03** tokens for 4 hours. |
| Power Bento | meal | savory | 60 | Unchanged: **× 1.1** for 4 hours, and a second pet's Bento extends it. |
| Garden Salad (new) | meal | leafy | 55 | **× 1.05** until local midnight. |
| Meaty Stew (new) | meal | meaty | 50 | Until local midnight, this pet's wait between snacks is **2 hours 30 minutes** instead of 3 hours. |

Each food's "What it does" text appears in the Shop, as it does today.

**Rules carried over:** mood lifts only move Worried or Upset pets, by at most one step and never past
Happy. No food helps a Sick pet. A snack can't be fed while the pet's snack wait is running.

**Combining meal boosts on one project.** A project's tasks earn **the highest boost running, not the
product of all of them**. For example, Garden Salad × 1.05 and Power Bento × 1.1 together give × 1.1
while the Bento lasts, then × 1.05 until midnight. Power Bento's extend rule still applies, but only
to Bento time.

**Favorite bonus.** When a pet eats a food of its favorite flavor, the owner gets a small token gift of
**20% of the food's price, rounded down**, and the pet shows a heart bubble on the desktop and in the
habitat. The owner asked for "higher token bonuses for favorite foods". A gift is the same for every
food, so it doesn't change any timer or the snack rule above.

Check against the farm rule: Sour Gummies cost 40 and return 15 + 8 = 23 to a frog. Every other food
returns at most 20% of its price.

**Showing flavors.**

- Each food card in the Shop gets a flavor label.
- The habitat's pet status panel gets a line such as "Loves sour food".
- The feeding choice in the habitat marks the pet's favorites, for example "♥ Favorite".

**Numbers live in tuning.** Prices, durations, multipliers, the 15 tokens and the 20% all belong in
`web/src/planner/tuning.ts` and `web/src/store/products.ts` with the existing food numbers, not in
components. All of them are my call (Claude's) and can be tuned.

**Wording** for the new effect lines follows the existing style, for example "Meal: × 1.05 tokens until
midnight" and "Snacks every 2h 30m today". The exact wording is the builder's call.

## 2. Clothes are removed, and refunds are paid

- **Scholar Scarf, Rainy-Day Coat and Puzzle Cube** come off the Shop. The Puzzle Cube is replaced by
  the Robo Mouse; see section 3. The **Clothes** category disappears from the Shop and the inventory.
- **Refund:** anyone who owns any of these gets the **full price back** for every copy, once. A notice
  says so, for example "Clothes are gone for now, so you got 300 tokens back." This was the owner's
  decision.
- **Sync:** the refund must count once per account, even when two devices load the old data around the
  same time. One way to guarantee it is a refund event with a fixed id per account and product that
  sync merges as a single record. The method is the builder's call; paying once is the requirement.
- Old purchase events stay in the history. Whatever counts what's owned stops showing these items.

## 3. Toys (desktop pets only)

There are two toys, each bought once in the Shop (Supplies, Toys) and never used up:

| Toy | Price | Kind | How it plays |
|---|---|---|---|
| Focus Ball | 75 (unchanged) | **you play** | You drag it and let go to throw it. It flies in an arc, lands on the bottom of the screen, and bounces a little. The pet runs or hops to it, picks it up (the ball moves with the pet), carries it back near where it was thrown from, and drops it. You can throw it again as many times as you like. |
| Robo Mouse (new) | 120 | **plays by itself** | It scoots back and forth along the bottom of the screen near the pet. Now and then the pet stalks it, pounces, and catches it. The mouse stops for a moment, the pet shows a happy bubble, and then the mouse scoots off again. You don't have to do anything. |

The new Robo Mouse description in the Shop is the builder's call, for example "A wind-up mouse your pet
loves to chase."

**Getting a toy out and putting it away**

- The desktop pet's right-click menu gets a **Toys** submenu (the menu already supports submenus)
  listing the toys the user owns.
- Picking one makes it appear on the desktop **next to that pet**. When the user owns no toys, the Toys
  item is disabled and has a hint such as "Buy toys in the Shop".
- While a toy is out, the same menu shows **Put away**, which removes it.
- **One toy per pet at a time.** Picking a different toy swaps it. Two pets may each have their own
  toy out.
- A toy goes away on its own when its pet is put away, goes to sleep (an away pet), is hidden, or when
  the app closes. Toys are not saved, so nothing on screen survives a restart.
- While its toy is out, a pet plays instead of wandering off by itself. Dragging the pet still works.

**Every pet plays the same way** with every toy for now. A pigeon fetches like a dog.

**Where:** only on the desktop app's pets (`desktop/src/overlay` with the shared
`extension/content/pet.js`). The browser extension and the Studium habitat box don't show the Toys
item.

**Sounds:** none for now. Toy sounds can come with the real pet sounds.

## 4. Window and time of day

### The window item

- **Window** is a new **wall decor** item in the Shop's Habitat tab. It costs **80** and goes in a wall
  spot. It follows every existing decor rule: copies, Move here, Remove, and returning to the inventory
  when a project is deleted.
- The window's frame is fixed. Its view depends on the local time on the computer's clock:

| Local time | View |
|---|---|
| 6:00 – 7:59 | **Sunrise:** warm pink and orange sky, sun low |
| 8:00 – 17:59 | **Day:** blue sky, the sun, clouds that drift past now and then |
| 18:00 – 19:59 | **Sunset:** orange and purple sky, sun low |
| 20:00 – 5:59 | **Night:** dark sky full of stars, with a shooting star now and then |

These hours are my call (Claude's): fixed hours, not the real sun. The view updates by itself while the
app is open. Checking about once a minute is fine. It also updates when the computer wakes from sleep.

### The room's light

- **Only habitats that have a window** change light. This was the owner's decision: it gives people a
  reason to buy one.
- **Day:** the room is unchanged, the way it looks today.
- **Sunrise and sunset:** a soft warm tint over the room.
- **Night:** the room is noticeably darker, with a cool blue tint. The pets, furniture and decor must
  stay clearly visible, and the pet status panel and any text must not be dimmed.
- Whether the tint also falls on pets drawn in the habitat is the builder's call, depending on how
  they're layered. The room itself (wallpaper, flooring, decor) must change.
- The change between periods can be a gentle fade.

### Motion and accessibility

When the computer asks for reduced motion, the clouds don't drift and shooting stars don't appear. The
view still changes with the time.

### Testing the clock

As everywhere in the planner, the time is passed in rather than read inside the logic. Choosing the
period from a time, and the tint for each period, are plain functions that can be tested at the edges
(5:59, 6:00, 7:59, 8:00, 17:59, 18:00, 19:59, 20:00).

## 5. Placeholder art

Each image below is **one file**, referenced from one place (the product or decor catalog). Replacing it
later means swapping the file. The style matches today's placeholder decor SVGs (`web/public/decor/`):

- **Foods:** Plain Crackers, Plain Rice, Sour Gummies, Seed Crunch, Garden Salad, Meaty Stew. If Berry
  Bites and Power Bento have no picture yet, they get one too.
- **Toys:** the Focus Ball and the Robo Mouse, drawn on the desktop. They must be small, readable and
  transparent around the edges.
- **Window:** the frame, plus the four sky views. The clouds, stars and shooting star can be drawn
  shapes or images; that's the builder's call.
- **Not this round:** redrawing the 17 existing placeholder decor items. They stay as they are until
  real art arrives.

## Done means

- All 8 foods can be bought, fed, limited and shown as described, with favorites and the token gift.
- Clothes and the Puzzle Cube are gone, and a save that owned them gets its tokens back once, shown in a
  notice.
- On the desktop app, the Focus Ball can be summoned, thrown, fetched and put away, and the Robo Mouse
  can be summoned, chased, caught and put away. Clicking and dragging pets still works afterwards.
- A habitat with a window shows the right sky for the time and dims at night. A habitat without one
  never changes.
- Old saves load. The existing tests pass, and new tests cover the food rules, the refund, toy
  ownership and menu items, and choosing the period from the time.

## Settled after the builder check (my calls, Claude's)

- **Toy ownership** is per account, like the rest of the inventory: one Focus Ball can be summoned
  for any pet, though each pet has its own toy out. The desktop overlay can't read purchases today
  (`desktop/src/main/petChannel.js` `READABLE_KEYS`). Studium publishes the owned toys to the overlay
  the same way it publishes `petStatuses`, for example a toys list there or a new readable key.
- **Refund (updated while planning):** no refund record is saved. The token balance and the inventory simply
  stop counting purchases of the removed products, using the price stored on each purchase. Because
  it's worked out from purchases that already sync, it can't be paid twice and needs no wait for a
  sync. The notice ("…you got N tokens back") is shown once per device, using a flag saved only on
  that device.
- **Eggs:** feeding an egg stays blocked as it is today. If it isn't blocked, block it. Favorites
  use the pet's kind from the existing pet data, and the bonus is worked out where feeding happens
  (`actions.ts`).
- **The snack rule** ("every lift ends before the next snack") is checked by a unit test over every
  snack and every possible wait (the normal wait and Meaty Stew's), not by a clamp at runtime.
  Snack lift length and wait become per-food values, not the single `SNACK_HOURS`.
- **Screens:** toys live on the overlay's existing work area (the main display), like the pets do
  today. The ball lands on that area's bottom edge.
- **The click bug** stays its own roadmap item and isn't part of this work. Toys must not make it
  worse. Their drag and click use the overlay's existing mouse handling (`overlay:mouse`), and
  "Done means" includes checking that clicking pets still works.
- **Window tint:** it applies only when a window is **placed** on a wall, and only once even with
  two windows placed.
- **Favorite heart on the desktop:** Studium tells the desktop pet that it just ate a favorite, for
  example through its status, so the desktop pet shows the heart too.

## Left to the builder

- Exact wording of new effect lines and notices.
- Animations, arcs, bounce, speeds, and how often the pet pounces.
- Tint colors and how strong they are, within "darker at night, still clearly visible".
- How the refund is made to count once.
- Placeholder art style details.

## Changed after testing (2026-11-17, owner's decisions)

- **The window follows the seasons.** Fixed hours felt wrong when it was already dark outside. Sunrise and sunset now come from a month table close to the central US (Dallas): in November, sunset glows about 4:40–5:55 pm, then it's night. Glow runs from 30 min before to 1 h after sunrise, and from 45 min before to 30 min after sunset. This replaces the fixed-hours table above.
- **Bigger and rectangular:** the window is a quarter bigger than the wall spot and fills it as a wide rectangle.
- **Weather through the window** (simulated, not real weather):
  - **Winter** (Dec–Feb): it snows all the time for now, and snow piles up on the sill through the day.
  - **Spring:** cherry petals drift past.
  - **Fall:** leaves blow sideways.
  - **Every season but winter:** rain comes about 1 hour in 6, for 20–40 minutes.
  - The weather is picked from the date and hour, so it's the same in every habitat.
  - Under reduced motion nothing moves, but snow on the sill stays.
- **Favorite foods will be hidden later**, once pets have their own personalities. For the demo, every pet of a kind shares one favorite and it's shown. This is noted in the roadmap.

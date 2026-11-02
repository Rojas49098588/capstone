# Food — design

Date: 2026-11-02. Status: approved in chat, awaiting review of this document.

## Why

Berry Bites and Power Bento are sold in the Shop but do nothing. The user wants food to be a small
nudge when a pet is struggling: a little relief for its mood, or a little extra reward for working.
It must **not** be a cure-all. The only real fix for a sad pet stays the same as today: get back on
schedule. Food is a reason to open the app and get a task done, not a way to buy a happy pet.

## Goals

- **Berry Bites (snack)** lifts a Worried or Upset pet's mood one step for a short time.
- **Power Bento (meal)** gives a small, short boost to the tokens earned on that pet's project.
- Limits stop food from being spammed: one meal a day and one snack every 2 hours, per pet. Effects
  never stack in strength.
- The Shop says what each food does. The habitat shows how long an effect has left and when the pet
  can eat again.

## Non-goals and anti-goals

- Food never helps a **Sick** pet (medicine does that) and never moves the schedule, the idle
  (neglect) clock, or the schedule gap.
- Food never changes the mood that the planner logic works from (health, neglect, recovery). The lift
  only changes the mood the pet **shows**.
- Anti-goal: a user who keeps buying food can keep a behind-schedule pet looking happy all day. The
  limits and the "only lifts Worried/Upset, at most to Happy" rule exist to prevent that.
- No new foods, no hunger meter, no pet that gets upset from not eating.

## How it behaves (decided with the user)

| | Berry Bites (snack) | Power Bento (meal) |
|---|---|---|
| Effect | Shown mood +1 step: Upset → Worried, Worried → Happy | Tokens on this pet's **project** × 1.1 |
| Lasts | 2 hours from feeding | 4 hours |
| Limit | One every 2 hours, per pet | One per local day, per pet (resets at local midnight, like the daily token curve) |
| Stacking | Can't feed a second snack while one is working (the 2-hour limit covers this) | If the project's boost is already running when another pet eats a Bento, the boost stays × 1.1 and its end time moves **4 hours later** |

Multiple pets on one project:

- Snacks are per pet. Each pet has its own mood lift and its own 2-hour timer.
- Meals are per pet, one a day each, but the boost belongs to the project. When a second pet's meal
  extends a running boost, the panel says so, e.g. "Boost already on: this adds 4 hours instead of
  doubling it."

## Screens (decided with the user: habitat option A)

**Shop, Supplies tab, Food section:** each food card gets a short "What it does" box under its
description:

- Berry Bites: "Lifts a Worried or Upset pet's mood one step for 2 hours. One snack every 2 hours.
  Doesn't help a Sick pet."
- Power Bento: "Tasks on this pet's project earn × 1.1 tokens for 4 hours. One meal a day."

**Habitat, pet status panel:** a **Food** section under Mood / Attention:

- While an effect runs: "Snack: lifting mood for 1h 20m more" and "Meal: × 1.1 tokens for 2h 45m
  more". The meal line describes the project's boost, so every pet on the project shows it.
- When the pet can't eat yet: "Next snack in 1h 20m · Next meal tomorrow".
- Two buttons, "Feed Berry Bites" and "Feed Power Bento". While the pet can't eat, each is greyed out
  with the wait time on it. When the user owns none, the button sends them to the Shop, like the
  medicine button does.
- The Mood line shows the lift is temporary, e.g. "Happy (Worried, lifted by a snack)".
- The countdowns update by themselves while the app is open.

## Builder's calls (made in this document, not discussed with the user)

These are calls I made, marked so the user can check them:

1. **The snack lifts at most to Happy.** If the pet's schedule mood rises to Happy during the 2 hours,
   the lift stops counting instead of making it Delighted. Proud and Delighted are never touched.
2. **The snack button is greyed out with "Not hungry"** when the pet is Happy, Delighted or Proud, so a
   snack can't be wasted. A snack only gets used up when it would lift the mood.
3. **No feeding while Sick or Recovering,** and no feeding eggs: no Food section and no feed buttons
   in those states. Recovering already caps the mood at Worried on purpose, and a snack shouldn't
   undo that.
4. **The boost is applied when a task is completed:** a completion made while the boost runs gets
   × 1.1, as a new `foodMultiplier` next to `sickMultiplier` in the token breakdown. It also applies
   to the finish bonus, because it multiplies the whole amount the way the sick penalty does. Sick
   pets can't eat, so the two never meet unless the pet got sick after eating; then both apply
   (0.5 × 1.1). The "expected tokens" estimate used to rank suggestions ignores it.
5. **Feeding is saved as an event** in the same history the rest of the app uses, e.g.
   `{ type: "fed", at, projectId, petId?, productId }`. It takes one of that food out of the
   inventory, and every limit and countdown is worked out from these events plus the current time.
   Nothing is stored that can drift.
6. Feeding happens from the habitat panel only, not from the inventory list.

## What's left to the builder

- Where the code lives (a small `planner/food.ts` next to `mood.ts` is the obvious place), names, and
  exact wording beyond the copy above.
- Exactly where the shown-mood lift is applied (it must reach everywhere a pet's mood is displayed,
  e.g. the habitat and the desktop pet overlay, without changing `projectHealth` or the neglect logic).
- How the countdown ticks.
- Tunable numbers (2 h, 4 h, × 1.1, one step) go in `planner/tuning.ts` with the others.

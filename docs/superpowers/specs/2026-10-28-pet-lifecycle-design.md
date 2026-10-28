# Pet Lifecycle (Eggs and Juveniles): Design

_Date: 2026-10-28. Status: written from the conversation, awaiting the user's review._

## Why

Right now a project's pet hatches the moment the project is created. The lifecycle gives the pet a reason to exist: it hatches once you've actually planned the project. This round adds the first two stages, egg and juvenile. Juveniles use the adult art at a smaller size for now; they'll get their own art later.

## Goals

- New projects start as an **egg** that lives only in the project's habitat.
- The egg **hatches into a juvenile** when the project's **3rd requirement** is added.
- A **pop-up** says "<short name> is hatching!" and the egg in the habitat becomes the juvenile pet.
- Juveniles look like the adult pet at a **smaller size** and otherwise behave exactly like adults.
- **Every existing pet stays an adult**, including the example projects.

## Non-goals (this round)

- Growing from juvenile to adult, and when that happens.
- Juvenile art. Juveniles reuse the adult art, scaled down.
- Different egg art per animal. One egg image for every kind.
- Eggs on other web pages, and any right-click menu or interaction for eggs.
- A hatching animation or a celebration from the extension.

## Anti-goals (would make this a failure even if it works)

- An existing user opens Studium and their pets have turned into eggs or juveniles.
- A pet goes back to being an egg.
- An egg gets sick, makes token payouts smaller, or needs medicine.

## Decided by the user

| Topic | Decision |
|---|---|
| When it hatches | When the project has 3 requirements |
| Going back | Never. Deleting requirements after hatching keeps the pet hatched |
| Where eggs appear | Only in the project's habitat. Not on web pages; no right-click menu |
| Egg mood | None. An egg can't be worried, upset or sick, and can't be given medicine |
| The hatching moment | A pop-up says "<short name> is hatching!" and the egg in the habitat turns into the juvenile pet. "Short name" is the project's short label (e.g. "webDev") |
| Juvenile look | The same art as the adult, slightly smaller. Real juvenile art comes later |
| Egg art | The user's image, `assets/Canva AI Image Oct 28, 2026, 8_20_53 AM.png` |

## Behavior

### Stages

- A project's pet has a stage: **egg**, **juvenile** or **adult**.
- New projects start as **egg**. The egg picker in the New Project form still decides the kind of animal; it stays hidden until hatching.
- Saved projects from before this change load as **adult**. So do the example projects. Saved data stays `version: 1`, and old data must load unchanged.
- **Hatching:** when a requirement is created and the project now has 3 or more requirements while still an egg, the stage becomes **juvenile** and the hatch time is recorded. This is saved, never recalculated, so deleting requirements later doesn't turn it back into an egg.
- Nothing else changes the stage in this round.

### While it's an egg

- **Planning works normally:** requirements, tasks, completing tasks, tokens, Today and Suggested next are unchanged.
- **No mood:**
  - The habitat shows no mood, attention or "points ahead/behind" readout. In their place: "Add N more requirement(s) to hatch".
  - The Overview's project card shows "Egg" where the mood goes.
- **Never sick:**
  - No sick token penalty.
  - Nothing in the egg's habitat suggests giving medicine.
  - Neglect doesn't make the egg sick.
  - Once it hatches, mood and sickness work as usual from then on.
  - _Claude's call:_ for neglect, a requirement's idle days count from the latest of its start, its last completed task, or the hatch time. A pet that just hatched can't be neglected or sick straight away, even if the egg waited for weeks.
- **Not in the extension:** eggs aren't sent to the extension, so they don't walk on web pages, don't count toward the pet limit, and have no right-click menu. On the egg's project page no pet is drawn in the habitat; Studium shows the egg image itself.

### Hatching

- When the 3rd requirement is added, a pop-up says **"<short name> is hatching!"** The existing toast is fine for this.
- The habitat swaps the egg for the juvenile pet. With the extension, the pet appears in the habitat as usual. Without it, the still picture appears.
- The current "It hatched: a <kind>!" message shown when a project is created is removed. A new project shows its egg instead.

### Juveniles

- Drawn at **75% of the adult size** everywhere: on web pages, in the habitat with the extension, and in the habitat's still picture without it.
- Everything else matches adults: mood, mood effects, naps, sleep, check-ins, celebrations, furniture, being dragged and thrown.

### The egg image

- The user's image has the checkerboard background drawn into it; it has no real transparency. Clean it up first:
  - make the background transparent;
  - crop it to the egg;
  - scale it down to about the size of the pet art, keeping the pixels sharp.
- Keep the original in `assets/`. The cleaned copy goes with Studium's other pet pictures (`web/public/pets/`).

### Wording to update

- The tutorial says "Every project hatches a pet" and "Each one hatches its own pet". Make it say a new project starts as an egg that hatches once it has 3 requirements.
- Any other copy that says the pet hatches right away.

## Constraints

- Follow the project's existing rules (HANDOFF.md):
  - planner and store functions take `now`;
  - all wording lives in `web/src/ui/format.ts`;
  - all tuning numbers live in `web/src/planner/tuning.ts`: the 3 requirements and the 75% size go there or in the extension's equivalent;
  - tests come first;
  - `npm run build` and `npm test` pass;
  - nothing in `extension/` starts with `_`.
- The extension and Studium must keep working together. A pet status with no stage (from an older Studium) means adult.

## Left to the builder

- How the stage and hatch time are stored on the project. For example, a new field where "missing" means adult, and whether `hatchedAt` becomes optional for eggs.
- Where exactly the stage check lives for mood, sickness and the sick penalty, as long as an egg is never sick and has no mood shown.
- Exact wording of "Add N more requirement(s) to hatch", within `format.ts`.
- The egg image's final pixel size and how it sits in the habitat box.
- Whether juveniles' furniture spots need nudging; check them in the browser.

## Testing

- **Unit tests:**
  - a new project is an egg;
  - the 3rd requirement hatches it, and the 1st and 2nd don't;
  - deleting requirements after hatching keeps it a juvenile;
  - old saved data and the example projects load as adults;
  - an egg is never sick and pays no sick penalty;
  - a pet that hatches after its requirements sat idle for weeks isn't neglected or sick right away;
  - eggs are left out of the pet statuses;
  - a status with no stage is treated as adult;
  - juveniles are drawn at 75%.
- **Component tests:**
  - the habitat shows the egg and "Add N more…" for an egg project;
  - the Overview card shows "Egg";
  - adding the 3rd requirement shows "<short name> is hatching!";
  - creating a project no longer shows "It hatched".
- **Browser check (Playwright, with the real extension):**
  - an egg project's page shows the egg and no walking pet;
  - its pet appears nowhere else;
  - adding the 3rd requirement hatches it;
  - the juvenile is visibly smaller in the habitat and on another page;
  - adult pets are unchanged.

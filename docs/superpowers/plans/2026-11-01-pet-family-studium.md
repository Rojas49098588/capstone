# Pet Family, Part 1 (Studium window) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Juveniles grow up by doing their tasks, and a new Shop "Pets" tab sells eggs that become extra pets, each with its own habitat, name, care choice and health, all inside the Studium window.

**Architecture:** Extra pets are saved on their project (`Project.pets`). The first pet stays the project itself, with id = project id, so all existing state keeps working. Pure rules live in a new `web/src/planner/pets.ts`: work since a moment, growing up, a bought egg hatching, a pet's mood. One `settlePets(data, now)` runs after the actions that can change them. A habitat is keyed by a **habitat id**: the project id for the first pet, the pet id for extra pets. Decor already uses that key.

**Tech Stack:** React + TypeScript + Vite, Vitest + Testing Library (jsdom). Run everything from `web/`.

**Spec:** `docs/superpowers/specs/2026-11-01-pet-family-design.md`

**Split:** This is Part 1. **Part 2 (desktop)** is its own plan, written after this one is merged. It covers extra pets roaming the desktop with the full menu and mischief, statuses keyed by pet id in `logic.js`/`pet.js`/`desktop/`, "Open project" scrolling to the pet's habitat (`#project=<id>&pet=<petId>`), and a looked-after requirement's suggestion and nap list. Until then, `buildPetStatuses` sends only first pets, so the desktop app is unchanged. Extra habitats show the still picture (the existing `HABITAT_FALLBACK_MS` path).

## Global Constraints

- Branch `feature/pet-family` from `main` (which has Week 3, PR #14). Commit per task; push only after the final review.
- **The first pet's id stays the project id.** Projects saved before this round have no `pets` and load unchanged.
- Growing up: tasks completed after hatching ≥ 50% of (tasks still open at hatching + tasks added since). Only a task's **first** completion counts. Saved when it happens, never undone.
- A bought egg hatches when any one requirement of its project is at least halfway by the same rule, counted from the purchase. Finishing a requirement always counts. The first pet's egg keeps `HATCH_REQUIREMENTS` (3).
- Eggs cost `EGG_PRICE = 400`. At most `MAX_PETS_PER_PROJECT = 4` pets per project, counting the first pet and unhatched eggs. One unhatched bought egg per project at a time. No buying while the first pet is still an egg.
- Sharing pets share the project's mood and health (one `medicine_given` without `petId` cures all of them). A pet looking after a requirement has its own mood and health from that requirement and needs its own dose (`medicine_given` with `petId`).
- When a looked-after requirement is finished or deleted, its pet goes back to sharing (saved).
- Names: the first pet's name is `project.shortName`. A bought pet is named at hatching; the suggested name is `Frog`, `Frog 2`, … (capitalized kind, numbered if taken in that project).
- Habitat header: the pet's name, `Project Companion` or `Looks after · <requirement title>`, and its mood.
- Prompt under the last habitat while the project has fewer than 4 pets: `Want another companion? Buy an egg in the Shop` (no other nagging).
- Wording follows the project's words (`wordsFor(project)`) where it names requirements and tasks.

## Review Focus

1. **A pet that hatches with no open tasks in scope** (or that grows up the moment this ships) must not grow up until at least one task is completed after hatching. Pinned in Task 2 (`done >= 1`).
2. **Old saved data** (no `pets`, `medicine_given` without `petId`) loads, keeps its decor and built-in beds, and moods are unchanged. Pinned in Task 1 and Task 3.
3. **Deleting a project with extra pets** returns their habitats' decor to the inventory and keeps the built-in bed count right. Pinned in Task 1.
4. **A refused egg purchase** (too few tokens, 4 pets, an unhatched bought egg, first pet still an egg, unknown project, the generic `purchase("egg-cat")`) spends nothing and changes nothing. Pinned in Task 4.
5. **Extra pets never reach the desktop** in Part 1: `buildPetStatuses` lists one entry per project. Pinned in Task 3.

---

### Task 1: Pet records, habitat ids, and decor for extra habitats

**Files:**
- Modify: `web/src/planner/types.ts` (types), `web/src/store/storage.ts` (validation), `web/src/store/decor.ts`, `web/src/store/actions.ts` (`deleteProject`, `placeDecor`, `withHabitat` callers)
- Create: `web/src/planner/pets.ts`
- Test: `web/src/planner/pets.test.ts`, `web/src/store/storage.test.ts`, `web/src/store/decor.test.ts`, `web/src/store/actions.test.ts`

**Interfaces:**
- Produces (types.ts):
  - `type ExtraPet = { id: string; kind: PetKind; stage: PetStage; boughtAt: string; hatchedAt: string | null; name: string | null; caresFor: string | null }`. `name` is null until the user names it after hatching. `caresFor` is a requirement id, or null for sharing.
  - `Project.pets?: ExtraPet[]` (missing = none).
  - The `medicine_given` event gains `petId?: string`.
- Produces (pets.ts):
  - `type PetRef = { projectId: string; petId: string; habitatId: string; kind: PetKind; stage: PetStage; name: string | null; caresFor: string | null; hatchedAt: string | null; first: boolean }`. For the first pet, `petId = habitatId = project.id`, `name = project.shortName`, `caresFor = null`, `stage = petStage(project)`.
  - `petsOf(project: Project): PetRef[]`: the first pet, then `project.pets` in order.
  - `habitatIds(data: StudiumData): string[]`: every pet's habitat id, in project order.
  - `findPet(data: StudiumData, habitatId: string): PetRef | undefined`.

- [ ] **Step 1: Create the branch.** `git switch -c feature/pet-family main`

- [ ] **Step 2: Write failing tests**
  - `pets.test.ts`:
    - `petsOf(makeProject())` has one entry with `petId: "p1"`, `habitatId: "p1"`, `first: true`, `name: "proj"`, `stage: "adult"`.
    - With `pets: [egg("x1")]` it returns two entries, the second with `habitatId: "x1"` and `first: false`.
    - `habitatIds` over two projects, one with an extra pet, gives `["p1", "x1", "p2"]`.
  - `storage.test.ts`:
    - Data with a valid `pets` array loads.
    - A pet with an unknown `kind`, a bad `stage`, a non-string `id`, or a non-array `pets` rejects the data (like other damage).
    - A `medicine_given` with a non-string `petId` rejects the data.
    - Data saved before this round (no `pets`) loads unchanged (`toEqual` the input after `normalizeData`).
  - `decor.test.ts`:
    - `ownedCopies(data, DEFAULT_BED.id)` is 3 for one project with two extra pets.
    - `placements` lists a bed placed in habitat `x1` as `{ projectId: "x1", slot }`.
    - `cleanDecor` keeps `decor["x1"]` when `x1` is an extra pet and drops `decor["ghost"]`.
    - `giveDefaultBeds` gives extra habitats a bed too.
  - `actions.test.ts`:
    - `placeDecor(data, "x1", "floorLeft", item)` works for an extra pet's habitat.
    - `deleteProject` removes `decor["x1"]` as well as `decor["p1"]`, and afterwards `freeCopies` of an item that was in `x1` is back to its owned count.

- [ ] **Step 3: Run** `npx vitest run src/planner/pets.test.ts src/store` and check that the new tests fail.

- [ ] **Step 4: Implement.**
  - Add the types and `pets.ts` helpers.
  - `isValidData`: an optional `pets` array, each with string `id`/`boughtAt`, `kind` in `PET_KINDS`, `stage` in `PET_STAGES`, `hatchedAt`/`name`/`caresFor` string or null; plus the optional string `petId` on `medicine_given`.
  - In `decor.ts`, replace each `data.projects` loop (`ownedDecor`'s bed count, `placements`, `cleanDecor`, `giveDefaultBeds`) with `habitatIds(data)`. Keep the field name `projectId` in `placements`' result: it now means habitat id, so say so in its doc comment.
  - In `actions.ts`, `placeDecor` checks `habitatIds(data).includes(projectId)`. `deleteProject` drops the decor of every `habitatId` of that project.

- [ ] **Step 5: Run** `npx vitest run` and `npx tsc --noEmit`. Expected: all pass.

- [ ] **Step 6: Commit.** `git commit -m "feat(pets): extra pet records; decor and beds per habitat"`

---

### Task 2: Growing up and bought eggs hatching

**Files:**
- Modify: `web/src/planner/pets.ts`, `web/src/store/actions.ts`, `web/src/store/useStudium.tsx`, `web/src/components/CompletionPrompt.tsx`, `web/src/ui/format.ts`
- Test: `web/src/planner/pets.test.ts`, `web/src/store/actions.test.ts`, `web/src/store/useStudium.test.tsx`, `web/src/components/CompletionPrompt.test.tsx`

**Interfaces:**
- Consumes: `petsOf`, `ExtraPet` (Task 1).
- Produces (pets.ts):
  - `workSince(taskIds: string[], events: StudiumEvent[], since: string): { done: number; total: number }`. Counts only the given (current) tasks, by each task's **first** completion: `done` = first completion after `since`; `total` = tasks not first-completed at or before `since`.
  - `reached(w: { done: number; total: number }, share: number): boolean`, which is `w.done >= 1 && w.done >= w.total * share`.
  - `GROW_UP_SHARE = 0.5` and `EGG_HATCH_SHARE = 0.5` in `tuning.ts`. Growing up uses `reached(w, GROW_UP_SHARE)` and egg hatching uses `reached(w, EGG_HATCH_SHARE)`.
  - `type PetNews = { kind: "hatched" | "grewUp"; projectId: string; habitatId: string }`.
  - `settlePets(data: StudiumData, now: Date): { data: StudiumData; news: PetNews[] }`. In order, for every project:
    1. An extra pet whose `caresFor` requirement is gone or done goes back to `caresFor: null`.
    2. A bought egg hatches (`stage: "juvenile"`, `hatchedAt`) if any requirement of its project is `reached(…, EGG_HATCH_SHARE)` since `boughtAt`, or is done with `done >= 1` since `boughtAt`. It isn't named yet (`name: null`).
    3. A juvenile (first or extra) grows up (`stage: "adult"`) if its scope has `reached(…, GROW_UP_SHARE)` since `hatchedAt`. Its scope is the project's tasks, or the `caresFor` requirement's tasks.

    Returns the same `data` object when nothing changed.
- Produces (actions.ts): `completeTask` returns `{ data, payout, news: PetNews[] }`. `deleteTask`, `deleteRequirement` and `updateTask` run `settlePets` and keep their return types.
- Produces (useStudium): `completeTask(id, actualMin): { payout: Payout | null; news: PetNews[] }`.
- Produces (format.ts): `petNewsMessage(news: PetNews, data: StudiumData): string`:
  - hatched: `"<project shortName>'s new egg hatched! Name it in its habitat."`
  - grewUp: `"<pet name> grew up!"` (the first pet's name is the shortName; an unnamed pet uses the suggested name, see Task 4's `suggestedPetName`, so Task 2 may use the capitalized kind until then).

- [ ] **Step 1: Write failing tests** (`pets.test.ts`, with `completed(...)` from `testData`):
  - `workSince`: 4 tasks; one first-completed before `since`, one after, two open → `{ done: 1, total: 3 }`.
  - A task first-completed before `since`, reopened and completed again after it, still counts as before.
  - `reached({ done: 0, total: 0 }, 0.5)` is false.
  - `settlePets`, first pet juvenile hatched 2 days ago, 4 open tasks then:
    - 1 completed since → no change, same object.
    - 2 completed → `stage: "adult"`, news `[{ kind: "grewUp", habitatId: "p1" }]`.
  - A juvenile with no tasks at all stays juvenile (Review Focus 1).
  - Tasks added after hatching count toward the total: 2 open at hatching + 2 added since, 1 done → stays juvenile.
  - An adult never goes back: run `settlePets` on an adult with many new open tasks → same object.
  - Bought egg, bought yesterday. Requirement A had 4 open tasks at purchase, 2 completed since → hatches. Requirement B with 2 tasks completed *before* the purchase → doesn't count.
  - A finished requirement with one task completed after the purchase hatches the egg.
  - An extra pet with `caresFor: "rA"`: after `rA`'s last task is done, `caresFor` becomes null. It grows up from `rA`'s tasks alone while it looks after `rA`.
  - The first pet's egg (`project.stage: "egg"`) is never hatched by `settlePets`.

- [ ] **Step 2: Write failing action/UI tests**
  - `actions.test.ts`: `completeTask` returns `news` and the grown-up stage. `deleteRequirement` of a looked-after requirement resets `caresFor`.
  - `useStudium.test.tsx`: update the three `completeTask` calls to read `.payout`.
  - `CompletionPrompt.test.tsx`: completing the task that grows the seed's pet up shows the payout message followed by `"<name> grew up!"` (joined with a space).

- [ ] **Step 3: Run** `npx vitest run src/planner/pets.test.ts src/store src/components/CompletionPrompt.test.tsx`. Expected: the new tests fail.

- [ ] **Step 4: Implement** the functions above. `CompletionPrompt` joins `payoutMessage` and each `petNewsMessage` with spaces.

- [ ] **Step 5: Run** `npx vitest run` and `npx tsc --noEmit`. Expected: all pass.

- [ ] **Step 6: Commit.** `git commit -m "feat(pets): juveniles grow up at half their tasks; bought eggs hatch at half a requirement"`

---

### Task 3: A pet's mood and health

**Files:**
- Modify: `web/src/planner/pets.ts`, `web/src/planner/mood.ts`, `web/src/planner/history.ts`, `web/src/store/actions.ts` (`giveMedicine`), `web/src/store/useStudium.tsx`
- Test: `web/src/planner/pets.test.ts`, `web/src/planner/mood.test.ts`, `web/src/store/actions.test.ts`, `web/src/store/petStatus.test.ts`

**Interfaces:**
- Consumes: `PetRef`, `findPet` (Task 1).
- Produces:
  - `lastMedicineGiven(events, projectId, asOf, petId?: string)`. With no `petId` it ignores events that have one (the project's dose). With a `petId` it looks only at that pet's doses. `projectHealth` keeps calling it without `petId`.
  - `petMood(pet: PetRef, data: StudiumData, now: Date, multipliers?: Multipliers): ProjectMood | null`. Null for an egg. A sharing pet gets `projectMood(pet.projectId, …)`. A pet looking after requirement `r` gets the same rules on `r` alone:
    - gap = `(requirementProgress − plannedProgress) × 100`, mood from `moodFromGap` with the project's difficulty;
    - Proud when `r` is done;
    - one level lower when `r` is idle ≥ `neglectDays`;
    - Sick when idle ≥ `sickDays` and not recovering;
    - recovering for `RECOVERY_DAYS` after a dose with this `petId`, until `r` moves.

    Reuse `requirementIdleDays`, `moodFromGap`, and export `lowerOneLevel`/`capAtWorried` from `mood.ts`. Don't copy them.
  - `giveMedicine(data, projectId, now, petId?: string)`. With `petId` it needs `petMood(...)?.health.sick` for that pet and saves `petId` on the event. Without it, today's behaviour.
  - Store: `giveMedicine(projectId: string, petId?: string)`.

- [ ] **Step 1: Write failing tests**
  - `mood.test.ts`: a project dose still cures the project when another pet's dose exists. A `petId` dose alone doesn't cure the project (Review Focus 2: old events without `petId` behave as before).
  - `pets.test.ts`:
    - A sharing pet's `petMood` equals `projectMood`.
    - A pet looking after a requirement idle 15 days on a steady project is `Sick` while the project's other requirement is on track. (The project itself is also Sick by the unchanged project rule. That's expected; see the spec.)
    - After `giveMedicine(data, "p1", now, "x1")` that pet is recovering (capped at Worried) and the project is still Sick.
    - An egg's `petMood` is null.
  - `actions.test.ts`: `giveMedicine` with `petId` for a healthy pet is refused (`ok: false`, same data).
  - `petStatus.test.ts`: a project with two hatched extra pets produces exactly one status, with `projectId` = the project's id (Review Focus 5).

- [ ] **Step 2: Run** `npx vitest run src/planner src/store`. Expected: the new tests fail.

- [ ] **Step 3: Implement** as above.

- [ ] **Step 4: Run** `npx vitest run` and `npx tsc --noEmit`. Expected: all pass.

- [ ] **Step 5: Commit.** `git commit -m "feat(pets): a pet looking after a requirement has its own mood and medicine"`

---

### Task 4: Buying, naming and changing what a pet cares about

**Files:**
- Modify: `web/src/planner/tuning.ts`, `web/src/planner/pets.ts`, `web/src/store/actions.ts`, `web/src/store/useStudium.tsx`, `web/src/store/products.ts`
- Test: `web/src/planner/pets.test.ts`, `web/src/store/actions.test.ts`

**Interfaces:**
- Produces (tuning.ts): `EGG_PRICE = 400`, `MAX_PETS_PER_PROJECT = 4`.
- Produces (pets.ts):
  - `eggProductId(kind: PetKind): string`, which is `` `egg-${kind}` ``.
  - `type EggRefusal = "firstEgg" | "eggWaiting" | "full"`.
  - `eggRefusal(project: Project): EggRefusal | null`, checked in that order.
  - `suggestedPetName(project: Project, kind: PetKind): string`: `"Frog"`, or `"Frog 2"`, `"Frog 3"`… when another pet in the project already has that name (case-insensitive, the first pet's shortName included).
  - `NAME_MAX` reuses `NICKNAME_MAX` (20).
- Produces (actions.ts):
  - `buyEgg(data, projectId, kind, now): { data; ok: boolean; habitatId: string | null }`. It refuses on an unknown project, `eggRefusal`, or a balance below `EGG_PRICE`. Otherwise it appends `{ type: "purchase", productId: eggProductId(kind), price: EGG_PRICE }`, adds `{ id: newId(), kind, stage: "egg", boughtAt, hatchedAt: null, name: null, caresFor: null }` to `project.pets`, and gives its habitat `withDefaultBed({})`.
  - `setUpPet(data, projectId, petId, input: { name?: string; caresFor?: string | null }): StudiumData`.
    - Trimmed names up to 20 characters. An empty name becomes `suggestedPetName`.
    - `caresFor` must be an unfinished requirement of that project, else null.
    - Only extra pets that have hatched. Refusals return the same object.
    - Naming the first time and changing care later both use it.
- `priceOf(eggProductId(kind))` stays **undefined**, so the generic `purchase` can't buy an egg without a project. Inventory doesn't list eggs because they aren't in `SHOP_PRODUCTS`.
- Store: `buyEgg(projectId, kind): boolean` and `setUpPet(projectId, petId, input)`.

- [ ] **Step 1: Write failing tests**
  - `eggRefusal`:
    - `"firstEgg"` for a project whose stage is egg;
    - `"eggWaiting"` with an unhatched bought egg;
    - `"full"` with 3 extra pets (any stage);
    - null for a hatched project with 1 hatched extra pet.
  - `suggestedPetName`: `"Frog"` → `"Frog 2"` when one pet is named Frog; `"Frog 3"` when Frog and Frog 2 exist.
  - `buyEgg` with balance 400 → ok, balance 0, `project.pets` has one egg, `decor[habitatId]` has the built-in bed, `ownedCopies` of the bed went up by one.
  - Refusals with tokens and data unchanged (`toBe` the same object): balance 399, each `eggRefusal` case, unknown project. `purchase(data, "egg-cat", now)` gives `ok: false` (Review Focus 4).
  - `setUpPet`:
    - names a hatched pet;
    - `"   "` gives the suggested name;
    - 30 characters is cut to 20;
    - a requirement from another project, or a done one, saves `caresFor: null`;
    - an unhatched egg is refused.

- [ ] **Step 2: Run** `npx vitest run src/planner/pets.test.ts src/store/actions.test.ts`. Expected: the new tests fail.

- [ ] **Step 3: Implement** as above, and replace Task 2's temporary unnamed-pet name in `petNewsMessage` with `suggestedPetName`.

- [ ] **Step 4: Run** `npx vitest run` and `npx tsc --noEmit`. Expected: all pass.

- [ ] **Step 5: Commit.** `git commit -m "feat(pets): buy an egg for a project; name a pet and choose what it cares about"`

---

### Task 5: The Shop's Pets tab

**Files:**
- Create: `web/src/components/PetShop.tsx`, `web/src/components/EggArt.tsx` (move `EggSvg` and `PATTERNS` out of `EggPicker.tsx`; `EggPicker` imports it)
- Modify: `web/src/components/Shop.tsx`, `web/src/pets/eggs.ts`
- Test: `web/src/components/Shop.test.tsx`, `web/src/components/EggPicker.test.tsx` (still passes unchanged)

**Interfaces:**
- Consumes: `buyEgg`, `eggRefusal`, `EGG_PRICE`, `PET_KINDS` (Tasks 1 and 4).
- Produces: `ShopTab` gains `"pets"`. Tab order: Supplies, Habitat, Pets (label `Pets`).
- Produces (eggs.ts): `eggLookFor(kind: PetKind): EggLook`.
- Layout: one section per kind (heading = capitalized kind, e.g. `Cat`) with **one** egg card, so later styles can be added as more cards under the same kind. Each card has:
  - the egg art, the kind's egg `description`, and the price;
  - a **Project** select listing every project, with a refused project's option disabled and its reason in the label:
    - firstEgg: `<shortName> (its own egg hasn't hatched)`
    - eggWaiting: `<shortName> (an egg is already waiting)`
    - full: `<shortName> (4 pets)`
  - the button `Buy · 400 tokens`, or `Need N more` when short. It's disabled with no project chosen.
  - On success, the toast-free confirmation line `"The egg is in <shortName>'s habitats. It hatches when you finish half of any <requirement>'s <tasks>."` replaces the button until the select changes.
- With no projects: one line, `Start a project first; eggs go to a project.`
- Header blurb: change to `Spend study tokens on care, treats, outfits, toys and new companions for your projects.`

- [ ] **Step 1: Write failing tests** in `Shop.test.tsx`:
  - The Pets tab shows five egg cards, headed Cat, Dog, Frog, Pigeon, Turtle.
  - With the seed (balance ≥ 400; use `startingTokens` if needed), choosing a project and pressing `Buy · 400 tokens` lowers the shown balance by 400 and shows the confirmation line.
  - A project with an unhatched bought egg shows its option disabled with `(an egg is already waiting)`.
  - With a balance of 100 the button reads `Need 300 more` and is disabled.

- [ ] **Step 2: Run** `npx vitest run src/components/Shop.test.tsx`. Expected: the new tests fail.

- [ ] **Step 3: Implement** as above. `EggPicker.test.tsx` must still pass.

- [ ] **Step 4: Run** `npx vitest run` and `npx tsc --noEmit`. Expected: all pass.

- [ ] **Step 5: Commit.** `git commit -m "feat(shop): Pets tab with one egg per kind"`

---

### Task 6: One habitat per pet on the project page

**Files:**
- Modify: `web/src/components/Habitat.tsx`, `web/src/components/ProjectDetail.tsx`, `web/src/components/HabitatDecor.tsx` (only if it reads `data.projects` for its key), `web/src/ui/format.ts`
- Create: `web/src/components/PetSetup.tsx` (the name + cares-about form)
- Test: `web/src/components/Habitat.test.tsx`, `web/src/components/ProjectDetail.test.tsx`

**Interfaces:**
- Consumes: `petsOf`, `findPet`, `petMood`, `setUpPet`, `giveMedicine(projectId, petId)`, `suggestedPetName`, `workSince` (Tasks 1–4).
- Produces: `Habitat` props become `{ habitatId: string; onOpenShop; placing?; onPickSlot? }`. The first pet's habitat id is the project id, so existing callers pass the same string. The box keeps `data-pet-habitat={habitatId}`. Decor, placing and the still picture use `habitatId` and the pet's `kind`/`stage`.
- Produces (format.ts):
  - `CARES_SHARED_LABEL = "Project Companion"`
  - `caresForLabel(title: string): string` → `"Looks after · <title>"`
  - `boughtEggHint(words): string` → `"Hatches when you finish half of any <requirement>'s <tasks>"`
  - `ANOTHER_PET_PROMPT = "Want another companion?"` and `ANOTHER_PET_LINK = "Buy an egg in the Shop"`
- Header: small label = care label; title = the pet's name (`project.shortName` for the first pet, the suggested name while an extra pet is unnamed); right side = mood or `Egg`. For the first pet, keep the `Habitat` heading text available to the tour (`data-tour="habitat"` stays on the first habitat only).
- Sidebar:
  - An extra egg shows `boughtEggHint` plus the best requirement's progress, `"<n> of <m> <tasks> toward hatching"`, where `m` = ⌈total/2⌉ (at least 1), from `workSince` since `boughtAt` and the requirement closest to halfway.
  - A hatched, unnamed extra pet shows `PetSetup` instead of the mood block. It has a name input (prefilled with `suggestedPetName`, max 20), a select ("Shares the project's mood" or each unfinished requirement as "Looks after <title>"), and a `Done` button calling `setUpPet`.
  - A named extra pet shows mood/attention as today plus a `Cares about` select that saves on change via `setUpPet`.
  - A pet looking after a requirement that is sick shows `Give medicine (<n> left)` when medicine is owned, calling `giveMedicine(projectId, petId)`. Otherwise it shows the existing Buy-medicine button.
  - Sharing pets keep giving medicine through the Inventory as today.
- `ProjectDetail` renders `petsOf(project).map(p => <Habitat habitatId={p.habitatId} …/>)` in order, the Inventory after the last habitat, and between them, while `petsOf(project).length < MAX_PETS_PER_PROJECT`, the prompt line `ANOTHER_PET_PROMPT` with an underlined button `ANOTHER_PET_LINK` calling `onOpenShop`. `onOpenShop` opens the Shop on the Pets tab when called from this prompt: add an optional tab argument to the prop and thread it to `App`'s existing Shop `openTab`.
- The Inventory's placing still targets one habitat at a time: `pickSlot` passes the clicked habitat's id.

- [ ] **Step 1: Write failing tests**
  - `Habitat.test.tsx`: the existing tests pass with `habitatId="webDev"`. Then, on seed data with a bought egg for `webDev` (use `buyEgg` from actions), the second habitat:
    - has `data-pet-habitat="<eggId>"`, shows the egg picture and `Hatches when you finish half of any …`;
    - after a direct `settlePets` hatch in the test data, shows the name input prefilled with the kind's name and, after `Done`, the header shows that name and `Project Companion`;
    - choosing `Looks after <title>` changes the header to `Looks after · <title>`.
  - `ProjectDetail.test.tsx`:
    - With one pet, the page has one habitat and the prompt `Want another companion?`.
    - With 3 extra pets, 4 habitats and no prompt.
    - Clicking `Buy an egg in the Shop` calls `onOpenShop` with `"pets"`.

- [ ] **Step 2: Run** `npx vitest run src/components/Habitat.test.tsx src/components/ProjectDetail.test.tsx`. Expected: the new tests fail.

- [ ] **Step 3: Implement** as above.

- [ ] **Step 4: Run** `npx vitest run` and `npx tsc --noEmit`, then `npm run build`. Expected: all pass, build succeeds.

- [ ] **Step 5: Commit.** `git commit -m "feat(pets): one habitat per pet, naming, and what it cares about"`

---

### Task 7: Check it by hand, docs

**Files:**
- Modify: `HANDOFF.md`, `docs/superpowers/specs/2026-11-01-pet-family-design.md` (status line), `README.md` (Shop section, if it lists tabs)

- [ ] **Step 1: Check by hand** with `npm run dev` in `web/` (or `npm start` in `desktop/`, unsetting `ELECTRON_RUN_AS_NODE` if needed):
  1. An existing project's habitat looks as before.
  2. Shop → Pets shows five eggs; buying one drops the balance by 400.
  3. The project page shows a second habitat with the egg and the prompt below it.
  4. Placing decor in the second habitat works.
  5. Completing half of one requirement's tasks shows the hatched toast; naming the pet and choosing a requirement updates the header.
  6. Completing half the first pet's tasks grows it to full size, with a toast.
  7. On the desktop, nothing new appears and the first pet behaves as before.

- [ ] **Step 2: Update docs.**
  - Spec status → `Approved 2026-11-01; Part 1 built (plan 2026-11-01-pet-family-studium.md)`.
  - HANDOFF: Part 1 done; the data shape (`Project.pets`, habitat ids, `medicine_given.petId`); the numbers (`EGG_PRICE`, `MAX_PETS_PER_PROJECT`, `GROW_UP_SHARE`, `EGG_HATCH_SHARE`). Next: the Part 2 (desktop) plan, then Week 4.

- [ ] **Step 3: Commit.** `git commit -m "docs: pet family Part 1 done"`. Push after the final whole-branch review.

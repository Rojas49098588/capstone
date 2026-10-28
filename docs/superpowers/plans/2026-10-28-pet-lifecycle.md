# Pet Lifecycle (Eggs and Juveniles) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** New projects start as an egg in the habitat. The 3rd requirement hatches it into a juvenile, a 75%-size copy of the adult pet, with a "<short name> is hatching!" pop-up. Existing pets stay adults.

**Architecture:**
- A project gets an optional `stage` field; missing means adult.
- A small pure module (`planner/lifecycle.ts`) answers "what stage is this pet" and does the hatching. `createRequirement` calls it.
- Mood rules treat eggs as never sick and start neglect at the hatch.
- Eggs are left out of the pet statuses, so the extension never sees them. Juveniles are sent with `stage: "juvenile"`, and the extension scales them.

**Tech Stack:** Vite + React 19 + TypeScript 5.9 (lib ES2020) + Tailwind v4, Vitest 5, Chrome MV3 extension in plain JS, Playwright for the browser check.

**Spec:** `docs/superpowers/specs/2026-10-28-pet-lifecycle-design.md`

## Global Constraints

- New projects start as `"egg"`. Saved projects without `stage`, and the example projects, are `"adult"`. Saved data stays `version: 1`.
- Hatching happens when an egg project has **3** requirements (`HATCH_REQUIREMENTS = 3`, in `web/src/planner/tuning.ts`). It is saved, never recalculated, and never undone.
- Juveniles are drawn at **75%** (`JUVENILE_SCALE = 0.75`, in `tuning.ts`, with the same value as `PetLogic.JUVENILE_SCALE` in `extension/content/logic.js`, kept equal by a test).
- Eggs:
  - never sick, so no sick penalty and no medicine;
  - no mood shown;
  - not sent to the extension.
- Pop-up copy: `"<shortName> is hatching!"`. Habitat hint copy: `"Add 1 more requirement to hatch"` / `"Add N more requirements to hatch"`. Overview card label for eggs: `"Egg"`. All copy goes in `web/src/ui/format.ts` (the tour copy stays in `tourSteps.ts`).
- Planner and store functions take `now: Date` and never read the clock.
- TS lib is ES2020: no `Array.prototype.at` and no `Object.hasOwn`.
- Nothing in `extension/` starts with `_`. Extension tests live in `web/src/extension/`.
- Component tests start with `// @vitest-environment jsdom`.
- `npm --prefix web run build` and `npm --prefix web test` pass after every task.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Old saved data:** projects without `stage` and with a string `hatchedAt` load unchanged, as adults, and never show an egg. Pinned in Task 1 (`storage.test.ts`).
2. **Delete, then add again:** an egg with 2 requirements loses one and then gains two. It hatches on reaching 3 total, not on the 3rd "add ever". Pinned in Task 1.
3. **Adult projects:** adding a 3rd (or 10th) requirement to an adult project returns `hatched: false` and shows no pop-up. Pinned in Task 1 and Task 5.
4. **Older Studium statuses** (no `stage`) reaching the extension are adults at full size. Pinned in Task 3.
5. **Egg project page:** the egg shows immediately, without the 1-second wait for a still picture, and no pet "still" picture appears for it. Pinned in Task 5.

## Before Task 1: branch

`feature/tutorial` has uncommitted tutorial work, including `web/src/ui/tourSteps.ts`, which Task 5 edits. Ask the user how to handle it: commit the tutorial work there first, or set it aside. Then create `feature/pet-lifecycle` from that branch. Don't work on `main`. Commit this plan and the spec as the first commit on the new branch.

---

### Task 1: Pet stages and hatching

**Files:**
- Modify: `web/src/planner/types.ts` (Project)
- Modify: `web/src/planner/tuning.ts`
- Create: `web/src/planner/lifecycle.ts`
- Modify: `web/src/store/actions.ts:80-87` (createProject), `:126-149` (createRequirement)
- Modify: `web/src/store/storage.ts:57-59` (project validation)
- Modify: `web/src/planner/testData.ts` (makeProject keeps `hatchedAt: daysAgo(30)`, no `stage`)
- Test: `web/src/planner/lifecycle.test.ts` (new), `web/src/store/actions.test.ts`, `web/src/store/storage.test.ts`, `web/src/store/seed.test.ts`

**Interfaces:**
- Produces:
  - `type PetStage = "egg" | "juvenile" | "adult"` (types.ts)
  - `Project.stage?: PetStage`
  - `Project.hatchedAt: string | null` (null while an egg)
  - `HATCH_REQUIREMENTS = 3`, `JUVENILE_SCALE = 0.75` (tuning.ts)
  - `petStage(project: Project): PetStage`
  - `requirementsToHatch(project: Project, data: StudiumData): number` (0 unless an egg)
  - `hatchIfReady(data: StudiumData, projectId: string, now: Date): { data: StudiumData; hatched: boolean }`
  - `createRequirement(...)` now returns `{ data; requirement; hatched: boolean }`

- [ ] **Step 1: Write the failing tests**

`lifecycle.test.ts`:
- `petStage` returns `"adult"` for `makeProject()` (no stage), and returns `stage` when set.
- `requirementsToHatch`:
  - is 3 for an egg with 0 requirements and 1 for an egg with 2;
  - is 0 for an egg with 3 or more;
  - is 0 for an adult or juvenile whatever the count.
- `hatchIfReady`:
  - on an egg with 3 requirements: `hatched: true`, stage `"juvenile"`, `hatchedAt === NOW.toISOString()`;
  - on an egg with 2: `hatched: false`, data unchanged (same object);
  - on a juvenile or adult: `hatched: false`.

`actions.test.ts`:
- `createProject` makes `stage: "egg"`, `hatchedAt: null`.
- `createRequirement` on a new project: the 1st and 2nd return `hatched: false` and the project stays an egg. The 3rd returns `hatched: true`, and the project is `"juvenile"` with `hatchedAt` set.
- *(Review Focus 2)* Egg with 2 requirements; `deleteRequirement` one (`"unlinkTasks"`); add one more, which gives 2 total, so `hatched: false`; add another, which gives 3, so `hatched: true`.
- After hatching, deleting requirements down to 0 leaves `stage: "juvenile"`.
- *(Review Focus 3)* `createRequirement` on `makeProject()` (adult) with 3+ requirements returns `hatched: false`, and the project gets no `stage`.

`storage.test.ts`:
- *(Review Focus 1)* Data whose project has `hatchedAt: "<iso>"` and no `stage` is valid and loads with no `stage` key added.
- A project with `stage: "egg", hatchedAt: null` round-trips.
- `stage: "chick"` is invalid. So is `hatchedAt: 5`.

`seed.test.ts`:
- Every seed project has no `stage`, so `petStage` is `"adult"`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm --prefix web test -- src/planner/lifecycle.test.ts src/store/actions.test.ts src/store/storage.test.ts src/store/seed.test.ts`
Expected: FAIL (lifecycle.ts doesn't exist; new assertions fail).

- [ ] **Step 3: Implement**

- **Types and tuning:** add the types and constants listed in Interfaces.
- **lifecycle.ts:** write the three functions. `hatchIfReady` counts the project's current requirements in `data`.
- **createProject:** sets `stage: "egg", hatchedAt: null`.
- **createRequirement:** after appending the requirement, runs `hatchIfReady(next, input.projectId, now)` and returns its `data` and `hatched`.
- **storage.ts:**
  - drop `"hatchedAt"` from the `allStr` list;
  - accept `hatchedAt` as a string or `null`;
  - accept `stage` as missing or one of the three values.
- Fix any type errors in callers of `createRequirement` or `hatchedAt`. Today only seed.ts and actions.ts write `hatchedAt`, and nothing reads it.

- [ ] **Step 4: Run the tests to verify they pass, then the build**

Run: `npm --prefix web test -- src/planner/lifecycle.test.ts src/store/actions.test.ts src/store/storage.test.ts src/store/seed.test.ts`, then `npm --prefix web run build`
Expected: PASS; the build exits 0.

- [ ] **Step 5: Commit**

```bash
git add web/src/planner web/src/store
git commit -m "feat: pet stages, new projects start as eggs and hatch at 3 requirements"
```

---

### Task 2: Eggs are never sick; neglect starts at the hatch

**Files:**
- Modify: `web/src/planner/mood.ts:10-16` (requirementIdleDays), `:39-57` (projectHealth)
- Test: `web/src/planner/mood.test.ts`, `web/src/planner/value.test.ts`, `web/src/store/actions.test.ts`

**Interfaces:**
- Consumes: `petStage` (Task 1).
- Produces: there are no new exports. `projectHealth` returns `{ sick: false, recovering: false, recoveringFor: [] }` for eggs. `requirementIdleDays` counts from the latest of the requirement's start, its last completion, and the project's `hatchedAt`, but **only when the project has a `stage` field** (created after this change). Adults without `stage` behave exactly as today.

- [ ] **Step 1: Write the failing tests**

`mood.test.ts`:
- An egg project (`makeProject({ stage: "egg", hatchedAt: null })`) with a requirement idle for 20 days: `projectHealth(...).sick === false`, and `projectMood(...).mood !== "Sick"`.
- A juvenile hatched 2 days ago whose requirement started 20 days ago with no completions: `requirementIdleDays === 2`. `neglectedRequirements` is empty, and `projectHealth(...).sick === false`.
- The same juvenile, 15 days after hatching with no completions: `sick === true`. This shows the normal rules come back.
- An adult (no `stage`) with `hatchedAt` 1 day ago and a requirement idle 20 days: still `sick === true`. The hatch floor applies only to projects that have a stage.

`value.test.ts`:
- Completing a task in an egg project whose requirement is idle 20 days: `breakdown.sickMultiplier === 1`.

`actions.test.ts`:
- `giveMedicine` on an egg project with medicine in the inventory returns `ok: false`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm --prefix web test -- src/planner/mood.test.ts src/planner/value.test.ts src/store/actions.test.ts`
Expected: FAIL on the new tests.

- [ ] **Step 3: Implement in `mood.ts`**

- **projectHealth:** return early for eggs.
- **requirementIdleDays:** finds the project with `data.projects.find((p) => p.id === req.projectId)`. When `project.stage !== undefined` and `project.hatchedAt` is set, the floor is `new Date(project.hatchedAt)`.

- [ ] **Step 4: Run the tests to verify they pass, then the full suite and the build**

Run: `npm --prefix web test`, then `npm --prefix web run build`
Expected: all pass; the build exits 0.

- [ ] **Step 5: Commit**

```bash
git add web/src/planner web/src/store
git commit -m "feat: eggs never get sick, and neglect counts from the hatch"
```

---

### Task 3: Pet statuses and juvenile size in the extension

**Files:**
- Modify: `web/src/store/petStatus.ts` (PetStatus, buildPetStatuses)
- Modify: `extension/content/logic.js` (cleanStatus; new `JUVENILE_SCALE`, `petHeight`; export both on `globalThis.PetLogic`)
- Modify: `extension/content/pet.js:210` (`const h = …`)
- Test: `web/src/store/petStatus.test.ts`, `web/src/extension/petLogic.test.ts`, `web/src/extension/lifecycleScale.test.ts` (new)

**Interfaces:**
- Consumes: `petStage`, `JUVENILE_SCALE` (Task 1).
- Produces:
  - `PetStatus.stage: "juvenile" | "adult"`;
  - eggs are absent from `buildPetStatuses(...).pets`;
  - `PetLogic.JUVENILE_SCALE = 0.75`;
  - `PetLogic.petHeight(height: number, stage: string): number`, which returns `Math.round(height * JUVENILE_SCALE)` for `"juvenile"` and `height` otherwise;
  - `cleanStatus` output gains `stage`: `"juvenile"` only when the input says so, else `"adult"`.

- [ ] **Step 1: Write the failing tests**

`petStatus.test.ts`:
- With one egg, one juvenile and one adult project, `pets` contains the juvenile (`stage: "juvenile"`) and the adult (`stage: "adult"`). It doesn't contain the egg.

`petLogic.test.ts`:
- `L.petHeight(56, "juvenile") === 42` and `L.petHeight(56, "adult") === 56`.
- *(Review Focus 4)* `L.parseStatuses({ pets: [pet()] }).pets[0].stage === "adult"`, where `pet()` has no stage.
- `stage: "juvenile"` is kept, and `stage: "egg"` becomes `"adult"`.
- `L.statusesEqual` is false when only `stage` differs.

`lifecycleScale.test.ts`:
- `L.JUVENILE_SCALE === JUVENILE_SCALE` (imported from `../planner/tuning`). This follows the pattern of `decorLayout.test.ts`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm --prefix web test -- src/store/petStatus.test.ts src/extension/petLogic.test.ts src/extension/lifecycleScale.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

- `buildPetStatuses` filters out projects whose `petStage` is `"egg"` and sets `stage`.
- logic.js: add the constant and helper, and add `stage` in `cleanStatus`.
- pet.js: `const h = L.petHeight(kind.height, status.stage);`. Everything else (width, bubble offsets, habitat clip) already derives from `h`.

- [ ] **Step 4: Run the tests to verify they pass, then the full suite and the build**

Run: `npm --prefix web test`, then `npm --prefix web run build`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add web/src/store/petStatus.ts web/src/store/petStatus.test.ts web/src/extension extension/content/logic.js extension/content/pet.js
git commit -m "feat: eggs stay out of the extension, juveniles walk at 75% size"
```

---

### Task 4: Studium screens: egg habitat, hatching pop-up, wording

**Files:**
- Create: `web/public/pets/egg.png` (cleaned from `assets/Canva AI Image Oct 28, 2026, 8_20_53 AM.png`)
- Modify: `web/src/ui/format.ts` (`EGG_LABEL`, `hatchHint`, `hatchingMessage`)
- Modify: `web/src/components/Habitat.tsx` (remove `justHatched`; egg view; juvenile still size)
- Modify: `web/src/components/Overview.tsx:246-247`, `:253` (egg card)
- Modify: `web/src/store/useStudium.tsx:160-164` (createRequirement returns `{ requirement, hatched }`)
- Modify: `web/src/components/RequirementsSection.tsx` (new prop `onHatch`)
- Modify: `web/src/components/ProjectDetail.tsx` (drop `justHatched`, add `onToast`)
- Modify: `web/src/App.tsx:43, 74, 245, 261` (drop `justHatchedId`; pass `onToast={setToast}`)
- Modify: `web/src/ui/tourSteps.ts` (habitat and new-project steps)
- Test: `Habitat.test.tsx`, `Overview.test.tsx`, `ProjectDetail.test.tsx`, `App.test.tsx`, `Tour.test.tsx` (if it asserts that copy), `format.test.ts`

**Interfaces:**
- Consumes: `petStage`, `requirementsToHatch`, `JUVENILE_SCALE`, `HATCH_REQUIREMENTS` (Task 1); `createRequirement`'s `hatched` (Task 1).
- Produces:
  - `EGG_LABEL = "Egg"`;
  - `hatchHint(remaining: number): string`;
  - `hatchingMessage(shortName: string): string`;
  - `RequirementsSection` prop `onHatch: (message: string) => void`;
  - `ProjectDetail` prop `onToast: (message: string) => void`;
  - `Habitat` no longer takes `justHatched`.

- [ ] **Step 1: Make the egg image (scratch script, not committed)**

Write a script in `.superpowers/sdd/pet-lifecycle/` (PowerShell with `System.Drawing`, or Node with `pngjs` installed there) that does the following:
- Flood-fills transparency from the image border over pixels whose R, G and B are all ≥ 225 and differ by ≤ 12. That's the baked-in white and gray checkerboard. The fill stops at the egg's dark outline.
- Crops to the remaining pixels.
- Resizes to 96 px tall with nearest-neighbor sampling, keeping the aspect ratio.
- Saves to `web/public/pets/egg.png`.

Open the result with the Read tool and confirm that the background is transparent (the corner pixel has alpha 0), the outline is intact, and there's no gray fringe.

- [ ] **Step 2: Write the failing tests**

`format.test.ts`:
- `hatchHint(1) === "Add 1 more requirement to hatch"`;
- `hatchHint(2) === "Add 2 more requirements to hatch"`;
- `hatchingMessage("webDev") === "webDev is hatching!"`.

`Habitat.test.tsx`, with an egg project with 1 requirement:
- *(Review Focus 5)* `img` with alt `"<shortName>'s egg"` is present right after render, with no timer advance;
- the text `"Add 2 more requirements to hatch"` is shown;
- no "Mood" label or `gapLabel` text;
- no "Buy medicine" button;
- after `HABITAT_FALLBACK_MS`, there's still no img of the pet kind.

`Habitat.test.tsx`, with a juvenile project:
- after `HABITAT_FALLBACK_MS`, the still picture's `style.height` is `"72px"` (96 × 0.75).

`Habitat.test.tsx`, adult projects:
- existing tests pass with the `justHatched` prop removed. Delete the "It hatched: a turtle!" test.

`Overview.test.tsx`, with an egg project:
- its card shows `"Egg"` and doesn't show a mood word or "ahead/behind" text.

`ProjectDetail.test.tsx`, with an egg project with 2 requirements:
- add a 3rd through the "+ Add requirement" form; `onToast` is called with `"<shortName> is hatching!"`;
- the habitat no longer shows the egg.
- *(Review Focus 3)* On an adult project, adding a requirement doesn't call `onToast`.

`App.test.tsx`:
- the create-project test no longer expects `/^It hatched: a /`. It expects the new project's habitat to show `"Add 3 more requirements to hatch"`.

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm --prefix web test -- src/ui/format.test.ts src/components/Habitat.test.tsx src/components/Overview.test.tsx src/components/ProjectDetail.test.tsx src/App.test.tsx`
Expected: FAIL.

- [ ] **Step 4: Implement**

- **format.ts:** add the three items.
- **Habitat:**
  - For an egg, render `<img src={`${BASE_URL}pets/egg.png`} alt={`${shortName}'s egg`}>` in the box, bottom-centred like the pet still, about 80 px tall, `imageRendering: "pixelated"`.
  - Never render the pet still for an egg.
  - The header shows `EGG_LABEL` in the muted color.
  - The side panel shows only `hatchHint(requirementsToHatch(...))` and the Estimate accuracy block.
  - For a juvenile, the still picture's height is `96 * JUVENILE_SCALE` px (replace the `h-24` class with an inline height).
- **Overview:** for an egg card, show `EGG_LABEL` in place of the mood, and omit `· gapLabel(...)`.
- **Requirement flow:**
  - `useStudium.createRequirement` returns `{ requirement, hatched }`.
  - `RequirementsSection` calls `onHatch(hatchingMessage(project.shortName))` when `hatched`.
  - `ProjectDetail` passes `onToast` through as `onHatch`.
  - `App` passes `setToast`, and removes `justHatchedId` and its uses.
- **tourSteps.ts:**
  - habitat step: replace "Every project hatches a pet." with `` `Every project starts as an egg and hatches once it has ${HATCH_REQUIREMENTS} requirements.` ``;
  - new-project step: replace "Each one hatches its own pet." with "Each one starts as an egg."

- [ ] **Step 5: Run the full suite and the build**

Run: `npm --prefix web test`, then `npm --prefix web run build`
Expected: all pass; the build exits 0.

- [ ] **Step 6: Commit**

```bash
git add web/public/pets/egg.png web/src
git commit -m "feat: egg habitat, hatching pop-up and lifecycle wording"
```

---

### Task 5: Browser check and docs

**Files:**
- Scratch: `.superpowers/sdd/pet-lifecycle/check.mjs` (not committed)
- Modify: `HANDOFF.md` (status table, decisions, code map: `planner/lifecycle.ts`, `public/pets/egg.png`)
- Modify: `README.md` ("Using it": eggs hatch at 3 requirements; "Where to change things": `HATCH_REQUIREMENTS`, `JUVENILE_SCALE`, `public/pets/egg.png`)

- [ ] **Step 1: Write and run the Playwright check**

Set it up the way HANDOFF.md's "Browser checks" describes:
- `launchPersistentContext` with the real extension;
- Studium on port 5173 (reuse a running `npm run dev`);
- start from the example data.

Check:
1. Create a project in the New Project form. Its habitat shows the egg image within 300 ms, and the box never gets `data-pet-attached`.
2. On another page (e.g. `about:blank` → a `data:` page), the number of pets equals the number of example projects. The egg adds none.
3. Add 2 requirements: still an egg.
4. Add the 3rd: a toast reads "<short name> is hatching!", the box gets `data-pet-attached`, and the habitat pet's height is 75% of the same kind's adult height, ±1 px.
5. On another page, the new pet is present and smaller than an adult of the same kind.
6. The example projects' pets keep their pre-change heights.

Expected: every step prints OK. Save the output in the scratch folder.

- [ ] **Step 2: Watch the juvenile use its furniture**

Place the juvenile's bed in the habitat, and its own furniture if you have one. Watch it use them, with a screenshot, and note in HANDOFF.md whether any spot looks off at 75%. If one does, record it under "Known small issues". Don't fix it in this plan.

- [ ] **Step 3: Update HANDOFF.md and README.md**

Make the updates listed under Files. Add to HANDOFF.md's decisions: "eggs are left out of pet statuses", and "neglect counts from the hatch only for projects with a `stage` field".

- [ ] **Step 4: Final full suite and build**

Run: `npm --prefix web test`, then `npm --prefix web run build`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add HANDOFF.md README.md
git commit -m "docs: pet lifecycle in handoff and readme"
```

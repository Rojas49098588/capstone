# Extension Link Implementation Plan (Plan 3 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the browser pets reflect Studium. Studium publishes each pet's status. The extension builds its pets from that status instead of the hard-coded list, and each pet's mood changes how it moves and talks. On a Studium project page, that project's pet lives inside the page's habitat box.

**Architecture:**
- **Studium side.** `web/src/store/petStatus.ts` builds and publishes `studium-pets-v1`. The provider calls it on load, after every change, and hourly. `Habitat.tsx` brings back its still picture whenever the extension lets go of the box.
- **Extension side.** Pure helpers live in a new classic script, `extension/content/logic.js`. They are exposed as `globalThis.PetLogic` and tested with Vitest from `web/`. The script is loaded before `content/pet.js` in every tab and by the service worker through `importScripts`. `pet.js` builds pets from `chrome.storage.local.petStatuses`. On the Studium origin it copies Studium's localStorage into chrome.storage and runs habitat mode, which uses a MutationObserver and re-reads the box every frame.

**Tech Stack:**
- **Studium:** React 19, TypeScript 5.9 (strict, lib ES2020), Vitest 5 with jsdom.
- **Extension:** Chrome Manifest V3, plain JavaScript, no build step.
- **Browser checks:** Playwright from a scratch folder outside the repo.

**Spec:** `docs/superpowers/specs/2026-10-14-studium-planner-design.md`: section 5 (Extension link), plus the section 8 browser checks. **Builds on:** Plans 1 and 2, both merged into `main`.

## Global Constraints

- Branch: `feature/extension-link` from `main`.
- The extension stays plain JavaScript with **no build step**. Nothing inside `extension/` may be named with a leading `_`, and there is no `node_modules` there, because Chrome refuses to load such folders. Tests for the extension's logic live in `web/src/extension/` and run with `npm test` from `web/`.
- `extension/content/logic.js` never touches `chrome.*`, `window` or `document`. It is wrapped in an IIFE that sets `globalThis.PetLogic`, so it can be injected twice without errors. Three things load it before anything that uses it: the manifest's `content_scripts`, `background.js`'s `executeScript`, and `importScripts` in the service worker.
- Names copied exactly from the spec:
  - localStorage key `studium-pets-v1`, holding `{ updatedAt: string, pets: PetStatus[] }`;
  - window event `studium:pets-updated`;
  - chrome.storage key `petStatuses`;
  - attributes `data-pet-habitat` and `data-pet-attached`.
- `PetStatus = { projectId, shortName, name, color, petKind, mood: "Proud" | "Delighted" | "Happy" | "Worried" | "Upset" | "Sick", recovering, idleRequirement: { title, days } | null }`.
- Saved pet x positions stay in chrome.storage under `pets`, keyed by project id.
- Studium's address is `http://localhost:5173/`. It is defined once, as `HOMEPAGE_URL` in `extension/content/logic.js`.
- Mood behavior (spec section 5):

  | Mood | Speed | Sounds | Other |
  |---|---|---|---|
  | Proud / Delighted | ×1.2 | twice as often | occasional extra hop |
  | Happy | ×1 | normal | |
  | Worried | ×0.7 | half as often | |
  | Upset | ×0.5 | says "…" | pauses longer; cat nap chance ×1.5 |
  | Sick | ×0.3 | none; sometimes "achoo" | faint green tint, no naps or flying |

- When `idleRequirement` is set, the pet sometimes says "Haven't seen <title> in N days", at most once every 2 minutes per pet.
- Before Studium has ever been opened, the extension shows no pets and the toolbar tooltip says to open Studium.
- Components never call `new Date()`; time comes from the provider's clock. Planner and store functions take `now: Date`.
- Run web commands from `web/`. Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Studium never opened, or damaged statuses in chrome.storage.** The pages should show no pets, the tooltip should say to open Studium, and nothing should throw. Pinned in Task 4 (`drops pets it can't draw and rejects damaged data`) and Task 5's browser check (`no pets before Studium has been opened`, `toolbar tooltip asks to open Studium`).
2. **The extension's scripts injected again into an open tab** (after an update or reload). The tab should end up with exactly one working set of pets, and the old copy should stop reacting to storage and DOM changes. Pinned in Task 6's browser check (`re-injecting the scripts keeps one set of pets`) and by the `stale()` guards in Tasks 5 and 6.
3. **The habitat box being replaced or released.**
   - Going straight from one project to another replaces the box, and the right pet should move into the new box.
   - Hiding pets from the toolbar menu should let Studium show its still picture again.
   - Pinned in Task 3 (`brings the still picture back when the extension lets go of the box`) and Task 6's browser check (`switching projects moves the right pet into the new box`, `hiding pets releases the box`).
4. **A thrown pet in a small box.** It should stay inside the box's floor, walls and ceiling the whole time. Pinned in Task 6's browser check (`a thrown pet stays inside the habitat`).
5. **Projects added, deleted or changed in mood while other tabs are open.** Their pets should update without a reload, and the other pets should keep their places. Pinned in Task 5's browser check (`the cured pet's mood reaches the other tab`, `a new project's pet appears in the other tab`).

---

## File Structure

```
web/
  src/store/petStatus.ts            buildPetStatuses, publishPetStatuses, PET_STATUS_* constants
  src/store/petStatus.test.ts
  src/store/useStudium.tsx          + publish on load, after every change, hourly
  src/store/useStudium.test.tsx     + 3 tests
  src/components/Habitat.tsx        still picture comes back when data-pet-attached is removed
  src/components/Habitat.test.tsx   + 1 test
  src/extension/petLogic.test.ts    tests for extension/content/logic.js
extension/
  manifest.json                     loads content/logic.js before content/pet.js; new tooltip/description
  background.js                     importScripts(logic.js); tooltip; injects both scripts
  content/logic.js                  NEW: pure helpers (statuses, moods, idle message, habitat geometry)
  content/pet.js                    pets from petStatuses, mood behavior, Studium copy, habitat mode
README.md, HANDOFF.md               updated in Task 7
(scratch, not in repo) ext-check.mjs   Playwright browser check, written in Task 5, extended in Task 6
```

---

### Task 1: Studium builds and publishes pet statuses

**Files:**
- Create: `web/src/store/petStatus.ts`
- Test: `web/src/store/petStatus.test.ts`

**Interfaces:**
- Consumes: `planner/learning.ts` (`estimateMultipliers`), `planner/mood.ts` (`projectMood`; `neglected` is sorted longest-idle first), `planner/types.ts` (`Mood`, `PetKind`, `StudiumData`), `store/seed.ts` (`buildSeed`), `store/actions.ts` (`purchase`, `giveMedicine`) and `test/render.tsx` (`memoryStorage`), the last three in tests only.
- Produces:
  - `PET_STATUS_KEY = "studium-pets-v1"`, `PET_STATUS_EVENT = "studium:pets-updated"`, `PET_STATUS_REFRESH_MS = 3_600_000`
  - `type PetStatus`, `type PetStatuses = { updatedAt: string; pets: PetStatus[] }`
  - `buildPetStatuses(data: StudiumData, now: Date): PetStatuses`
  - `publishPetStatuses(storage: Storage | null, data: StudiumData, now: Date): boolean`: writes the key, dispatches the event on `window`, and returns false if it couldn't write.

- [ ] **Step 1: Create the branch**

```bash
git checkout main
git checkout -b feature/extension-link
```

- [ ] **Step 2: Write the failing test `web/src/store/petStatus.test.ts`**

```ts
// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { NOW } from "../planner/testData";
import { memoryStorage } from "../test/render";
import { giveMedicine, purchase } from "./actions";
import { PET_STATUS_EVENT, PET_STATUS_KEY, buildPetStatuses, publishPetStatuses } from "./petStatus";
import { buildSeed } from "./seed";

describe("pet statuses", () => {
  it("describes every project's pet", () => {
    const s = buildPetStatuses(buildSeed(NOW), NOW);
    expect(s.updatedAt).toBe(NOW.toISOString());
    expect(s.pets.map((p) => [p.projectId, p.petKind])).toEqual([
      ["webDev", "pigeon"],
      ["appDev", "dog"],
      ["Animation", "frog"],
      ["seniorCap", "cat"],
      ["petExt", "turtle"],
    ]);
    expect(s.pets[3]).toMatchObject({
      shortName: "seniorCap",
      name: "Senior Capstone Project",
      mood: "Sick",
      recovering: false,
      idleRequirement: { title: "Prototype v1", days: 16 },
    });
    expect(s.pets[2].idleRequirement).toEqual({ title: "Rigging", days: 9 });
  });

  it("marks a pet that is recovering", () => {
    let data = purchase(buildSeed(NOW), "medicine", NOW).data;
    data = giveMedicine(data, "seniorCap", NOW).data;
    const cap = buildPetStatuses(data, NOW).pets[3];
    expect(cap.recovering).toBe(true);
    expect(cap.mood).not.toBe("Sick");
  });

  it("saves them for the extension and announces it", () => {
    const storage = memoryStorage();
    const onUpdate = vi.fn();
    window.addEventListener(PET_STATUS_EVENT, onUpdate);
    expect(publishPetStatuses(storage, buildSeed(NOW), NOW)).toBe(true);
    window.removeEventListener(PET_STATUS_EVENT, onUpdate);
    expect(JSON.parse(storage.getItem(PET_STATUS_KEY) ?? "null").pets).toHaveLength(5);
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it("reports when it can't save", () => {
    const data = buildSeed(NOW);
    expect(publishPetStatuses(null, data, NOW)).toBe(false);
    const full = memoryStorage();
    full.setItem = () => {
      throw new Error("QuotaExceededError");
    };
    expect(publishPetStatuses(full, data, NOW)).toBe(false);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run src/store/petStatus.test.ts`
Expected: FAIL: `Failed to resolve import "./petStatus"`.

- [ ] **Step 4: Write `web/src/store/petStatus.ts`**

```ts
// Tells the browser extension how each project's pet is doing (spec section 5).
// The extension's content script reads this key on the Studium page and on PET_STATUS_EVENT.
import { estimateMultipliers } from "../planner/learning";
import { projectMood } from "../planner/mood";
import type { Mood, PetKind, StudiumData } from "../planner/types";

export const PET_STATUS_KEY = "studium-pets-v1";
export const PET_STATUS_EVENT = "studium:pets-updated";
/** Moods change with time even without edits, so statuses are rewritten this often. */
export const PET_STATUS_REFRESH_MS = 3_600_000;

export type PetStatus = {
  projectId: string;
  shortName: string;
  name: string;
  color: string;
  petKind: PetKind;
  mood: Mood;
  recovering: boolean;
  idleRequirement: { title: string; days: number } | null;
};

export type PetStatuses = { updatedAt: string; pets: PetStatus[] };

export function buildPetStatuses(data: StudiumData, now: Date): PetStatuses {
  const multipliers = estimateMultipliers(data);
  return {
    updatedAt: now.toISOString(),
    pets: data.projects.map((p) => {
      const m = projectMood(p.id, data, now, multipliers);
      const idlest = m.neglected[0];
      return {
        projectId: p.id,
        shortName: p.shortName,
        name: p.name,
        color: p.color,
        petKind: p.petKind,
        mood: m.mood,
        recovering: m.health.recovering,
        idleRequirement: idlest ? { title: idlest.requirement.title, days: idlest.idleDays } : null,
      };
    }),
  };
}

/** Saves the statuses where the extension looks for them. False if they couldn't be saved. */
export function publishPetStatuses(storage: Storage | null, data: StudiumData, now: Date): boolean {
  if (!storage) return false;
  try {
    storage.setItem(PET_STATUS_KEY, JSON.stringify(buildPetStatuses(data, now)));
  } catch {
    return false;
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(PET_STATUS_EVENT));
  return true;
}
```

- [ ] **Step 5: Run tests and the build**

Run: `npx vitest run src/store/petStatus.test.ts`
Expected: PASS (4 tests).
Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/store/petStatus.ts src/store/petStatus.test.ts
git commit -m "feat(store): build and publish pet statuses for the extension" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The provider publishes on load, after every change, and hourly

**Files:**
- Modify: `web/src/store/useStudium.tsx`
- Test: `web/src/store/useStudium.test.tsx` (append)

**Interfaces:**
- Consumes: Task 1 (`publishPetStatuses`, `PET_STATUS_KEY`, `PET_STATUS_EVENT`, `PET_STATUS_REFRESH_MS`).
- Produces: no new exports. `useStudium` now keeps `studium-pets-v1` current whenever storage is persistent.

- [ ] **Step 1: Append the failing tests to `web/src/store/useStudium.test.tsx`**

Add to the imports at the top of the file. `NOW` is already imported from `../planner/testData`, so extend that line to `import { NOW, dayKey } from "../planner/testData";`, and add:

```tsx
import { PET_STATUS_EVENT, PET_STATUS_KEY, PET_STATUS_REFRESH_MS } from "./petStatus";
```

Append at the end of the file:

```tsx
describe("useStudium and the browser extension", () => {
  const published = (storage: Storage) => JSON.parse(storage.getItem(PET_STATUS_KEY) ?? "null");

  it("publishes pet statuses when it loads", () => {
    const storage = memoryStorage();
    renderHook(() => useStudium({ storage, clock: () => NOW }));
    expect(published(storage).pets).toHaveLength(5);
  });

  it("publishes again after every change", () => {
    const storage = memoryStorage();
    const onUpdate = vi.fn();
    window.addEventListener(PET_STATUS_EVENT, onUpdate);
    const { result } = renderHook(() => useStudium({ storage, clock: () => NOW }));
    const before = onUpdate.mock.calls.length;
    act(() => {
      result.current.createProject({
        name: "Thesis",
        shortName: "thesis",
        color: "#2d3a8c",
        deadline: dayKey(30),
        description: "",
        petKind: "cat",
      });
    });
    window.removeEventListener(PET_STATUS_EVENT, onUpdate);
    expect(published(storage).pets).toHaveLength(6);
    expect(onUpdate.mock.calls.length).toBeGreaterThan(before);
  });

  it("republishes every hour because moods change with time", () => {
    vi.useFakeTimers();
    let time = NOW;
    const storage = memoryStorage();
    renderHook(() => useStudium({ storage, clock: () => time }));
    time = new Date(NOW.getTime() + PET_STATUS_REFRESH_MS);
    act(() => {
      vi.advanceTimersByTime(PET_STATUS_REFRESH_MS);
    });
    expect(published(storage).updatedAt).toBe(time.toISOString());
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/store/useStudium.test.tsx`
Expected: FAIL. All three new tests fail because nothing writes `studium-pets-v1`: `published(storage)` is `null`, giving `Cannot read properties of null`.

- [ ] **Step 3: Publish from `web/src/store/useStudium.tsx`**

Add the import below the existing `./storage` import:

```tsx
import { PET_STATUS_REFRESH_MS, publishPetStatuses } from "./petStatus";
```

Add these two effects directly after the effect commented `// Another Studium tab saved: ...` (before `const apply = useCallback(`):

```tsx
  // Tell the browser extension how each pet is doing: on load and after every change...
  useEffect(() => {
    if (persistent) publishPetStatuses(env.storage, data, env.clock());
  }, [env, persistent, data]);

  // ...and every hour, because moods change with time even without edits.
  useEffect(() => {
    if (!persistent) return;
    const id = setInterval(() => publishPetStatuses(env.storage, dataRef.current, env.clock()), PET_STATUS_REFRESH_MS);
    return () => clearInterval(id);
  }, [env, persistent]);
```

- [ ] **Step 4: Run tests and the build**

Run: `npx vitest run src/store/useStudium.test.tsx`
Expected: PASS (10 tests: 7 existing + 3 new).
Run: `npm test`
Expected: all tests pass.
Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/store/useStudium.tsx src/store/useStudium.test.tsx
git commit -m "feat(store): keep the extension's pet statuses current" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The habitat shows its still picture again when the extension lets go

**Files:**
- Modify: `web/src/components/Habitat.tsx` (the `useEffect` that watches `data-pet-attached`)
- Test: `web/src/components/Habitat.test.tsx` (append one test)

**Interfaces:**
- Consumes: nothing new.
- Produces: the still picture shows whenever the fallback time has passed **and** the box doesn't have `data-pet-attached`. Today it only ever hides. Task 6 removes the attribute when pets are hidden or leave the box.

- [ ] **Step 1: Append the failing test inside `describe("Habitat", ...)` in `web/src/components/Habitat.test.tsx`**

```tsx
  it("brings the still picture back when the extension lets go of the box", async () => {
    vi.useFakeTimers();
    renderWithStudium(<Habitat projectId="webDev" justHatched={false} onOpenShop={vi.fn()} />);
    const box = document.querySelector('[data-pet-habitat="webDev"]') as HTMLElement;
    box.setAttribute("data-pet-attached", "");
    act(() => {
      vi.advanceTimersByTime(HABITAT_FALLBACK_MS);
    });
    expect(screen.queryByRole("img")).toBeNull();
    await act(async () => {
      box.removeAttribute("data-pet-attached");
    });
    screen.getByRole("img", { name: "webDev's pigeon" });
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/Habitat.test.tsx`
Expected: FAIL: `Unable to find an accessible element with the role "img" and name "webDev's pigeon"`.

- [ ] **Step 3: Replace the effect in `web/src/components/Habitat.tsx`**

Replace this block:

```tsx
  // The extension (Plan 3) finds this box, puts the project's pet in it and sets data-pet-attached.
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    setShowStill(false);
    const timer = setTimeout(() => setShowStill(!box.hasAttribute("data-pet-attached")), HABITAT_FALLBACK_MS);
    const observer = new MutationObserver(() => {
      if (box.hasAttribute("data-pet-attached")) setShowStill(false);
    });
```

with:

```tsx
  // The extension finds this box, puts the project's pet in it and sets data-pet-attached.
  // It removes the attribute when it lets go (pets hidden, extension gone), and the still picture comes back.
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    let waited = false;
    const update = () => setShowStill(waited && !box.hasAttribute("data-pet-attached"));
    setShowStill(false);
    const timer = setTimeout(() => {
      waited = true;
      update();
    }, HABITAT_FALLBACK_MS);
    const observer = new MutationObserver(update);
```

The rest of the effect (`observer.observe(...)`, the cleanup and `[projectId]`) stays as it is.

- [ ] **Step 4: Run tests and the build**

Run: `npx vitest run src/components/Habitat.test.tsx`
Expected: PASS (8 tests).
Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/components/Habitat.tsx src/components/Habitat.test.tsx
git commit -m "fix(ui): show the habitat's still picture again when the pet leaves" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The extension's shared logic

**Files:**
- Create: `extension/content/logic.js`
- Test: `web/src/extension/petLogic.test.ts`

**Interfaces:**
- Consumes: nothing (plain JavaScript).
- Produces `globalThis.PetLogic` with:
  - constants `HOMEPAGE_URL` (`"http://localhost:5173/"`), `PET_STATUS_KEY`, `PET_STATUS_EVENT`, `IDLE_MESSAGE_GAP_MS` (`120000`), `MOOD_EFFECTS`;
  - `isStudiumUrl(href, homepage = HOMEPAGE_URL): boolean`: compares origins;
  - `parseStatuses(raw: string | object | null): { updatedAt, pets: PetStatus[] } | null`: drops entries with an unknown kind or mood, a missing id, or a duplicate id;
  - `statusesEqual(a, b): boolean`: same `pets`, ignoring `updatedAt`;
  - `applyMood(kind, mood): kind'`: a copy of a `KINDS` entry with the mood applied. Adds `extraHopChance` and `tint`;
  - `idleMessage(idleRequirement | null): string | null`, `nextIdleMessageAt(now, random = Math.random): number`;
  - `windowWorld(width, height)`, `worldFromRect(rect, viewportHeight)`, both returning `{ left, bottom, width, height }`. `bottom` is the distance from the window's bottom edge up to the world's floor;
  - `dragPosition(pointer {x,y}, offset {x,y}, world, petHeight, viewportHeight): { x, y }`;
  - `habitatClip(rect, viewportWidth, viewportHeight, headroom = 40): string`: a CSS `inset(...)`.

- [ ] **Step 1: Write the failing test `web/src/extension/petLogic.test.ts`**

```ts
// Tests for the browser extension's pure helpers (extension/content/logic.js). They live in web/
// because the extension has no build step or node_modules of its own.
import { describe, expect, it } from "vitest";
import "../../../extension/content/logic.js";

// logic.js is a plain browser script that sets globalThis.PetLogic.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const L = (globalThis as unknown as { PetLogic: any }).PetLogic;

const pet = (o: Record<string, unknown> = {}) => ({
  projectId: "webDev",
  shortName: "webDev",
  name: "Web Development Portfolio",
  color: "#2d3a8c",
  petKind: "pigeon",
  mood: "Happy",
  recovering: false,
  idleRequirement: null,
  ...o,
});

describe("isStudiumUrl", () => {
  it("matches only Studium's origin", () => {
    expect(L.isStudiumUrl("http://localhost:5173/")).toBe(true);
    expect(L.isStudiumUrl("http://localhost:5173/projects?x=1")).toBe(true);
    expect(L.isStudiumUrl("http://localhost:4173/")).toBe(false);
    expect(L.isStudiumUrl("https://example.com/")).toBe(false);
    expect(L.isStudiumUrl("not a url")).toBe(false);
  });
});

describe("parseStatuses", () => {
  it("reads what Studium publishes", () => {
    const raw = JSON.stringify({
      updatedAt: "2026-10-14T12:00:00.000Z",
      pets: [pet(), pet({ projectId: "appDev", petKind: "dog", mood: "Upset", idleRequirement: { title: "Push", days: 9 } })],
    });
    const s = L.parseStatuses(raw);
    expect(s.updatedAt).toBe("2026-10-14T12:00:00.000Z");
    expect(s.pets.map((p: { projectId: string }) => p.projectId)).toEqual(["webDev", "appDev"]);
    expect(s.pets[1].idleRequirement).toEqual({ title: "Push", days: 9 });
  });

  it("drops pets it can't draw and rejects damaged data", () => {
    const s = L.parseStatuses({ pets: [pet({ petKind: "dragon" }), pet({ mood: "Bored" }), pet({ projectId: "" }), pet(), pet()] });
    expect(s.pets).toHaveLength(1);
    expect(L.parseStatuses("{broken")).toBeNull();
    expect(L.parseStatuses(null)).toBeNull();
    expect(L.parseStatuses({ pets: "nope" })).toBeNull();
  });
});

describe("statusesEqual", () => {
  it("ignores the time stamp", () => {
    const a = { updatedAt: "1", pets: [pet()] };
    expect(L.statusesEqual(a, { updatedAt: "2", pets: [pet()] })).toBe(true);
    expect(L.statusesEqual(a, { updatedAt: "1", pets: [pet({ mood: "Sick" })] })).toBe(false);
    expect(L.statusesEqual(null, null)).toBe(true);
    expect(L.statusesEqual(null, a)).toBe(false);
  });
});

describe("applyMood", () => {
  const dog = { walkSpeed: 60, idleMs: [400, 1800], sound: "Bark!", soundMs: [8000, 20000] };
  const cat = { walkSpeed: 28, idleMs: [3000, 8000], sound: "Meow!", soundMs: [20000, 45000], napChance: 0.4 };
  const pigeon = { walkSpeed: 40, idleMs: [1500, 5000], riseSpeed: 150, flyChance: 0.35, sound: "Coo!", soundMs: [10000, 25000] };
  const frog = { hops: true, jumpSideways: [120, 260], idleMs: [1500, 5000] };
  const turtle = { walkSpeed: 10, idleMs: [3000, 8000] };

  it("leaves a Happy pet as it is", () => {
    expect(L.applyMood(dog, "Happy")).toMatchObject({ ...dog, extraHopChance: 0, tint: false });
  });

  it("speeds up, talks more and hops when Delighted or Proud", () => {
    for (const mood of ["Delighted", "Proud"]) {
      const k = L.applyMood(dog, mood);
      expect(k.walkSpeed).toBeCloseTo(72);
      expect(k.soundMs).toEqual([4000, 10000]);
      expect(k.extraHopChance).toBeGreaterThan(0);
    }
  });

  it("slows down and talks half as often when Worried", () => {
    const k = L.applyMood(dog, "Worried");
    expect(k.walkSpeed).toBeCloseTo(42);
    expect(k.soundMs).toEqual([16000, 40000]);
  });

  it("says … , pauses longer and naps more when Upset", () => {
    const k = L.applyMood(cat, "Upset");
    expect(k.walkSpeed).toBeCloseTo(14);
    expect(k.sound).toBe("…");
    expect(k.napChance).toBeCloseTo(0.6);
    expect(k.idleMs[0]).toBeGreaterThan(cat.idleMs[0]);
    expect(L.applyMood(turtle, "Upset").sound).toBe("…");
  });

  it("is slow, only sneezes, and stays grounded when Sick", () => {
    const k = L.applyMood(cat, "Sick");
    expect(k).toMatchObject({ sound: "Achoo!", napChance: 0, tint: true });
    expect(k.walkSpeed).toBeCloseTo(8.4);
    expect(k.soundMs[0]).toBeGreaterThanOrEqual(30000);
    expect(L.applyMood(pigeon, "Sick").flyChance).toBe(0);
    expect(L.applyMood(pigeon, "Sick").riseSpeed).toBeCloseTo(45);
    const hop = L.applyMood(frog, "Sick").jumpSideways;
    expect(hop[0]).toBeCloseTo(36);
    expect(hop[1]).toBeCloseTo(78);
  });

  it("doesn't change the kind it was given", () => {
    L.applyMood(dog, "Sick");
    expect(dog.walkSpeed).toBe(60);
    expect(dog.soundMs).toEqual([8000, 20000]);
  });

  it("treats an unknown mood as Happy", () => {
    expect(L.applyMood(dog, "Confused").walkSpeed).toBe(60);
  });
});

describe("idle requirement message", () => {
  it("names the requirement and waits at least 2 minutes between messages", () => {
    expect(L.idleMessage({ title: "Rigging", days: 9 })).toBe("Haven't seen Rigging in 9 days");
    expect(L.idleMessage(null)).toBeNull();
    expect(L.IDLE_MESSAGE_GAP_MS).toBe(120000);
    expect(L.nextIdleMessageAt(1000, () => 0)).toBe(1000 + L.IDLE_MESSAGE_GAP_MS);
    expect(L.nextIdleMessageAt(1000, () => 0.99)).toBeLessThan(1000 + 2 * L.IDLE_MESSAGE_GAP_MS);
  });
});

describe("habitat geometry", () => {
  const rect = { left: 100, top: 300, right: 500, bottom: 524, width: 400, height: 224 };

  it("turns the box on screen into the pet's world", () => {
    expect(L.windowWorld(1280, 800)).toEqual({ left: 0, bottom: 0, width: 1280, height: 800 });
    expect(L.worldFromRect(rect, 800)).toEqual({ left: 100, bottom: 276, width: 400, height: 224 });
  });

  it("places a dragged pet relative to its world's left wall and floor", () => {
    // In the window this matches the old formula: y = innerHeight - h - (clientY - offY).
    expect(L.dragPosition({ x: 300, y: 700 }, { x: 10, y: 20 }, L.windowWorld(1000, 800), 50, 800)).toEqual({ x: 290, y: 70 });
    // In the box, 200 px from its left wall; y is measured up from the box floor (524 on screen).
    expect(L.dragPosition({ x: 300, y: 450 }, { x: 10, y: 20 }, L.worldFromRect(rect, 800), 50, 800)).toEqual({ x: 190, y: 44 });
  });

  it("clips drawing to the box, with headroom for speech bubbles", () => {
    expect(L.habitatClip(rect, 1000, 800)).toBe("inset(260px 500px 276px 100px)");
    // Scrolled out of view above the window: nothing is left to draw.
    const gone = { left: 100, top: -400, right: 500, bottom: -176, width: 400, height: 224 };
    expect(L.habitatClip(gone, 1000, 800)).toBe("inset(0px 500px 976px 100px)");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/extension/petLogic.test.ts`
Expected: FAIL: `Failed to resolve import "../../../extension/content/logic.js"`.

- [ ] **Step 3: Write `extension/content/logic.js`**

```js
// Pure helpers shared by the content script (pet.js), the service worker (background.js) and the
// tests in web/src/extension/. No chrome.*, window or document here. Wrapped in a function so it can
// be injected into a tab more than once.
(() => {
  // Where Studium runs. Change this when Studium is deployed somewhere else.
  const HOMEPAGE_URL = 'http://localhost:5173/';
  const PET_STATUS_KEY = 'studium-pets-v1';
  const PET_STATUS_EVENT = 'studium:pets-updated';
  const IDLE_MESSAGE_GAP_MS = 120000; // at most one "Haven't seen …" per pet every 2 minutes

  const PET_KINDS = ['cat', 'dog', 'frog', 'pigeon', 'turtle'];
  const MOODS = ['Proud', 'Delighted', 'Happy', 'Worried', 'Upset', 'Sick'];

  // How each mood changes a pet (spec section 5):
  //   speed: walking, rising and sideways-jump speed; soundEvery: multiplies the time between sounds
  //   sound/soundMs: replaces what it says and how often; pause: multiplies pauses between moves
  //   nap: multiplies nap chance; noNap/noFly: never; extraHopChance: hops in place sometimes
  const MOOD_EFFECTS = {
    Proud: { speed: 1.2, soundEvery: 0.5, extraHopChance: 0.25 },
    Delighted: { speed: 1.2, soundEvery: 0.5, extraHopChance: 0.25 },
    Happy: { speed: 1 },
    Worried: { speed: 0.7, soundEvery: 2 },
    Upset: { speed: 0.5, sound: '…', soundMs: [20000, 40000], pause: 1.6, nap: 1.5 },
    Sick: { speed: 0.3, sound: 'Achoo!', soundMs: [30000, 60000], noNap: true, noFly: true, tint: true },
  };

  function isStudiumUrl(href, homepage = HOMEPAGE_URL) {
    try {
      return new URL(href).origin === new URL(homepage).origin;
    } catch {
      return false;
    }
  }

  const text = (v) => typeof v === 'string' && v.length > 0;

  function cleanStatus(p) {
    if (!p || typeof p !== 'object') return null;
    if (!text(p.projectId) || !PET_KINDS.includes(p.petKind) || !MOODS.includes(p.mood)) return null;
    const idle = p.idleRequirement;
    return {
      projectId: p.projectId,
      shortName: text(p.shortName) ? p.shortName : p.projectId,
      name: text(p.name) ? p.name : p.projectId,
      color: text(p.color) ? p.color : '#2d3a8c',
      petKind: p.petKind,
      mood: p.mood,
      recovering: p.recovering === true,
      idleRequirement:
        idle && text(idle.title) && Number.isFinite(idle.days) ? { title: idle.title, days: Math.round(idle.days) } : null,
    };
  }

  /** Reads Studium's pet statuses (JSON text or an object). Null if they can't be used at all. */
  function parseStatuses(raw) {
    let value = raw;
    if (typeof raw === 'string') {
      try {
        value = JSON.parse(raw);
      } catch {
        return null;
      }
    }
    if (!value || typeof value !== 'object' || !Array.isArray(value.pets)) return null;
    const seen = new Set();
    const pets = [];
    for (const p of value.pets) {
      const clean = cleanStatus(p);
      if (clean && !seen.has(clean.projectId)) {
        seen.add(clean.projectId);
        pets.push(clean);
      }
    }
    return { updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : '', pets };
  }

  /** Same pets with the same looks and moods; the time stamp doesn't matter. */
  function statusesEqual(a, b) {
    return JSON.stringify(a?.pets ?? null) === JSON.stringify(b?.pets ?? null);
  }

  const scale = (range, factor) => [range[0] * factor, range[1] * factor];

  /** A copy of a KINDS entry with the mood's effects applied. */
  function applyMood(kind, mood) {
    const e = MOOD_EFFECTS[mood] ?? MOOD_EFFECTS.Happy;
    const k = { ...kind };
    if (kind.walkSpeed) k.walkSpeed = kind.walkSpeed * e.speed;
    if (kind.riseSpeed) k.riseSpeed = kind.riseSpeed * e.speed;
    if (kind.jumpSideways) k.jumpSideways = scale(kind.jumpSideways, e.speed);
    if (e.sound) {
      // Also gives quiet animals (the turtle) something to say.
      k.sound = e.sound;
      k.soundMs = e.soundMs;
    } else if (kind.soundMs && e.soundEvery) {
      k.soundMs = scale(kind.soundMs, e.soundEvery);
    }
    if (e.pause && kind.idleMs) k.idleMs = scale(kind.idleMs, e.pause);
    if (e.nap && kind.napChance) k.napChance = Math.min(0.9, kind.napChance * e.nap);
    if (e.noNap) k.napChance = 0;
    if (e.noFly) k.flyChance = 0;
    k.extraHopChance = e.extraHopChance ?? 0;
    k.tint = Boolean(e.tint);
    return k;
  }

  function idleMessage(idle) {
    return idle ? `Haven't seen ${idle.title} in ${idle.days} ${idle.days === 1 ? 'day' : 'days'}` : null;
  }

  /** When the next "Haven't seen …" may show: 2 to 4 minutes from now. */
  function nextIdleMessageAt(now, random = Math.random) {
    return now + IDLE_MESSAGE_GAP_MS * (1 + random());
  }

  // A pet's world: its left edge on screen, how far its floor is above the window's bottom edge,
  // and its size. Pet positions (x from the left wall, y up from the floor) are inside it.
  function windowWorld(width, height) {
    return { left: 0, bottom: 0, width, height };
  }

  function worldFromRect(rect, viewportHeight) {
    return { left: rect.left, bottom: viewportHeight - rect.bottom, width: rect.width, height: rect.height };
  }

  /** Where a dragged pet is (before clamping), given the pointer and where it grabbed the pet. */
  function dragPosition(pointer, offset, world, petHeight, viewportHeight) {
    return {
      x: pointer.x - offset.x - world.left,
      y: viewportHeight - world.bottom - petHeight - (pointer.y - offset.y),
    };
  }

  /** A CSS clip-path that only draws inside the box (plus headroom above it for speech bubbles). */
  function habitatClip(rect, viewportWidth, viewportHeight, headroom = 40) {
    const top = Math.max(0, rect.top - headroom);
    const right = Math.max(0, viewportWidth - rect.right);
    const bottom = Math.max(0, viewportHeight - rect.bottom);
    const left = Math.max(0, rect.left);
    return `inset(${top}px ${right}px ${bottom}px ${left}px)`;
  }

  globalThis.PetLogic = {
    HOMEPAGE_URL,
    PET_STATUS_KEY,
    PET_STATUS_EVENT,
    IDLE_MESSAGE_GAP_MS,
    MOOD_EFFECTS,
    isStudiumUrl,
    parseStatuses,
    statusesEqual,
    applyMood,
    idleMessage,
    nextIdleMessageAt,
    windowWorld,
    worldFromRect,
    dragPosition,
    habitatClip,
  };
})();
```

- [ ] **Step 4: Run tests and the build**

Run: `npx vitest run src/extension/petLogic.test.ts`
Expected: PASS (15 tests).
Run: `npm run build`
Expected: build succeeds. The side-effect import of a `.js` file outside `src/` needs no type declarations.

- [ ] **Step 5: Commit**

```bash
git add ../extension/content/logic.js src/extension/petLogic.test.ts
git commit -m "feat(extension): add shared pet logic for statuses, moods and habitats" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Pets come from Studium and act out their moods

**Files:**
- Modify: `extension/manifest.json`, `extension/background.js`
- Replace: `extension/content/pet.js`
- Test: scratch browser check `ext-check.mjs` (outside the repo), mode `statuses`

**Interfaces:**
- Consumes: Task 4 (`globalThis.PetLogic`), Tasks 1–2 (Studium writes `studium-pets-v1` and dispatches `studium:pets-updated`).
- Produces (used by Task 6, inside `pet.js`):
  - `createPet(status, index, count)` returns `{ id, step, render, start, restore, xRatio, clampToWorld, remove }`. Inside it, `world`, `refreshWorld()`, `maxX()` and `maxY()` measure from the world's left wall and floor.
  - Top level: `pets`, `statuses`, `positions`, `hidden`, `dirty`, `alive()`, `stale()`, `rebuild(next, keepPlaces)`, `load()`, `save()`, `setHidden(value)`, `onStudium`, `copyStatusesFromStudium()`, `loop(now)`.
  - chrome.storage: `petStatuses` (the parsed statuses), `pets` (positions), `petHidden`.
  - Toolbar title: `"Open Studium once to meet your pets"` until `petStatuses` exists, then `"Open Studium"`.

- [ ] **Step 1: Set up the browser check (scratch, not in the repo)**

In a scratch folder outside the repo (earlier sessions used the session scratchpad's `pw/` folder), run `npm init -y && npm install playwright && npx playwright install chromium` if it isn't set up yet. Then save this as `ext-check.mjs` there:

```js
// Browser check for Plan 3. Usage: node ext-check.mjs <path-to-extension> <statuses|habitat|all>
// Needs Studium served at http://localhost:5173 (from web/: npm run build && npx vite preview --port 5173 --strictPort).
import { chromium } from "playwright";

const [ext, mode = "all"] = process.argv.slice(2);
const STUDIUM = "http://localhost:5173/";
const OTHER = "https://example.com/";
const results = [];
const check = (name, pass, detail = "") => results.push(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 6000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await fn()) return true;
    await wait(100);
  }
  return false;
};

const ctx = await chromium.launchPersistentContext("", {
  channel: "chromium",
  viewport: { width: 1280, height: 900 },
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
});
let [sw] = ctx.serviceWorkers();
if (!sw) sw = await ctx.waitForEvent("serviceworker");
const errors = [];
ctx.on("weberror", (e) => errors.push(String(e.error())));

// What the content script draws on a page.
const petsOn = (page) =>
  page.evaluate(() => {
    const host = document.getElementById("capstone-pet-host");
    if (!host) return [];
    return [...host.shadowRoot.querySelectorAll(".pet")].map((el) => {
      const r = el.getBoundingClientRect();
      return {
        label: el.querySelector(".name").textContent,
        shown: el.style.display !== "none",
        sick: el.classList.contains("sick"),
        rect: { left: r.left, top: r.top, right: r.right, bottom: r.bottom },
      };
    });
  });
const shown = async (page) => (await petsOn(page)).filter((p) => p.shown);

const other = await ctx.newPage();
await other.goto(OTHER);
await wait(1500);

if (mode === "statuses" || mode === "all") {
  check("no pets before Studium has been opened", (await petsOn(other)).length === 0);
  check(
    "toolbar tooltip asks to open Studium",
    (await sw.evaluate(() => chrome.action.getTitle({}))) === "Open Studium once to meet your pets",
  );

  const studium = await ctx.newPage();
  await studium.goto(STUDIUM);
  await studium.getByRole("heading", { name: "Your Projects" }).waitFor();
  check(
    "Studium's statuses reach chrome.storage",
    await until(async () => (await sw.evaluate(async () => (await chrome.storage.local.get("petStatuses")).petStatuses?.pets?.length ?? 0)) === 5),
  );
  await other.bringToFront();
  check("the other tab now shows five pets", await until(async () => (await shown(other)).length === 5));
  const labels = (await petsOn(other)).map((p) => p.label);
  check(
    "pets are labelled with project and mood",
    labels.includes("seniorCap · Sick") && labels.every((l) => /^\S+ · (Proud|Delighted|Happy|Worried|Upset|Sick)$/.test(l)),
    labels.join(", "),
  );
  check("a Sick pet is tinted", (await petsOn(other)).some((p) => p.label.startsWith("seniorCap") && p.sick));
  check("the tooltip now just opens Studium", (await sw.evaluate(() => chrome.action.getTitle({}))) === "Open Studium");

  // A mood change in Studium reaches the other tab: cure seniorCap.
  await studium.bringToFront();
  await studium.getByRole("button", { name: "Shop" }).first().click();
  const care = studium.locator("section", { has: studium.getByText("Medicine", { exact: true }) }).last();
  await care.getByRole("button", { name: /Buy/ }).first().click();
  await studium.getByRole("button", { name: /seniorCap/ }).first().click();
  await studium.getByRole("button", { name: /Give medicine/ }).click();
  await other.bringToFront();
  check(
    "the cured pet's mood reaches the other tab",
    await until(async () => (await petsOn(other)).some((p) => p.label.startsWith("seniorCap") && !p.label.endsWith("Sick") && !p.sick)),
  );

  // A new project's pet appears in the other tab.
  await studium.bringToFront();
  await studium.getByRole("button", { name: "+ New Project" }).click();
  await studium.getByLabel("Project name").fill("Browser Check");
  await studium.getByLabel("Deadline").fill("2026-12-20");
  await studium.getByRole("radio", { name: /^Egg / }).first().click();
  await studium.getByRole("button", { name: "Create project" }).click();
  await other.bringToFront();
  check("a new project's pet appears in the other tab", await until(async () => (await shown(other)).length === 6));
  await studium.close();
}

if (mode === "habitat" || mode === "all") {
  // Filled in by Task 6.
}

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
console.log(results.join("\n"));
await ctx.close();
process.exit(results.some((r) => r.startsWith("FAIL")) ? 1 : 0);
```

Build and serve Studium in the background, from `web/`:

```bash
npm run build && npx vite preview --port 5173 --strictPort
```

- [ ] **Step 2: Run the check to verify it fails**

Run (from the scratch folder): `node ext-check.mjs "<repo>/extension" statuses`
Expected: exit code 1. `FAIL  no pets before Studium has been opened` (the hard-coded pets are still there) and `FAIL  toolbar tooltip asks to open Studium`.

- [ ] **Step 3: Update `extension/manifest.json`**

```json
{
  "manifest_version": 3,
  "name": "Capstone Pet",
  "version": "0.2.0",
  "description": "Your Studium project pets follow you around the web. Click the icon to open Studium.",
  "permissions": ["storage", "tabs", "contextMenus", "scripting"],
  "host_permissions": ["<all_urls>"],
  "background": {
    "service_worker": "background.js"
  },
  "action": {
    "default_title": "Open Studium once to meet your pets"
  },
  "web_accessible_resources": [
    {
      "resources": ["assets/pets/*.png"],
      "matches": ["<all_urls>"]
    }
  ],
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content/logic.js", "content/pet.js"],
      "run_at": "document_idle"
    }
  ]
}
```

- [ ] **Step 4: Replace `extension/background.js`**

```js
// Service worker: opens Studium when the toolbar icon is clicked, adds a right-click menu on the
// icon to show/hide the pets, and keeps the icon's tooltip up to date.
importScripts('content/logic.js');

// Studium's address lives in content/logic.js (HOMEPAGE_URL), shared with the content script.
const { HOMEPAGE_URL } = globalThis.PetLogic;

chrome.action.onClicked.addListener(async () => {
  // Reuse an open Studium tab instead of opening a new one each click.
  const [existing] = await chrome.tabs.query({ url: HOMEPAGE_URL + '*' });
  if (existing) {
    await chrome.tabs.update(existing.id, { active: true });
    await chrome.windows.update(existing.windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url: HOMEPAGE_URL });
  }
});

// Pets come from Studium, so before it has been opened there are none. Say how to get them.
async function updateTitle() {
  const { petStatuses } = await chrome.storage.local.get('petStatuses');
  await chrome.action.setTitle({ title: petStatuses ? 'Open Studium' : 'Open Studium once to meet your pets' });
}

chrome.runtime.onStartup.addListener(updateTitle);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.petStatuses) updateTitle();
});

chrome.runtime.onInstalled.addListener(async () => {
  chrome.contextMenus.create({
    id: 'toggle-pet',
    title: 'Show / hide pet',
    contexts: ['action'],
  });
  updateTitle();

  // Chrome only runs content scripts on pages loaded after install/reload,
  // so put the pets into tabs that are already open.
  const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*', 'file://*/*'] });
  for (const tab of tabs) {
    chrome.scripting
      .executeScript({ target: { tabId: tab.id }, files: ['content/logic.js', 'content/pet.js'] })
      .catch(() => {}); // Some pages (like the Chrome Web Store) refuse scripts.
  }
});

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== 'toggle-pet') return;
  const { petHidden = false } = await chrome.storage.local.get('petHidden');
  // Every tab's content script listens for this change and updates itself.
  await chrome.storage.local.set({ petHidden: !petHidden });
});
```

- [ ] **Step 5: Replace `extension/content/pet.js`**

```js
// Content script: draws one pet per Studium project on every page and remembers where
// each one was, so they appear in the same spots when you switch pages or tabs.
//
// Pets come from Studium. On the Studium page this script copies Studium's pet statuses
// (localStorage "studium-pets-v1") into chrome.storage as `petStatuses`, and every tab rebuilds
// its pets from there. Before Studium has been opened there are no pets.
//
// Every pet can be dragged, thrown (it flies with momentum and bounces) and clicked (it hops
// and makes its sound). Each kind of animal has its own habits (KINDS below), and its mood
// changes how fast it moves and how often it talks (PetLogic.applyMood in logic.js).
// Art lives in extension/assets/pets/.

(() => {
  if (window.top !== window) return;
  // Pets left over from before the extension was reloaded can't save anymore,
  // so replace them. Their loop stops once their element is gone (see loop()).
  document.getElementById('capstone-pet-host')?.remove();

  const L = globalThis.PetLogic; // content/logic.js, loaded just before this file

  // Shared physics. Each kind below can override the ones marked "per kind".
  const GRAVITY = 1400;         // px/s², per kind
  const HOP_SPEED = 380;        // px/s upward when clicked, per kind
  const BOUNCE = 0.5;           // speed kept after hitting a wall, floor or ceiling, per kind
  const AIR_DRAG = 0.4;         // sideways slowdown in the air, per kind
  const THROW_SAMPLE_MS = 80;   // how much recent mouse movement sets the throw speed
  const MAX_THROW_SPEED = 2500; // px/s
  const GROUND_FRICTION = 5;    // how quickly a slide along the floor stops
  const MIN_BOUNCE_SPEED = 200; // slower floor hits than this stop bouncing
  const MAX_TILT_DEG = 25;      // lean while flying sideways
  const SAVE_EVERY_MS = 2000;

  // How each kind of animal looks and behaves (before its mood is applied). Ranges are [min, max].
  //   height/aspect: display size in px (aspect = width / height of the art)
  //   walkSpeed px/s, idleMs pause between walks, strollPx typical walk length
  //   sound: what it says when clicked and every soundMs or so
  const KINDS = {
    cat: {
      height: 56, aspect: 0.82,
      walkSpeed: 28, idleMs: [3000, 8000], strollPx: 160,
      sound: 'Meow!', soundMs: [20000, 45000],
      napChance: 0.4, napMs: [10000, 20000], // sometimes naps instead of walking
    },
    dog: {
      height: 60, aspect: 0.82,
      walkSpeed: 60, idleMs: [400, 1800], strollPx: 450, longWalkChance: 0.4,
      sound: 'Bark!', soundMs: [8000, 20000],
    },
    turtle: {
      height: 44, aspect: 1.48,
      walkSpeed: 10, idleMs: [3000, 8000], strollPx: 120,
      throwable: false, // drops straight down when let go
      bounce: 0.08, hopSpeed: 120,
    },
    frog: {
      height: 50, aspect: 1.04,
      hops: true, jumpSpeed: [600, 850], jumpSideways: [120, 260], // moves by jumping
      idleMs: [1500, 5000], bounce: 0.15, hopSpeed: 850,
      sound: 'Ribbit!', soundMs: [12000, 30000],
      tongueMs: [4000, 10000], mouth: { x: 0.8, y: 0.37 }, // tongue flick, from the mouth corner
    },
    pigeon: {
      height: 50, aspect: 0.81,
      walkSpeed: 40, idleMs: [1500, 5000], strollPx: 200,
      sound: 'Coo!', soundMs: [10000, 25000],
      flyChance: 0.35, flyHeight: [150, 400], riseSpeed: 150, // floats up the page...
      gravity: 200, maxFallSpeed: 90, airDrag: 1.2,           // ...and drifts down slowly
    },
  };

  const between = ([lo, hi]) => lo + Math.random() * (hi - lo);

  const STYLE = `
    .pet {
      position: absolute; left: 0; bottom: 0;
      pointer-events: auto; cursor: grab; user-select: none; touch-action: none;
      will-change: transform;
    }
    .pet.dragging { cursor: grabbing; z-index: 1; }
    .body, .anim { width: 100%; height: 100%; transform-origin: 50% 100%; }
    .sprite {
      position: absolute; inset: 0; width: 100%; height: 100%;
      -webkit-user-drag: none; pointer-events: none;
      /* Thin outline in the project's color, so you can tell which project a pet belongs to. */
      filter: drop-shadow(1.5px 0 0 var(--c)) drop-shadow(-1.5px 0 0 var(--c))
              drop-shadow(0 1.5px 0 var(--c)) drop-shadow(0 -1.5px 0 var(--c));
    }
    /* A Sick pet looks a little green. */
    .pet.sick .anim { filter: sepia(.35) hue-rotate(45deg) saturate(1.4); }
    .ring {
      position: absolute; left: 10%; bottom: -4px; width: 80%; height: 8px;
      border-radius: 50%; background: var(--c); opacity: .35; pointer-events: none;
    }
    .pet.walking .anim { animation: bob .4s ease-in-out infinite; }
    .pet.sleeping .anim { animation: breathe 2.4s ease-in-out infinite; }
    .pet.flying .anim { animation: flap .18s ease-in-out infinite; }
    .pet.gliding .anim { animation: flap .6s ease-in-out infinite; }

    .tongue {
      position: absolute; height: 4px; width: 26px; border-radius: 2px;
      background: #e8577a; transform-origin: 0 50%; transform: scaleX(0);
    }
    .tongue::after {
      content: ''; position: absolute; right: -3px; top: -2px;
      width: 8px; height: 8px; border-radius: 50%; background: #e8577a;
    }
    .pet.licking .tongue { animation: lick .45s ease-out; }

    .bubble, .name {
      position: absolute; left: 50%; transform: translateX(-50%);
      font: 600 12px/1.2 system-ui, sans-serif; white-space: nowrap;
      pointer-events: none; opacity: 0; transition: opacity .2s;
    }
    .bubble {
      padding: 4px 8px; border-radius: 10px;
      background: #fff; color: #1a1816; box-shadow: 0 2px 6px rgba(0,0,0,.2);
    }
    .bubble.show { opacity: 1; }
    .pet.sleeping .bubble { font-style: italic; color: #6b6f7a; }
    .name { padding: 1px 6px; border-radius: 6px; background: var(--c); color: #fff; }
    .pet:hover .name { opacity: 1; }

    @keyframes bob { 50% { transform: translateY(-3px) scaleY(.96); } }
    @keyframes breathe { 50% { transform: scaleY(.93) scaleX(1.03); } }
    @keyframes flap { 50% { transform: translateY(-3px) scaleY(1.04); } }
    @keyframes lick { 40%, 55% { transform: scaleX(1); } 100% { transform: scaleX(0); } }
  `;

  // ---- DOM ----
  const host = document.createElement('div');
  host.id = 'capstone-pet-host';
  host.style.cssText =
    'all: initial; position: fixed; inset: 0; pointer-events: none; z-index: 2147483647;';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>${STYLE}</style>`;
  document.documentElement.appendChild(host);

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  // Speed of the pointer over the last few moments of a drag, in px/s.
  // Holding still before letting go gives zero, so you can still set a pet down gently.
  function throwVelocity(samples) {
    const now = performance.now();
    const recent = samples.filter((s) => now - s.t <= THROW_SAMPLE_MS);
    if (recent.length < 2) return { vx: 0, vy: 0 };
    const first = recent[0];
    const lastS = recent[recent.length - 1];
    const secs = Math.max((lastS.t - first.t) / 1000, 0.008);
    let vx = (lastS.x - first.x) / secs;
    let vy = -(lastS.y - first.y) / secs; // screen y points down; ours points up
    const speed = Math.hypot(vx, vy);
    if (speed > MAX_THROW_SPEED) {
      vx *= MAX_THROW_SPEED / speed;
      vy *= MAX_THROW_SPEED / speed;
    }
    return { vx, vy };
  }

  // ---- One pet ----
  // status: one of Studium's pet statuses (projectId, shortName, name, color, petKind, mood, idleRequirement).
  function createPet(status, index, count) {
    const kind = L.applyMood(KINDS[status.petKind], status.mood);
    const gravity = kind.gravity ?? GRAVITY;
    const bounce = kind.bounce ?? BOUNCE;
    const airDrag = kind.airDrag ?? AIR_DRAG;
    const h = kind.height;
    const w = Math.round(h * kind.aspect);
    const idleText = L.idleMessage(status.idleRequirement);

    // The pet's world: the whole window. Positions are measured from its left wall and floor.
    let world = L.windowWorld(window.innerWidth, window.innerHeight);
    function refreshWorld() {
      world = L.windowWorld(window.innerWidth, window.innerHeight);
    }
    const maxX = () => Math.max(0, world.width - w);
    const maxY = () => Math.max(0, world.height - h);

    const petEl = document.createElement('div');
    petEl.className = kind.tint ? 'pet sick' : 'pet';
    petEl.style.cssText = `width:${w}px;height:${h}px;--c:${status.color}`;
    petEl.innerHTML = `
      <div class="ring"></div>
      <div class="bubble" style="bottom:${h + 4}px"></div>
      <div class="body"><div class="anim">
        <img class="sprite" alt="" src="${chrome.runtime.getURL(`assets/pets/${status.petKind}.png`)}">
        ${kind.mouth ? `<div class="tongue" style="left:${kind.mouth.x * 100}%;top:${kind.mouth.y * 100}%"></div>` : ''}
      </div></div>
      <div class="name" style="top:${h + 6}px"></div>`;
    petEl.querySelector('.name').textContent = `${status.shortName} · ${status.mood}`;
    petEl.title = status.name;
    const bodyEl = petEl.querySelector('.body');
    const ringEl = petEl.querySelector('.ring');
    const bubbleEl = petEl.querySelector('.bubble');
    root.appendChild(petEl);

    const state = {
      x: 0,               // from the world's left wall, px
      y: 0,               // height above the world's floor, px
      vx: 0,              // sideways speed, px/s (positive is right)
      vy: 0,              // vertical speed, px/s (positive is up)
      facing: 1,          // 1 = right, -1 = left (the art faces right or forward)
      mode: 'idle',       // idle | walk | fall | drag | sleep | fly
      targetX: 0,
      idleUntil: 0,
      sleepUntil: 0,
      flyTo: 0,           // height the pigeon rises to before gliding down
      nextSoundAt: 0,
      nextLickAt: 0,
      nextIdleMessageAt: 0,
    };
    // Spread the pets out across the window until they have saved positions.
    const defaultXRatio = (index + 0.5) / count;

    function say(text, ms = 1500) {
      bubbleEl.textContent = text;
      bubbleEl.classList.add('show');
      clearTimeout(say.timer);
      say.timer = setTimeout(() => bubbleEl.classList.remove('show'), ms);
    }

    function lick() {
      if (!kind.mouth) return;
      petEl.classList.remove('licking');
      void petEl.offsetWidth; // restart the animation if it's already running
      petEl.classList.add('licking');
      setTimeout(() => petEl.classList.remove('licking'), 450);
    }

    function goIdle(now) {
      state.mode = 'idle';
      state.idleUntil = now + between(kind.idleMs);
    }

    function wake() {
      if (state.mode !== 'sleep') return;
      bubbleEl.classList.remove('show');
      petEl.classList.remove('sleeping');
    }

    // Decide what to do after a pause: walk, hop, nap or fly, depending on the kind and mood.
    function act(now) {
      if (kind.napChance && Math.random() < kind.napChance) {
        state.mode = 'sleep';
        const napMs = between(kind.napMs);
        state.sleepUntil = now + napMs;
        say('Zzzzz', napMs);
        return;
      }
      if (kind.extraHopChance && Math.random() < kind.extraHopChance) {
        // A happy little hop in place.
        state.vx = 0;
        state.vy = (kind.hopSpeed ?? HOP_SPEED) * 0.6;
        state.mode = 'fall';
        return;
      }
      if (kind.flyChance && Math.random() < kind.flyChance) {
        state.mode = 'fly';
        state.flyTo = Math.min(maxY(), between(kind.flyHeight));
        state.vx = (Math.random() < 0.5 ? -1 : 1) * between([40, 100]);
        state.facing = Math.sign(state.vx);
        return;
      }
      if (kind.hops) {
        // Jump mostly toward the middle of the world so frogs don't pile up at the edges.
        const towardMiddle = state.x < maxX() / 2 ? 1 : -1;
        const dir = Math.random() < 0.7 ? towardMiddle : -towardMiddle;
        state.vx = dir * between(kind.jumpSideways);
        state.vy = between(kind.jumpSpeed);
        state.facing = dir;
        state.mode = 'fall';
        return;
      }
      // Walk: mostly short strolls, sometimes a long walk across the world.
      const range = Math.random() < (kind.longWalkChance ?? 0.2) ? maxX() : kind.strollPx;
      state.targetX = clamp(state.x + (Math.random() * 2 - 1) * range, 0, maxX());
      state.facing = state.targetX >= state.x ? 1 : -1;
      state.mode = 'walk';
    }

    function step(now, dt) {
      refreshWorld();
      // Sounds, tongue flicks and reminders happen on their own timers while awake.
      const busy = state.mode === 'drag' || state.mode === 'sleep';
      if (kind.sound && !busy && now > state.nextSoundAt) {
        if (state.nextSoundAt) say(kind.sound);
        state.nextSoundAt = now + between(kind.soundMs);
      }
      if (kind.mouth && !busy && state.y === 0 && now > state.nextLickAt) {
        if (state.nextLickAt) lick();
        state.nextLickAt = now + between(kind.tongueMs);
      }
      if (idleText && !busy && now > state.nextIdleMessageAt) {
        if (state.nextIdleMessageAt) say(idleText, 4000);
        state.nextIdleMessageAt = L.nextIdleMessageAt(now);
      }

      switch (state.mode) {
        case 'idle':
          if (now > state.idleUntil) act(now);
          break;
        case 'sleep':
          if (now > state.sleepUntil) {
            wake();
            goIdle(now);
          }
          break;
        case 'walk': {
          const dist = state.targetX - state.x;
          const move = kind.walkSpeed * dt;
          if (Math.abs(dist) <= move) {
            state.x = state.targetX;
            goIdle(now);
          } else {
            state.x += Math.sign(dist) * move;
          }
          dirty = true;
          break;
        }
        case 'fly': {
          // Rise steadily while drifting sideways, then glide back down (in 'fall').
          state.y += kind.riseSpeed * dt;
          state.x += state.vx * dt;
          if (state.x < 0 || state.x > maxX()) {
            state.x = clamp(state.x, 0, maxX());
            state.vx = -state.vx;
            state.facing = Math.sign(state.vx);
          }
          if (state.y >= state.flyTo) {
            state.y = state.flyTo;
            state.vy = 0;
            state.mode = 'fall';
          }
          dirty = true;
          break;
        }
        case 'fall': {
          state.vy -= gravity * dt;
          if (kind.maxFallSpeed) state.vy = Math.max(state.vy, -kind.maxFallSpeed);
          state.x += state.vx * dt;
          state.y += state.vy * dt;

          // Bounce off the walls and ceiling of the world.
          if (state.x < 0 || state.x > maxX()) {
            state.x = clamp(state.x, 0, maxX());
            state.vx = -state.vx * bounce;
          }
          if (state.y > maxY()) {
            state.y = maxY();
            state.vy = -state.vy * bounce;
          }

          const onFloor = state.y <= 0;
          if (onFloor) {
            state.y = 0;
            state.vy = -state.vy > MIN_BOUNCE_SPEED ? -state.vy * bounce : 0;
          }
          // Slide to a stop on the floor; drift a little in the air.
          state.vx *= Math.exp(-(onFloor && state.vy === 0 ? GROUND_FRICTION : airDrag) * dt);

          if (Math.abs(state.vx) > 20) state.facing = Math.sign(state.vx);
          if (onFloor && state.vy === 0 && Math.abs(state.vx) < 10) {
            state.vx = 0;
            goIdle(now);
          }
          dirty = true;
          break;
        }
        // 'drag' is driven by pointer events below.
      }
    }

    function render() {
      petEl.style.transform = `translate(${world.left + state.x}px, ${-(world.bottom + state.y)}px)`;
      const airborne = state.mode === 'fall' && state.y > 0;
      const tilt = airborne && !kind.maxFallSpeed ? clamp(state.vx * 0.02, -MAX_TILT_DEG, MAX_TILT_DEG) : 0;
      bodyEl.style.transform = `rotate(${tilt}deg) scaleX(${state.facing})`;
      // The ring stays on the floor like a shadow and shrinks as the pet goes higher.
      ringEl.style.transform = `translateY(${state.y}px) scale(${1 / (1 + state.y / 250)})`;
      petEl.classList.toggle('walking', state.mode === 'walk');
      petEl.classList.toggle('dragging', state.mode === 'drag');
      petEl.classList.toggle('sleeping', state.mode === 'sleep');
      petEl.classList.toggle('flying', state.mode === 'fly');
      petEl.classList.toggle('gliding', airborne && Boolean(kind.maxFallSpeed));
    }

    // ---- Pointer: click to pet, drag to carry or throw ----
    let press = null;

    petEl.addEventListener('pointerdown', (e) => {
      const rect = petEl.getBoundingClientRect();
      press = {
        startX: e.clientX, startY: e.clientY,
        offX: e.clientX - rect.left, offY: e.clientY - rect.top,
        moved: false,
        samples: [], // recent { t, x, y } pointer positions, for throw speed
      };
      petEl.setPointerCapture(e.pointerId);
      e.preventDefault();
    });

    petEl.addEventListener('pointermove', (e) => {
      if (!press) return;
      if (!press.moved && Math.hypot(e.clientX - press.startX, e.clientY - press.startY) < 4) return;
      press.moved = true;
      wake();
      state.mode = 'drag';
      refreshWorld();
      const p = L.dragPosition(
        { x: e.clientX, y: e.clientY }, { x: press.offX, y: press.offY }, world, h, window.innerHeight,
      );
      state.x = clamp(p.x, 0, maxX());
      state.y = clamp(p.y, 0, maxY());
      dirty = true;

      const t = performance.now();
      press.samples.push({ t, x: e.clientX, y: e.clientY });
      while (press.samples.length > 2 && t - press.samples[0].t > THROW_SAMPLE_MS) press.samples.shift();
    });

    petEl.addEventListener('pointerup', () => {
      if (!press) return;
      if (press.moved) {
        const v = kind.throwable === false ? { vx: 0, vy: 0 } : throwVelocity(press.samples);
        state.vx = v.vx;
        state.vy = v.vy;
        state.mode = 'fall';
      } else if (state.mode === 'sleep') {
        // Clicking a napping pet wakes it up.
        wake();
        goIdle(performance.now());
        say(kind.sound ? kind.sound.replace('!', '?') : '♥');
      } else {
        // Clicked: hop and make its sound.
        if (state.y === 0) {
          state.vx = 0;
          state.vy = kind.hopSpeed ?? HOP_SPEED;
          state.mode = 'fall';
        }
        say(kind.sound ?? '♥');
        lick();
      }
      press = null;
    });

    return {
      id: status.projectId,
      step,
      render,
      start(now) {
        goIdle(now);
        render();
      },
      // xRatio: position as a fraction of the world's width, so it survives resizes.
      restore(xRatio = defaultXRatio) {
        state.x = clamp(xRatio * maxX(), 0, maxX());
      },
      xRatio: () => (maxX() ? state.x / maxX() : 0),
      clampToWorld() {
        refreshWorld();
        state.x = clamp(state.x, 0, maxX());
        state.y = clamp(state.y, 0, maxY());
        state.targetX = clamp(state.targetX, 0, maxX());
      },
      remove() {
        petEl.remove();
      },
    };
  }

  let pets = [];
  let statuses = null; // the petStatuses the current pets were built from
  let positions = {};  // saved x positions: { [projectId]: { xRatio } }
  let hidden = false;
  let dirty = false;

  // ---- Storage ----
  // After the extension is reloaded, old content scripts lose access to chrome.*.
  const alive = () => Boolean(chrome.runtime?.id);
  // A newer copy of this script replaced this one (its host is gone): stop reacting.
  const stale = () => !host.isConnected || !alive();

  // One pet per status. keepPlaces: the current pets stay where they are (a mood or project
  // changed); otherwise every pet goes to its saved position.
  function rebuild(next, keepPlaces) {
    if (keepPlaces) for (const pet of pets) positions[pet.id] = { xRatio: pet.xRatio() };
    pets.forEach((pet) => pet.remove());
    statuses = next;
    const list = (next?.pets ?? []).filter((s) => KINDS[s.petKind]);
    pets = list.map((s, i) => createPet(s, i, list.length));
    const now = performance.now();
    for (const pet of pets) {
      pet.restore(positions[pet.id]?.xRatio);
      pet.start(now);
    }
  }

  async function load() {
    if (stale()) return;
    const { pets: saved = {}, petHidden = false, petStatuses = null } =
      await chrome.storage.local.get(['pets', 'petHidden', 'petStatuses']);
    positions = saved;
    if (!L.statusesEqual(statuses, petStatuses)) rebuild(petStatuses, false);
    else for (const pet of pets) pet.restore(saved[pet.id]?.xRatio);
    setHidden(petHidden);
  }

  function save() {
    // Only the tab you're looking at writes, so background tabs don't fight over positions.
    if (!dirty || stale() || document.visibilityState !== 'visible') return;
    dirty = false;
    for (const pet of pets) positions[pet.id] = { xRatio: pet.xRatio() };
    chrome.storage.local.set({ pets: positions }).catch(() => {});
  }

  function setHidden(value) {
    hidden = Boolean(value);
    host.style.display = hidden ? 'none' : '';
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || stale()) return;
    if (changes.petHidden) setHidden(changes.petHidden.newValue);
    if (changes.petStatuses && !L.statusesEqual(statuses, changes.petStatuses.newValue ?? null)) {
      rebuild(changes.petStatuses.newValue ?? null, true);
    }
  });

  // ---- On the Studium page: copy its pet statuses for every tab ----
  const onStudium = L.isStudiumUrl(location.href);

  function copyStatusesFromStudium() {
    if (stale()) return;
    let raw = null;
    try {
      raw = localStorage.getItem(L.PET_STATUS_KEY);
    } catch {
      return; // storage is blocked on this page
    }
    const parsed = L.parseStatuses(raw);
    if (parsed) chrome.storage.local.set({ petStatuses: parsed }).catch(() => {});
  }

  if (onStudium) {
    window.addEventListener(L.PET_STATUS_EVENT, copyStatusesFromStudium);
    copyStatusesFromStudium();
  }

  // When you come back to this tab, pick up wherever the pets were in the other tab.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') load();
    else save();
  });
  window.addEventListener('pagehide', save);
  setInterval(save, SAVE_EVERY_MS);

  window.addEventListener('resize', () => pets.forEach((pet) => pet.clampToWorld()));

  // ---- Loop ----
  let last = performance.now();
  function loop(now) {
    if (!host.isConnected) return; // replaced by a newer copy of this script
    const dt = Math.min(0.05, (now - last) / 1000); // cap so a background tab doesn't teleport
    last = now;
    if (!hidden) {
      for (const pet of pets) {
        pet.step(now, dt);
        pet.render();
      }
    }
    requestAnimationFrame(loop);
  }

  // ---- Start ----
  load().then(() => requestAnimationFrame(loop));
})();
```

- [ ] **Step 6: Run the check to verify it passes**

Run: `node ext-check.mjs "<repo>/extension" statuses`
Expected: exit code 0, every line `PASS`. If `example.com` can't be reached, point `OTHER` at any other reachable `http(s)` page that isn't on `localhost:5173`.
Run (from `web/`): `npm test`
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add ../extension/manifest.json ../extension/background.js ../extension/content/pet.js
git commit -m "feat(extension): build pets from Studium's statuses and act out their moods" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Habitat mode

**Files:**
- Modify: `extension/content/pet.js` (Task 5's version)
- Test: scratch `ext-check.mjs`, mode `habitat`

**Interfaces:**
- Consumes: Task 4 (`worldFromRect`, `habitatClip`), Task 5 (`createPet`, `rebuild`, `load`, `save`, `setHidden`, `onStudium`, `stale`, `loop`), Task 3 (Studium shows the still picture when `data-pet-attached` is removed).
- Produces:
  - Pet methods `setShown(value)`, `isShown()`, `boxEl()`, `enterBox(el)`, `leaveBox(xRatio)`.
  - Top-level `habitatEl`, `habitatPet()`, `markAttached()`, `applyHabitat()`, `checkHabitat()`.
  - On the Studium origin, while `[data-pet-habitat]` exists: only that project's pet shows, it lives in the box, and the box has `data-pet-attached` unless pets are hidden.

- [ ] **Step 1: Fill in the habitat part of `ext-check.mjs`**

Replace

```js
if (mode === "habitat" || mode === "all") {
  // Filled in by Task 6.
}
```

with:

```js
if (mode === "habitat" || mode === "all") {
  const studium = await ctx.newPage();
  await studium.goto(STUDIUM);
  await studium.getByRole("heading", { name: "Your Projects" }).waitFor();
  check("every pet roams the Studium overview", await until(async () => (await shown(studium)).length >= 5));
  const total = (await shown(studium)).length;

  await studium.getByRole("button", { name: /Animation/ }).first().click();
  await studium.getByRole("heading", { name: "Requirements" }).waitFor();
  const box = studium.locator('[data-pet-habitat="Animation"]');
  await box.scrollIntoViewIfNeeded();
  check(
    "only the project's pet shows on its page",
    await until(async () => {
      const s = await shown(studium);
      return s.length === 1 && s[0].label.startsWith("Animation");
    }),
  );
  check("the box is marked as attached", await until(async () => (await box.getAttribute("data-pet-attached")) !== null));
  await wait(1200);
  check("no still picture while the pet is there", (await box.locator("img").count()) === 0);

  const inside = async () => {
    const b = await box.boundingBox();
    const [p] = await shown(studium);
    return Boolean(
      p && b && p.rect.left >= b.x - 1 && p.rect.right <= b.x + b.width + 1 && p.rect.top >= b.y - 1 && p.rect.bottom <= b.y + b.height + 1,
    );
  };
  check("the pet stands inside the habitat", await until(inside));

  // Throw it hard up and to the right; it must stay inside the box the whole time.
  const [p] = await shown(studium);
  const cx = (p.rect.left + p.rect.right) / 2;
  const cy = (p.rect.top + p.rect.bottom) / 2;
  await studium.mouse.move(cx, cy);
  await studium.mouse.down();
  for (let i = 1; i <= 6; i++) {
    await studium.mouse.move(cx + i * 40, cy - i * 30);
    await wait(10);
  }
  await studium.mouse.up();
  let stayed = true;
  for (let i = 0; i < 30; i++) {
    if (!(await inside())) stayed = false;
    await wait(100);
  }
  check("a thrown pet stays inside the habitat", stayed);

  // Hiding pets from the toolbar menu lets Studium show its still picture again.
  await sw.evaluate(() => chrome.storage.local.set({ petHidden: true }));
  check("hiding pets releases the box", await until(async () => (await box.getAttribute("data-pet-attached")) === null));
  check("Studium shows the still picture again", await until(async () => (await box.locator("img").count()) === 1));
  await sw.evaluate(() => chrome.storage.local.set({ petHidden: false }));
  check("showing pets attaches again", await until(async () => (await box.getAttribute("data-pet-attached")) !== null));

  // Going straight to another project moves the right pet into the new box.
  await studium.getByRole("button", { name: /seniorCap/ }).first().click();
  const capBox = studium.locator('[data-pet-habitat="seniorCap"]');
  check(
    "switching projects moves the right pet into the new box",
    await until(async () => {
      const s = await shown(studium);
      return s.length === 1 && s[0].label.startsWith("seniorCap") && (await capBox.getAttribute("data-pet-attached")) !== null;
    }),
  );

  // Back to the overview: every pet returns and nothing is clipped.
  await studium.getByRole("button", { name: "All Projects" }).first().click();
  check("leaving the project page brings every pet back", await until(async () => (await shown(studium)).length === total));
  check(
    "pets are no longer clipped",
    (await studium.evaluate(() => document.getElementById("capstone-pet-host").style.clipPath)) === "",
  );

  // Injecting the scripts again (as after an extension update) leaves one working set of pets.
  const tabId = await sw.evaluate(async () => (await chrome.tabs.query({ url: "http://localhost:5173/*" }))[0].id);
  await sw.evaluate(
    (id) => chrome.scripting.executeScript({ target: { tabId: id }, files: ["content/logic.js", "content/pet.js"] }),
    tabId,
  );
  await wait(1000);
  check(
    "re-injecting the scripts keeps one set of pets",
    (await studium.evaluate(() => document.querySelectorAll("#capstone-pet-host").length)) === 1 &&
      (await shown(studium)).length === total,
  );
}
```

- [ ] **Step 2: Run the check to verify it fails**

Studium must be served as in Task 5. Run: `node ext-check.mjs "<repo>/extension" habitat`
Expected: exit code 1, including `FAIL  only the project's pet shows on its page` and `FAIL  the box is marked as attached`.

- [ ] **Step 3: Make each pet able to live in a box (edit `createPet` in `extension/content/pet.js`)**

Replace:

```js
    // The pet's world: the whole window. Positions are measured from its left wall and floor.
    let world = L.windowWorld(window.innerWidth, window.innerHeight);
    function refreshWorld() {
      world = L.windowWorld(window.innerWidth, window.innerHeight);
    }
```

with:

```js
    // The pet's world: the whole window, or the Studium habitat box it lives in (habitat mode).
    // Positions are measured from the world's left wall and floor; the box is re-read every frame.
    let box = null;
    let shown = true;
    let world = L.windowWorld(window.innerWidth, window.innerHeight);
    function refreshWorld() {
      world = box
        ? L.worldFromRect(box.getBoundingClientRect(), window.innerHeight)
        : L.windowWorld(window.innerWidth, window.innerHeight);
    }
```

Replace (the end of `createPet`'s returned object):

```js
      remove() {
        petEl.remove();
      },
    };
```

with:

```js
      remove() {
        petEl.remove();
      },
      setShown(value) {
        shown = value;
        petEl.style.display = value ? '' : 'none';
      },
      isShown: () => shown,
      boxEl: () => box,
      // Habitat mode: move into the box and start in the middle of its floor.
      enterBox(el) {
        box = el;
        refreshWorld();
        wake();
        Object.assign(state, { x: maxX() / 2, y: 0, vx: 0, vy: 0 });
        goIdle(performance.now());
      },
      // Back to the whole window, at its saved floor position.
      leaveBox(xRatio = defaultXRatio) {
        box = null;
        refreshWorld();
        wake();
        Object.assign(state, { x: clamp(xRatio * maxX(), 0, maxX()), y: 0, vx: 0, vy: 0 });
        goIdle(performance.now());
      },
    };
```

- [ ] **Step 4: Keep box positions out of the saved window positions**

In `rebuild`, replace:

```js
    if (keepPlaces) for (const pet of pets) positions[pet.id] = { xRatio: pet.xRatio() };
```

with:

```js
    if (keepPlaces) for (const pet of pets) if (!pet.boxEl()) positions[pet.id] = { xRatio: pet.xRatio() };
```

and at the end of `rebuild`, replace:

```js
    for (const pet of pets) {
      pet.restore(positions[pet.id]?.xRatio);
      pet.start(now);
    }
  }
```

with:

```js
    for (const pet of pets) {
      pet.restore(positions[pet.id]?.xRatio);
      pet.start(now);
    }
    applyHabitat();
  }
```

In `load`, replace:

```js
    else for (const pet of pets) pet.restore(saved[pet.id]?.xRatio);
```

with:

```js
    else for (const pet of pets) if (!pet.boxEl()) pet.restore(saved[pet.id]?.xRatio);
```

In `save`, replace:

```js
    for (const pet of pets) positions[pet.id] = { xRatio: pet.xRatio() };
    chrome.storage.local.set({ pets: positions }).catch(() => {});
```

with:

```js
    for (const pet of pets) if (!pet.boxEl()) positions[pet.id] = { xRatio: pet.xRatio() };
    chrome.storage.local.set({ pets: positions }).catch(() => {});
```

In `setHidden`, replace:

```js
    host.style.display = hidden ? 'none' : '';
  }
```

with:

```js
    host.style.display = hidden ? 'none' : '';
    markAttached();
  }
```

- [ ] **Step 5: Add habitat mode**

Insert directly above `  // ---- Loop ----`:

```js
  // ---- Habitat mode (Studium project pages) ----
  // A Studium project page has <div data-pet-habitat="<projectId>">. While it's there, only that
  // project's pet shows, living inside the box, and the box gets data-pet-attached so Studium hides
  // its still picture. React can replace the box at any time (switching projects).
  let habitatEl = null;
  const habitatPet = () => (habitatEl ? pets.find((pet) => pet.id === habitatEl.dataset.petHabitat) : undefined);

  function markAttached() {
    if (habitatEl) habitatEl.toggleAttribute('data-pet-attached', !hidden && Boolean(habitatPet()));
  }

  function applyHabitat() {
    const inside = habitatPet();
    for (const pet of pets) {
      pet.setShown(!habitatEl || pet === inside);
      if (pet === inside && pet.boxEl() !== habitatEl) pet.enterBox(habitatEl);
      if (pet !== inside && pet.boxEl()) pet.leaveBox(positions[pet.id]?.xRatio);
    }
    markAttached();
  }

  function checkHabitat() {
    if (stale()) {
      habitatObserver?.disconnect();
      return;
    }
    const el = document.querySelector('[data-pet-habitat]');
    if (el === habitatEl) return;
    if (habitatEl?.isConnected) habitatEl.removeAttribute('data-pet-attached');
    habitatEl = el;
    applyHabitat();
  }

  const habitatObserver = onStudium ? new MutationObserver(checkHabitat) : null;
  habitatObserver?.observe(document.documentElement, { childList: true, subtree: true });
```

In `loop`, replace:

```js
    if (!hidden) {
      for (const pet of pets) {
        pet.step(now, dt);
        pet.render();
      }
    }
```

with:

```js
    if (!hidden) {
      for (const pet of pets) {
        if (!pet.isShown()) continue;
        pet.step(now, dt);
        pet.render();
      }
    }
    // In habitat mode, draw only inside the box, so the pet can't cover the page when it scrolls away.
    host.style.clipPath = habitatPet()
      ? L.habitatClip(habitatEl.getBoundingClientRect(), window.innerWidth, window.innerHeight)
      : '';
```

Replace the start line:

```js
  load().then(() => requestAnimationFrame(loop));
```

with:

```js
  load().then(() => {
    if (onStudium) checkHabitat();
    requestAnimationFrame(loop);
  });
```

- [ ] **Step 6: Run the checks to verify they pass**

Run: `node ext-check.mjs "<repo>/extension" all`
Expected: exit code 0, every line `PASS`. That is both parts: statuses still work, and habitat mode works.
Run (from `web/`): `npm test` and `npm run build`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add ../extension/content/pet.js
git commit -m "feat(extension): live in the habitat box on Studium project pages" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Docs and final check

**Files:**
- Modify: `README.md`, `HANDOFF.md`

**Interfaces:**
- Consumes: everything above.
- Produces: documentation only.

- [ ] **Step 1: Update `README.md`**

- Under **Load the extension → Using it**, replace the first bullet with these two:
  - `Open Studium (click the toolbar icon) once: that's where the pets come from. Until then there are none, and the icon's tooltip says so.`
  - `One pet per Studium project wanders along the bottom of every normal web page. Its mood follows the project: happy pets are quicker and chattier, worried and upset ones slow down, and a sick pet looks green and sneezes. Drag it to move it, or click it to make it hop.`
- Add the bullet: `On a Studium project page, only that project's pet shows, living inside the page's habitat box.`
- In **Where to change things**, replace the `Which project gets which pet` and `Homepage URL the icon opens` rows with:

```markdown
| Which pet a project gets | the egg picker in Studium's New Project form |
| How mood changes a pet | `MOOD_EFFECTS` in `extension/content/logic.js` |
| Studium's address (the icon opens it; pets read it) | `HOMEPAGE_URL` in `extension/content/logic.js` |
```

- In **Ideas for next steps**, remove the bullets about pet stats with `externally_connectable` and about completing tasks rewarding the pet (both are now done another way).

- [ ] **Step 2: Update `HANDOFF.md`**

- "Start here": Plans 1–3 are done. Give the next step as a choice for the user to make:
  - deploy Studium somewhere other than `localhost` (then change `HOMEPAGE_URL` in `extension/content/logic.js`); or
  - the deferred ideas (pet lifecycle, using food, clothes and toys, sprite animation).
  - Note which branch Plan 3 ended on and whether it was pushed or merged.
- "Status" table: add Plan 3 as done, with its branch and the final test count.
- "The project": the extension now builds its pets from Studium (`petStatuses` in chrome.storage); `PROJECTS` is gone.
- "Code map": add `extension/content/logic.js`, `web/src/store/petStatus.ts` and `web/src/extension/petLogic.test.ts`.
- "Gotchas":
  - Playwright can load the extension headless with `chromium.launchPersistentContext("", { channel: "chromium", args: ["--disable-extensions-except=…", "--load-extension=…"] })`.
  - Nothing in `extension/` may start with `_`, and there is no `node_modules` there, because Chrome refuses such folders.
  - Add any rulings from this plan's ledger.

- [ ] **Step 3: Run the full suite, the build and the browser check**

Run (from `web/`): `npm test`
Expected: all test files pass (Plan 2's 183 plus this plan's 23).
Run: `npm run build`
Expected: build succeeds.
Run (scratch): `node ext-check.mjs "<repo>/extension" all`
Expected: exit code 0.

- [ ] **Step 4: Commit**

```bash
git add ../README.md ../HANDOFF.md
git commit -m "docs: describe the pets' link to Studium" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Coverage map (spec section 5 and section 8 browser checks → task)

| Spec item | Task |
|---|---|
| Studium writes `studium-pets-v1` (PetStatus shape) after every change and dispatches `studium:pets-updated` | 1, 2 |
| Rewritten on load and once an hour | 2 |
| Content script on Studium reads it on load and on the event, saves to `chrome.storage.local` as `petStatuses` | 5 |
| Every tab listens and rebuilds its pets | 5 |
| Hard-coded `PROJECTS` removed; no pets and a tooltip until Studium is opened; positions keyed by project id | 5 |
| Habitat mode: MutationObserver, only the matching pet, world = box (re-read each frame), drag/throw inside, `data-pet-attached` | 6 |
| Habitat removed: pets back to normal, habitat pet back at its saved floor position | 6 |
| Mood behavior table (speed, sounds, extra hop, "…", pauses, nap ×1.5, sick tint, no naps or flying, achoo) | 4, 5 |
| "Haven't seen <title> in N days", at most every 2 minutes | 4, 5 |
| Browser check: only that project's pet in the habitat, stays inside after a throw, leaving restores all pets, mood change reaches another tab | 5, 6 |
| Still picture when the extension isn't attached (Studium side, both ways) | 3 |

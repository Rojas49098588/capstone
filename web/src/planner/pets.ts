// A project's pets: the first pet is the project itself (its id is the project id, so all state
// saved before bought pets keeps working); pets bought in the Shop follow it, each in its own habitat.
// A habitat is keyed by its pet's id: the project id for the first pet, the pet id for the others.
import { withSnack } from "./food";
import { lastCompletionAt, lastMedicineGiven } from "./history";
import { estimateMultipliers, multiplierFor, type Multipliers } from "./learning";
import { petStage } from "./lifecycle";
import { capAtWorried, lowerOneLevel, moodFromGap, neglectDays, projectMood, requirementIdleDays, sickDays, type ProjectMood } from "./mood";
import { projectDifficulty } from "./projectKind";
import { isRequirementDone, plannedProgress, requirementProgress, tasksOfRequirement } from "./progress";
import { DAY_MS } from "./time";
import { EGG_HATCH_SHARE, GROW_UP_SHARE, MAX_PETS_PER_PROJECT, RECOVERY_DAYS } from "./tuning";
import type { ExtraPet, Mood, PetKind, PetStage, Project, StudiumData, StudiumEvent } from "./types";

export type PetRef = {
  projectId: string;
  petId: string;
  habitatId: string;
  kind: PetKind;
  stage: PetStage;
  name: string | null; // the first pet's is the project's nickname; a bought pet's is null until named
  caresFor: string | null; // a requirement id; null = shares the project's mood
  hatchedAt: string | null;
  first: boolean;
};

/** The first pet, then the bought pets in the order they were bought. */
export function petsOf(project: Project): PetRef[] {
  const first: PetRef = {
    projectId: project.id,
    petId: project.id,
    habitatId: project.id,
    kind: project.petKind,
    stage: petStage(project),
    name: project.shortName,
    caresFor: null,
    hatchedAt: project.hatchedAt,
    first: true,
  };
  const bought = (project.pets ?? []).map(
    (p): PetRef => ({
      projectId: project.id,
      petId: p.id,
      habitatId: p.id,
      kind: p.kind,
      stage: p.stage,
      name: p.name,
      caresFor: p.caresFor,
      hatchedAt: p.hatchedAt,
      first: false,
    }),
  );
  return [first, ...bought];
}

/** Every habitat's id, in project order. */
export function habitatIds(data: Pick<StudiumData, "projects">): string[] {
  return data.projects.flatMap((p) => petsOf(p).map((pet) => pet.habitatId));
}

export function findPet(data: Pick<StudiumData, "projects">, habitatId: string): PetRef | undefined {
  for (const p of data.projects) {
    const pet = petsOf(p).find((x) => x.habitatId === habitatId);
    if (pet) return pet;
  }
  return undefined;
}

// ---- Growing up and bought eggs hatching ----

export type Work = { done: number; total: number };

/**
 * Work on the given (current) tasks since a moment, by each task's FIRST completion: `done` counts
 * tasks first completed after it; `total` counts tasks still open then (or added since).
 */
export function workSince(taskIds: string[], events: StudiumEvent[], since: string): Work {
  const ids = new Set(taskIds);
  const firstDone = new Map<string, number>();
  for (const e of events) {
    if (e.type !== "task_completed" || !ids.has(e.taskId)) continue;
    firstDone.set(e.taskId, Math.min(firstDone.get(e.taskId) ?? Infinity, Date.parse(e.at)));
  }
  const t0 = Date.parse(since);
  let done = 0;
  let before = 0;
  for (const at of firstDone.values()) {
    if (at > t0) done++;
    else before++;
  }
  return { done, total: ids.size - before };
}

/** At least one task done, and at least `share` of the total. */
export function reached(w: Work, share: number): boolean {
  return w.done >= 1 && w.done >= w.total * share;
}

export type PetNews = { kind: "hatched" | "grewUp"; projectId: string; habitatId: string };

/** The tasks a pet cares about: its requirement's, or the whole project's. */
function scopeTaskIds(data: StudiumData, projectId: string, caresFor: string | null): string[] {
  const tasks = caresFor ? tasksOfRequirement(caresFor, data.tasks) : data.tasks.filter((t) => t.projectId === projectId);
  return tasks.map((t) => t.id);
}

function eggReady(data: StudiumData, projectId: string, boughtAt: string): boolean {
  return data.requirements
    .filter((r) => r.projectId === projectId)
    .some((r) => {
      const w = workSince(scopeTaskIds(data, projectId, r.id), data.events, boughtAt);
      return reached(w, EGG_HATCH_SHARE) || (w.done >= 1 && isRequirementDone(r.id, data.tasks));
    });
}

const grows = (data: StudiumData, projectId: string, caresFor: string | null, hatchedAt: string | null) =>
  hatchedAt !== null && reached(workSince(scopeTaskIds(data, projectId, caresFor), data.events, hatchedAt), GROW_UP_SHARE);

/**
 * Brings every pet up to date after a change: a pet whose requirement is finished or gone goes back to
 * sharing, a bought egg hatches, a juvenile grows up. Saved changes are never undone. Returns the same
 * data object when nothing changed.
 */
export function settlePets(data: StudiumData, now: Date): { data: StudiumData; news: PetNews[] } {
  const news: PetNews[] = [];
  const at = now.toISOString();
  const openRequirement = (id: string, projectId: string) =>
    data.requirements.some((r) => r.id === id && r.projectId === projectId) && !isRequirementDone(id, data.tasks);
  let changed = false;
  const projects = data.projects.map((project) => {
    let next = project;
    if (project.stage === "juvenile" && grows(data, project.id, null, project.hatchedAt)) {
      next = { ...next, stage: "adult" };
      news.push({ kind: "grewUp", projectId: project.id, habitatId: project.id });
    }
    let petsChanged = false;
    const pets = (project.pets ?? []).map((pet) => {
      let p: ExtraPet = pet;
      if (p.stage === "egg" && eggReady(data, project.id, p.boughtAt)) {
        p = { ...p, stage: "juvenile", hatchedAt: at };
        news.push({ kind: "hatched", projectId: project.id, habitatId: p.id });
      } else if (p.stage === "juvenile" && grows(data, project.id, p.caresFor, p.hatchedAt)) {
        // Measured on what it cared about before the reset below: finishing its own requirement counts.
        p = { ...p, stage: "adult" };
        news.push({ kind: "grewUp", projectId: project.id, habitatId: p.id });
      }
      if (p.caresFor !== null && !openRequirement(p.caresFor, project.id)) p = { ...p, caresFor: null };
      if (p !== pet) petsChanged = true;
      return p;
    });
    if (petsChanged) next = { ...next, pets };
    if (next !== project) changed = true;
    return next;
  });
  return { data: changed ? { ...data, projects } : data, news };
}

// ---- A pet's mood and health ----

/**
 * How a pet feels. A pet sharing the project's mood feels exactly what the project's pet feels. A pet
 * looking after a requirement gets the project's rules applied to that requirement alone, with its own
 * health: sick after the requirement's long neglect, recovering after a dose given to this pet. Null for an egg.
 */
export function petMood(pet: PetRef, data: StudiumData, now: Date, multipliers: Multipliers = estimateMultipliers(data)): ProjectMood | null {
  if (pet.stage === "egg") return null;
  const project = data.projects.find((p) => p.id === pet.projectId);
  const req = pet.caresFor ? data.requirements.find((r) => r.id === pet.caresFor && r.projectId === pet.projectId) : undefined;
  if (!project || !req) return withSnack(projectMood(pet.projectId, data, now, multipliers), pet.petId, data.events, now);

  const done = isRequirementDone(req.id, data.tasks);
  const planned = plannedProgress(req, project, now);
  const gap = (requirementProgress(req.id, data.tasks, multiplierFor(multipliers, project.id)) - planned) * 100;
  const idleDays = requirementIdleDays(req, data, now);
  const started = !done && planned > 0;
  const neglected = started && idleDays >= neglectDays(project) ? [{ requirement: req, idleDays }] : [];

  const medAt = lastMedicineGiven(data.events, project.id, now, pet.petId);
  const taskIds = tasksOfRequirement(req.id, data.tasks).map((t) => t.id);
  const movedSince = (at: Date) => {
    const last = lastCompletionAt(data.events, taskIds, now);
    return last !== null && last > at;
  };
  const recovering = medAt !== null && now.getTime() - medAt.getTime() < RECOVERY_DAYS * DAY_MS && !movedSince(medAt);
  const sick = !recovering && started && idleDays >= sickDays(project);

  let mood: Mood = done ? "Proud" : moodFromGap(gap, projectDifficulty(project));
  if (neglected.length > 0) mood = lowerOneLevel(mood);
  if (sick) mood = "Sick";
  else if (recovering) mood = capAtWorried(mood);
  const health = { sick, recovering, recoveringFor: recovering ? [req.id] : [] };
  return withSnack({ mood, gap, neglected, health, liftedFrom: null }, pet.petId, data.events, now);
}

// ---- Buying eggs and naming pets ----

/** The purchase event's product id for an egg (it is never in SHOP_PRODUCTS: priceOf stays undefined). */
export function eggProductId(kind: PetKind): string {
  return `egg-${kind}`;
}

/** Why a project can't get another egg now: its own egg hasn't hatched, a bought egg waits, or it has 4 pets. */
export type EggRefusal = "firstEgg" | "eggWaiting" | "full";

export function eggRefusal(project: Project): EggRefusal | null {
  if (petStage(project) === "egg") return "firstEgg";
  const pets = project.pets ?? [];
  if (pets.some((p) => p.stage === "egg")) return "eggWaiting";
  if (pets.length + 1 >= MAX_PETS_PER_PROJECT) return "full";
  return null;
}

const capitalized = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

/** "Frog", or "Frog 2", "Frog 3"… if another pet in the project already has that name. */
export function suggestedPetName(project: Project, kind: PetKind): string {
  const taken = new Set(petsOf(project).map((p) => (p.name ?? "").trim().toLowerCase()));
  const base = capitalized(kind);
  if (!taken.has(base.toLowerCase())) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base} ${n}`.toLowerCase())) return `${base} ${n}`;
}

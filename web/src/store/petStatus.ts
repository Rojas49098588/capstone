// Tells the browser extension how each project's pet is doing (spec section 5).
// The extension's content script reads this key on the Studium page and on PET_STATUS_EVENT.
import { isBlocked } from "../planner/blocking";
import { estimateMultipliers } from "../planner/learning";
import { petMood, petsOf, suggestedPetName, type PetRef } from "../planner/pets";
import { projectMood } from "../planner/mood";
import { suggestNext, todayTaskIds } from "../planner/suggest";
import type { DecorSlot, Mood, PetKind, StudiumData } from "../planner/types";
import { DECOR_SLOTS, findDecor, type FurnitureUse } from "./decor";

export const PET_STATUS_KEY = "studium-pets-v1";
export const PET_STATUS_EVENT = "studium:pets-updated";
/** Moods change with time even without edits, so statuses are rewritten this often. */
export const PET_STATUS_REFRESH_MS = 3_600_000;

// Pet interactions (naps, the mailbox, Wake). The extension's content/logic.js uses the same names.
/** The extension sends finished naps; `detail` is a JSON string of FocusSession[]. */
export const FOCUS_SESSIONS_EVENT = "studium:focus-sessions";
/** Studium's answer once they're saved; `detail` is a JSON string of the handled ids. */
export const FOCUS_RECEIVED_EVENT = "studium:focus-received";
/** Studium is listening for FOCUS_SESSIONS_EVENT. */
export const STUDIUM_READY_EVENT = "studium:ready";
/** The habitat's Wake button; `detail` is the habitat id (the pet id). */
export const WAKE_PET_EVENT = "studium:wake-pet";
/** A task was checked off; `detail` is its id. A pet napping on it wakes up early with congrats. */
export const TASK_DONE_EVENT = "studium:task-done";
/** Set by the extension on the habitat box while its pet is away: "<nap|sleep>:<ISO time it returns>". */
export const PET_AWAY_ATTR = "data-pet-away";

export type PetSuggestion = { taskId: string; title: string; estimateMin: number };
/** A task the pet offers when it's sent to nap ("What are you going to work on while I nap?"). */
export type NapTask = PetSuggestion & { group: "today" | "suggested" };
/** How many of Suggested next's tasks a nap offers, after the project's Today tasks. */
export const NAP_SUGGESTED_MAX = 5;
/** "firstTask" (the project's first completed task) and "requirement" celebrate bigger. */
export type CelebrationKind = "task" | "firstTask" | "requirement";
export type PetCelebration = { at: string; kind: CelebrationKind };

export type PetStatus = {
  petId: string; // the first pet's is its project id; a bought pet's is its own (planner/pets.ts)
  projectId: string;
  shortName: string;
  name: string;
  color: string;
  petKind: PetKind;
  mood: Mood;
  recovering: boolean;
  idleRequirement: { title: string; days: number } | null;
  suggestion: PetSuggestion | null; // what "What should I work on?" names
  napTasks: NapTask[]; // what a nap offers to focus on: this project's Today tasks, then suggestions
  celebration: PetCelebration | null; // the project's latest completion
  furniture: PetFurniture[]; // what the pet can use in its habitat
  deadline: string; // the project's "YYYY-MM-DD" due date, for "Which pets show first"
  stage: "juvenile" | "adult"; // eggs aren't sent at all: they stay in Studium's habitat
};

export type PetFurniture = { use: FurnitureUse; slot: DecorSlot };

export type PetStatuses = { updatedAt: string; pets: PetStatus[] };

/** Something kept per project and per requirement: a pet sees its project's, or its requirement's. */
type Scoped<T> = { project: Map<string, T>; requirement: Map<string, T> };
const scoped = <T>(): Scoped<T> => ({ project: new Map(), requirement: new Map() });
const forPet = <T>(s: Scoped<T>, pet: PetRef): T | undefined =>
  pet.caresFor ? s.requirement.get(pet.caresFor) : s.project.get(pet.projectId);

type Candidate = { id: string; projectId: string; requirementId: string | null; title: string; estimateMin: number };

/** Open, linked, unblocked tasks in the order pets offer them: Today's plan, then Suggested next. */
function candidates(data: StudiumData, now: Date): { task: Candidate; group: NapTask["group"] }[] {
  const out: { task: Candidate; group: NapTask["group"] }[] = [];
  const byId = new Map(data.tasks.map((t) => [t.id, t]));
  for (const id of todayTaskIds(data, now)) {
    const t = byId.get(id);
    if (t && !t.done && t.requirementId !== null && !isBlocked(t, data)) out.push({ task: t, group: "today" });
  }
  for (const s of suggestNext(data, now, Infinity)) out.push({ task: s.task, group: "suggested" });
  return out;
}

/** What "What should I work on?" names: the first candidate, per project and per requirement. */
function suggestions(list: ReturnType<typeof candidates>): Scoped<PetSuggestion> {
  const out = scoped<PetSuggestion>();
  for (const { task: t } of list) {
    const value = { taskId: t.id, title: t.title, estimateMin: t.estimateMin };
    if (!out.project.has(t.projectId)) out.project.set(t.projectId, value);
    if (t.requirementId && !out.requirement.has(t.requirementId)) out.requirement.set(t.requirementId, value);
  }
  return out;
}

/** A nap's choices: the Today tasks in Today's order, then up to NAP_SUGGESTED_MAX suggestions. */
function napChoices(list: ReturnType<typeof candidates>): Scoped<NapTask[]> {
  const out = scoped<NapTask[]>();
  const add = (map: Map<string, NapTask[]>, key: string, t: Candidate, group: NapTask["group"]) => {
    const tasks = map.get(key) ?? [];
    if (group === "suggested" && tasks.filter((n) => n.group === "suggested").length >= NAP_SUGGESTED_MAX) return;
    tasks.push({ taskId: t.id, title: t.title, estimateMin: t.estimateMin, group });
    map.set(key, tasks);
  };
  for (const { task, group } of list) {
    add(out.project, task.projectId, task, group);
    if (task.requirementId) add(out.requirement, task.requirementId, task, group);
  }
  return out;
}

/** The latest completion, per project and per requirement. Every completion celebrates; some celebrate bigger. */
function celebrations(data: StudiumData): Scoped<PetCelebration> {
  const taskOf = new Map(data.tasks.map((t) => [t.id, t]));
  const requirementProject = new Map(data.requirements.map((r) => [r.id, r.projectId]));
  const out = scoped<PetCelebration>();
  for (const e of data.events) {
    if (e.type !== "task_completed") continue;
    const requirementId = e.requirementId ?? taskOf.get(e.taskId)?.requirementId ?? null;
    const projectId = taskOf.get(e.taskId)?.projectId ?? (requirementId ? requirementProject.get(requirementId) : undefined);
    if (!projectId) continue;
    const first = !out.project.has(projectId);
    const kind: CelebrationKind = e.breakdown.finish > 0 ? "requirement" : first ? "firstTask" : "task";
    out.project.set(projectId, { at: e.at, kind });
    if (requirementId) out.requirement.set(requirementId, { at: e.at, kind });
  }
  return out;
}

/** The habitat's bed (any pet) and the furniture made for this kind of pet, in slot order. */
function furnitureFor(habitatId: string, kind: PetKind, data: StudiumData): PetFurniture[] {
  const habitat = data.decor?.[habitatId] ?? {};
  const out: PetFurniture[] = [];
  for (const slot of DECOR_SLOTS) {
    const item = habitat[slot] ? findDecor(habitat[slot] as string) : undefined;
    if (item?.use && (item.type === "bed" || item.forKind === kind)) out.push({ use: item.use, slot });
  }
  return out;
}

/**
 * One status per hatched pet (eggs stay in Studium), in project order then pet order. The first pet's
 * petId is its project id; a bought pet's label (shortName) is its name, or its suggested name until named.
 */
export function buildPetStatuses(data: StudiumData, now: Date): PetStatuses {
  const multipliers = estimateMultipliers(data);
  const list = candidates(data, now);
  const suggested = suggestions(list);
  const naps = napChoices(list);
  const celebrated = celebrations(data);
  const pets: PetStatus[] = [];
  for (const project of data.projects) {
    for (const pet of petsOf(project)) {
      if (pet.stage === "egg") continue;
      const m = petMood(pet, data, now, multipliers) ?? projectMood(project.id, data, now, multipliers);
      const idlest = m.neglected[0];
      pets.push({
        petId: pet.petId,
        projectId: project.id,
        shortName: pet.name ?? suggestedPetName(project, pet.kind),
        name: project.name,
        color: project.color,
        deadline: project.deadline,
        petKind: pet.kind,
        mood: m.mood,
        recovering: m.health.recovering,
        idleRequirement: idlest ? { title: idlest.requirement.title, days: idlest.idleDays } : null,
        suggestion: forPet(suggested, pet) ?? null,
        napTasks: forPet(naps, pet) ?? [],
        celebration: forPet(celebrated, pet) ?? null,
        furniture: furnitureFor(pet.habitatId, pet.kind, data),
        stage: pet.stage === "juvenile" ? "juvenile" : "adult",
      });
    }
  }
  return { updatedAt: now.toISOString(), pets };
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

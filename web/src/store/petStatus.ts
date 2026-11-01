// Tells the browser extension how each project's pet is doing (spec section 5).
// The extension's content script reads this key on the Studium page and on PET_STATUS_EVENT.
import { isBlocked } from "../planner/blocking";
import { estimateMultipliers } from "../planner/learning";
import { petStage } from "../planner/lifecycle";
import { projectMood } from "../planner/mood";
import { suggestNext, todayTaskIds } from "../planner/suggest";
import type { DecorSlot, Mood, PetKind, Project, StudiumData } from "../planner/types";
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
/** The habitat's Wake button; `detail` is the project id. */
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

/** The project's first open, linked, unblocked task: Today's plan first, then Suggested next's order. */
function suggestionsByProject(data: StudiumData, now: Date): Map<string, PetSuggestion> {
  const out = new Map<string, PetSuggestion>();
  const add = (t: { id: string; projectId: string; title: string; estimateMin: number }) => {
    if (!out.has(t.projectId)) out.set(t.projectId, { taskId: t.id, title: t.title, estimateMin: t.estimateMin });
  };
  const byId = new Map(data.tasks.map((t) => [t.id, t]));
  for (const id of todayTaskIds(data, now)) {
    const t = byId.get(id);
    if (t && !t.done && t.requirementId !== null && !isBlocked(t, data)) add(t);
  }
  for (const s of suggestNext(data, now, Infinity)) add(s.task);
  return out;
}

/**
 * Each project's nap choices: its open, linked, unblocked Today tasks in Today's order, then up to
 * NAP_SUGGESTED_MAX of Suggested next's tasks for it (which already leaves Today's out).
 */
function napTasksByProject(data: StudiumData, now: Date): Map<string, NapTask[]> {
  const out = new Map<string, NapTask[]>();
  const add = (t: { id: string; projectId: string; title: string; estimateMin: number }, group: NapTask["group"]) => {
    const list = out.get(t.projectId) ?? [];
    if (group === "suggested" && list.filter((n) => n.group === "suggested").length >= NAP_SUGGESTED_MAX) return;
    list.push({ taskId: t.id, title: t.title, estimateMin: t.estimateMin, group });
    out.set(t.projectId, list);
  };
  const byId = new Map(data.tasks.map((t) => [t.id, t]));
  for (const id of todayTaskIds(data, now)) {
    const t = byId.get(id);
    if (t && !t.done && t.requirementId !== null && !isBlocked(t, data)) add(t, "today");
  }
  for (const s of suggestNext(data, now, Infinity)) add(s.task, "suggested");
  return out;
}

/** Each project's latest completion. Every completion celebrates; some celebrate bigger. */
function celebrationsByProject(data: StudiumData): Map<string, PetCelebration> {
  const taskProject = new Map(data.tasks.map((t) => [t.id, t.projectId]));
  const requirementProject = new Map(data.requirements.map((r) => [r.id, r.projectId]));
  const out = new Map<string, PetCelebration>();
  for (const e of data.events) {
    if (e.type !== "task_completed") continue;
    const projectId = taskProject.get(e.taskId) ?? (e.requirementId ? requirementProject.get(e.requirementId) : undefined);
    if (!projectId) continue;
    const first = !out.has(projectId);
    out.set(projectId, { at: e.at, kind: e.breakdown.finish > 0 ? "requirement" : first ? "firstTask" : "task" });
  }
  return out;
}

/** The habitat's bed (any pet) and the furniture made for this kind of pet, in slot order. */
function furnitureFor(project: Project, data: StudiumData): PetFurniture[] {
  const habitat = data.decor?.[project.id] ?? {};
  const out: PetFurniture[] = [];
  for (const slot of DECOR_SLOTS) {
    const item = habitat[slot] ? findDecor(habitat[slot] as string) : undefined;
    if (item?.use && (item.type === "bed" || item.forKind === project.petKind)) out.push({ use: item.use, slot });
  }
  return out;
}

export function buildPetStatuses(data: StudiumData, now: Date): PetStatuses {
  const multipliers = estimateMultipliers(data);
  const suggestions = suggestionsByProject(data, now);
  const napTasks = napTasksByProject(data, now);
  const celebrations = celebrationsByProject(data);
  return {
    updatedAt: now.toISOString(),
    pets: data.projects.filter((p) => petStage(p) !== "egg").map((p) => {
      const m = projectMood(p.id, data, now, multipliers);
      const idlest = m.neglected[0];
      return {
        projectId: p.id,
        shortName: p.shortName,
        name: p.name,
        color: p.color,
        deadline: p.deadline,
        petKind: p.petKind,
        mood: m.mood,
        recovering: m.health.recovering,
        idleRequirement: idlest ? { title: idlest.requirement.title, days: idlest.idleDays } : null,
        suggestion: suggestions.get(p.id) ?? null,
        napTasks: napTasks.get(p.id) ?? [],
        celebration: celebrations.get(p.id) ?? null,
        furniture: furnitureFor(p, data),
        stage: petStage(p) === "juvenile" ? "juvenile" : "adult",
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

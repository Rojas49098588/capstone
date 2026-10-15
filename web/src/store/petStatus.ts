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

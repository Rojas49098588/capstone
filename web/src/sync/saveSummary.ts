// What the two-saves picker shows about each save, and which one has more progress.
import { tokenBalance } from "../planner/history";
import { petsOf } from "../planner/pets";
import type { PetKind, PetStage, StudiumData } from "../planner/types";

export type SaveSummary = {
  savedAt: string | null;
  savedBy: string | null;
  projects: number;
  tokens: number;
  tasksDone: number;
  petsGrownUp: number;
  pets: { name: string; kind: PetKind; stage: PetStage }[]; // the first 3; `more` = the rest
};

const PETS_SHOWN = 3;

export function summarize(data: StudiumData, saved: { savedAt: string; savedBy: string } | null): SaveSummary & { more: number } {
  const pets = data.projects.flatMap(petsOf);
  return {
    savedAt: saved?.savedAt ?? null,
    savedBy: saved?.savedBy ?? null,
    projects: data.projects.length,
    tokens: tokenBalance(data),
    tasksDone: data.tasks.filter((t) => t.done).length,
    petsGrownUp: pets.filter((p) => p.stage === "adult").length,
    // A bought pet has no name until it hatches and is named.
    pets: pets.slice(0, PETS_SHOWN).map((p) => ({ name: p.name ?? "Unnamed", kind: p.kind, stage: p.stage })),
    more: Math.max(0, pets.length - PETS_SHOWN),
  };
}

/** True if `a` has strictly more progress: more tasks done, then more tokens, then more projects. */
export function hasMoreProgress(a: SaveSummary, b: SaveSummary): boolean {
  if (a.tasksDone !== b.tasksDone) return a.tasksDone > b.tasksDone;
  if (a.tokens !== b.tokens) return a.tokens > b.tokens;
  return a.projects > b.projects;
}

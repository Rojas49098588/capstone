// The pet lifecycle: a new project's pet is an egg until the project has a few requirements.
// Hatching is saved on the project, never recalculated, so it can't turn back into an egg.
import { HATCH_REQUIREMENTS } from "./tuning";
import type { PetStage, Project, StudiumData } from "./types";

export function petStage(project: Project): PetStage {
  return project.stage ?? "adult";
}

/** How many more requirements the egg needs to hatch; 0 once it has hatched. */
export function requirementsToHatch(project: Project, data: StudiumData): number {
  if (petStage(project) !== "egg") return 0;
  const count = data.requirements.filter((r) => r.projectId === project.id).length;
  return Math.max(0, HATCH_REQUIREMENTS - count);
}

/** Hatches the project's egg into a juvenile if it now has enough requirements. */
export function hatchIfReady(data: StudiumData, projectId: string, now: Date): { data: StudiumData; hatched: boolean } {
  const project = data.projects.find((p) => p.id === projectId);
  if (!project || petStage(project) !== "egg" || requirementsToHatch(project, data) > 0) return { data, hatched: false };
  const hatchedAt = now.toISOString();
  return {
    data: { ...data, projects: data.projects.map((p) => (p.id === projectId ? { ...p, stage: "juvenile", hatchedAt } : p)) },
    hatched: true,
  };
}

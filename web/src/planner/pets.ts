// A project's pets: the first pet is the project itself (its id is the project id, so all state
// saved before bought pets keeps working); pets bought in the Shop follow it, each in its own habitat.
// A habitat is keyed by its pet's id: the project id for the first pet, the pet id for the others.
import { petStage } from "./lifecycle";
import type { PetKind, PetStage, Project, StudiumData } from "./types";

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

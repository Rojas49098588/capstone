// A project's type and difficulty, with the defaults for projects saved before either existed.
import type { Difficulty, Project, ProjectType } from "./types";

export function projectType(project: Project): ProjectType {
  return project.type ?? "school";
}

export function projectDifficulty(project: Project): Difficulty {
  return project.difficulty ?? "steady";
}

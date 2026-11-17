// What the companion phone app shows, worked out with the planner's own code so it matches the desktop.
// Plain TypeScript (no React, no DOM): the phone imports it through its @shared alias.
import { isBlocked } from "../planner/blocking";
import { taskDueDate } from "../planner/dueDates";
import { canFeed, mealBoostUntil, snackLiftUntil } from "../planner/food";
import { projectMood, type ProjectMood } from "../planner/mood";
import { petMood, petsOf, suggestedPetName, type PetRef } from "../planner/pets";
import { todayTaskIds } from "../planner/suggest";
import { MEAL_HOURS, MEAL_PRODUCT_ID, MEAL_TOKEN_MULTIPLIER } from "../planner/tuning";
import type { Mood, PetKind, Project, StudiumData, Task } from "../planner/types";
import { isPending } from "../store/actions";
import { durationLabel, formatDate } from "../ui/format";

export type PetCard = {
  petId: string;
  projectId: string;
  name: string;
  kind: PetKind | "egg";
  looksAfter: string;
  mood: Mood | null;
  recovering: boolean;
  food: string | null;
};
export type PetGroup = { projectId: string; heading: string; color: string; pets: PetCard[] };
export type NeedsYou = { kind: "sick" | "upset" | "meal"; petId: string; text: string };
export type TodayRow = {
  taskId: string;
  title: string;
  projectName: string;
  color: string;
  estimateMin: number;
  due: string | null;
  done: boolean;
  pending: boolean;
  blocked: boolean;
};

const WHOLE_PROJECT = "Looks after the whole project";

const moodOf = (pet: PetRef, data: StudiumData, now: Date): ProjectMood | null =>
  pet.stage === "egg" ? null : (petMood(pet, data, now) ?? projectMood(pet.projectId, data, now));

const nameOf = (pet: PetRef, project: Project): string => (pet.stage === "egg" ? "Egg" : (pet.name ?? suggestedPetName(project, pet.kind)));

function looksAfter(pet: PetRef, project: Project, data: StudiumData): string {
  if (pet.stage === "egg") return `Hatches as you work on ${project.name}`;
  const req = pet.caresFor ? data.requirements.find((r) => r.id === pet.caresFor && r.projectId === project.id) : undefined;
  return req ? `Looks after "${req.title}" · due ${formatDate(req.dueDate ?? project.deadline)}` : WHOLE_PROJECT;
}

function foodLine(pet: PetRef, mood: ProjectMood | null, data: StudiumData, now: Date): string | null {
  if (pet.stage === "egg") return null;
  const boost = mealBoostUntil(data.events, pet.projectId, now);
  if (boost) return `Meal: × ${MEAL_TOKEN_MULTIPLIER} tokens for ${durationLabel(boost.getTime() - now.getTime())} more`;
  const meal = canFeed(data, pet, mood, MEAL_PRODUCT_ID, now);
  if (!meal.ok && meal.reason === "wait") return "Next meal tomorrow";
  const lift = mood?.liftedFrom ? snackLiftUntil(data.events, pet.petId, now) : null;
  if (lift) return `Snack: lifting mood for ${durationLabel(lift.getTime() - now.getTime())}`;
  return null;
}

export function petGroups(data: StudiumData, now: Date): PetGroup[] {
  return data.projects.map((project) => ({
    projectId: project.id,
    heading: `${project.name} · due ${formatDate(project.deadline)}`,
    color: project.color,
    pets: petsOf(project).map((pet): PetCard => {
      const mood = moodOf(pet, data, now);
      return {
        petId: pet.petId,
        projectId: project.id,
        name: nameOf(pet, project),
        kind: pet.stage === "egg" ? "egg" : pet.kind,
        looksAfter: looksAfter(pet, project, data),
        mood: mood?.mood ?? null,
        recovering: mood?.health.recovering ?? false,
        food: foodLine(pet, mood, data, now),
      };
    }),
  }));
}

/** What only the desktop can fix: sick pets first, then upset ones, then a meal per project that could have one. */
export function needsYou(data: StudiumData, now: Date): NeedsYou[] {
  const sick: NeedsYou[] = [];
  const upset: NeedsYou[] = [];
  const meals: NeedsYou[] = [];
  for (const project of data.projects) {
    let mealOffered = mealBoostUntil(data.events, project.id, now) !== null;
    for (const pet of petsOf(project)) {
      const mood = moodOf(pet, data, now);
      if (!mood) continue;
      const name = nameOf(pet, project);
      if (mood.mood === "Sick") sick.push({ kind: "sick", petId: pet.petId, text: `${name} is sick: give medicine.` });
      else if (mood.mood === "Upset") {
        const idle = mood.neglected[0];
        const why = idle ? `: it hasn't seen work on "${idle.requirement.title}" in ${idle.idleDays} days` : "";
        upset.push({ kind: "upset", petId: pet.petId, text: `${name} is upset${why}.` });
      }
      if (!mealOffered) {
        mealOffered = true; // one meal suggestion per project: its first hatched pet decides
        const check = canFeed(data, pet, mood, MEAL_PRODUCT_ID, now);
        if (check.ok || check.reason === "none-owned") {
          meals.push({ kind: "meal", petId: pet.petId, text: `${project.shortName} hasn't had a meal today: × ${MEAL_TOKEN_MULTIPLIER} tokens for ${MEAL_HOURS} hours.` });
        }
      }
    }
  }
  return [...sick, ...upset, ...meals];
}

function row(task: Task, data: StudiumData): TodayRow {
  const project = data.projects.find((p) => p.id === task.projectId);
  const due = task.dueDate ? taskDueDate(task, data) : null;
  return {
    taskId: task.id,
    title: task.title,
    projectName: project?.name ?? "",
    color: project?.color ?? "#8a8680",
    estimateMin: task.estimateMin,
    due: due ? formatDate(due) : null,
    done: task.done,
    pending: isPending(task),
    blocked: !task.done && isBlocked(task, data),
  };
}

export function todayRows(data: StudiumData, now: Date): TodayRow[] {
  return todayTaskIds(data, now)
    .map((id) => data.tasks.find((t) => t.id === id))
    .filter((t): t is Task => t !== undefined)
    .map((t) => row(t, data));
}

/** Tasks added on the phone still waiting for details, not done and not already on today's plan. */
export function pendingRows(data: StudiumData, now: Date): TodayRow[] {
  const today = new Set(todayTaskIds(data, now));
  return data.tasks.filter((t) => isPending(t) && !t.done && !today.has(t.id)).map((t) => row(t, data));
}

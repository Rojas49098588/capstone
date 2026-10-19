export type PetKind = "cat" | "dog" | "frog" | "pigeon" | "turtle";
export const PET_KINDS: readonly PetKind[] = ["cat", "dog", "frog", "pigeon", "turtle"];

export type Project = {
  id: string;
  name: string;
  shortName: string;
  color: string;
  deadline: string; // "YYYY-MM-DD", local
  description: string;
  petKind: PetKind;
  hatchedAt: string; // ISO time
  createdAt: string; // ISO time
};

export type Requirement = {
  id: string;
  projectId: string;
  title: string;
  weight: number; // whole number 1–10
  startDate: string | null; // "YYYY-MM-DD"; null = the day it was created
  dueDate: string | null; // "YYYY-MM-DD"; null = the project deadline
  createdAt: string;
};

export type Task = {
  id: string;
  projectId: string;
  requirementId: string | null; // null = unlinked, worth 0
  title: string;
  estimateMin: number;
  blockedBy: string[];
  priority: boolean;
  done: boolean;
  actualMin: number | null;
  createdAt: string;
};

export type TokenBreakdown = {
  base: number;
  unblockBonus: number;
  neglectBonus: number;
  finish: number;
  dailyCurve: number;
  sickMultiplier: number;
};

export const ZERO_BREAKDOWN: TokenBreakdown = {
  base: 0,
  unblockBonus: 0,
  neglectBonus: 0,
  finish: 0,
  dailyCurve: 1,
  sickMultiplier: 1,
};

export type StudiumEvent =
  | { type: "task_created"; at: string; taskId: string }
  | {
      type: "task_completed";
      at: string;
      taskId: string;
      requirementId?: string | null; // the task's requirement when completed (missing in old data)
      actualMin: number | null;
      tokens: number;
      breakdown: TokenBreakdown;
    }
  | { type: "task_reopened"; at: string; taskId: string }
  | { type: "task_edited"; at: string; taskId: string; changes: Partial<Task> }
  | { type: "requirement_created"; at: string; requirementId: string }
  | { type: "requirement_edited"; at: string; requirementId: string; changes: Partial<Requirement> }
  | { type: "purchase"; at: string; productId: string; price: number }
  | { type: "medicine_given"; at: string; projectId: string }
  | {
      type: "focus_session"; // a nap with a browser pet (pet interactions spec)
      at: string; // when the session ended
      id: string; // made by the extension when the nap started; recording is idempotent by id
      projectId: string;
      taskId: string | null; // the task the nap was for, if any
      startedAt: string;
      minutes: number; // whole minutes actually focused, >= 0
    };

export type CompletedEvent = Extract<StudiumEvent, { type: "task_completed" }>;
export type FocusSessionEvent = Extract<StudiumEvent, { type: "focus_session" }>;
/** A finished nap as the extension sends it. */
export type FocusSession = Omit<FocusSessionEvent, "type">;

/** Where decor goes in a habitat: the two surfaces, three floor spots and two wall spots. */
export type DecorSlot = "wallpaper" | "flooring" | "floorLeft" | "floorMiddle" | "floorRight" | "wallLeft" | "wallRight";
/** One habitat's decor: slot → decor item id. A missing slot is empty ("Plain" for the surfaces). */
export type HabitatDecor = Partial<Record<DecorSlot, string>>;

export type StudiumData = {
  version: 1;
  projects: Project[];
  requirements: Requirement[];
  tasks: Task[];
  events: StudiumEvent[]; // only ever appended to
  today: { date: string; taskIds: string[] };
  decor?: Record<string, HabitatDecor>; // by project id; missing in data saved before habitat decor
};

export type Mood = "Proud" | "Delighted" | "Happy" | "Worried" | "Upset" | "Sick";

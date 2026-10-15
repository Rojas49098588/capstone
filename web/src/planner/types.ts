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
      actualMin: number | null;
      tokens: number;
      breakdown: TokenBreakdown;
    }
  | { type: "task_reopened"; at: string; taskId: string }
  | { type: "task_edited"; at: string; taskId: string; changes: Partial<Task> }
  | { type: "requirement_created"; at: string; requirementId: string }
  | { type: "requirement_edited"; at: string; requirementId: string; changes: Partial<Requirement> }
  | { type: "purchase"; at: string; productId: string; price: number }
  | { type: "medicine_given"; at: string; projectId: string };

export type CompletedEvent = Extract<StudiumEvent, { type: "task_completed" }>;

export type StudiumData = {
  version: 1;
  projects: Project[];
  requirements: Requirement[];
  tasks: Task[];
  events: StudiumEvent[]; // only ever appended to
  today: { date: string; taskIds: string[] };
};

export type Mood = "Proud" | "Delighted" | "Happy" | "Worried" | "Upset" | "Sick";

// Builders for tests. NOW is a fixed local noon so plan percentages are exact.
import { DAY_MS, addDays, localDateKey } from "./time";
import {
  ZERO_BREAKDOWN,
  type Project,
  type Requirement,
  type StudiumData,
  type StudiumEvent,
  type Task,
  type TokenBreakdown,
} from "./types";

export const NOW = new Date(2026, 9, 14, 12, 0, 0);

export function daysAgo(n: number, from: Date = NOW): string {
  return new Date(from.getTime() - n * DAY_MS).toISOString();
}

export function dayKey(offsetDays: number, from: Date = NOW): string {
  return localDateKey(addDays(from, offsetDays));
}

export function makeProject(o: Partial<Project> = {}): Project {
  return {
    id: "p1",
    name: "Project",
    shortName: "proj",
    color: "#2d3a8c",
    deadline: dayKey(30),
    description: "",
    petKind: "cat",
    hatchedAt: daysAgo(30),
    createdAt: daysAgo(30),
    ...o,
  };
}

export function makeRequirement(o: Partial<Requirement> = {}): Requirement {
  return {
    id: "r1",
    projectId: "p1",
    title: "Requirement",
    weight: 5,
    startDate: null,
    dueDate: null,
    createdAt: daysAgo(10),
    ...o,
  };
}

export function makeTask(o: Partial<Task> = {}): Task {
  return {
    id: "t1",
    projectId: "p1",
    requirementId: "r1",
    title: "Task",
    estimateMin: 60,
    blockedBy: [],
    priority: false,
    done: false,
    actualMin: null,
    createdAt: daysAgo(10),
    ...o,
  };
}

export function completed(
  taskId: string,
  at: string,
  o: { actualMin?: number | null; tokens?: number; breakdown?: TokenBreakdown } = {},
): StudiumEvent {
  return {
    type: "task_completed",
    at,
    taskId,
    actualMin: o.actualMin ?? null,
    tokens: o.tokens ?? 0,
    breakdown: o.breakdown ?? { ...ZERO_BREAKDOWN },
  };
}

export function makeData(o: Partial<StudiumData> = {}): StudiumData {
  return {
    version: 1,
    projects: [makeProject()],
    requirements: [],
    tasks: [],
    events: [],
    today: { date: localDateKey(NOW), taskIds: [] },
    ...o,
  };
}

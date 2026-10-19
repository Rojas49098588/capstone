// Example data, built relative to "now" so it looks the same whenever it is first opened.
// Day offsets: negative = in the past. Task numbers in blockedBy are within the same project.
import { DAY_MS, addDays, localDateKey } from "../planner/time";
import {
  ZERO_BREAKDOWN,
  type PetKind,
  type Project,
  type Requirement,
  type StudiumData,
  type StudiumEvent,
  type Task,
} from "../planner/types";
import { giveDefaultBeds } from "./decor";

type SeedTask = {
  title: string;
  est: number;
  done?: { daysAgo: number; actual: number };
  priority?: boolean;
  blockedBy?: number[];
};
type SeedRequirement = { title: string; weight: number; start: number; due: number | null; tasks: SeedTask[] };
type SeedProject = {
  id: string;
  name: string;
  color: string;
  petKind: PetKind;
  deadline: number;
  createdDaysAgo: number;
  description: string;
  requirements: SeedRequirement[];
};

const SEED: SeedProject[] = [
  {
    id: "webDev",
    name: "Web Development Portfolio",
    color: "#2d3a8c",
    petKind: "pigeon",
    deadline: 48,
    createdDaysAgo: 30,
    description: "Build a personal portfolio site with case studies, live demos, and a blog.",
    requirements: [
      {
        title: "Site structure & design",
        weight: 3,
        start: -30,
        due: -5,
        tasks: [
          { title: "Design landing page layout", est: 120, done: { daysAgo: 12, actual: 120 } },
          { title: "Implement responsive nav", est: 180, done: { daysAgo: 8, actual: 180 } },
        ],
      },
      {
        title: "Case studies",
        weight: 5,
        start: -20,
        due: 20,
        tasks: [
          { title: "Write case study #1", est: 180, done: { daysAgo: 5, actual: 180 } },
          { title: "Write case study #2", est: 180, done: { daysAgo: 2, actual: 180 } },
          { title: "Write case study #3", est: 180, priority: true },
          { title: "Record demo videos", est: 120 },
        ],
      },
      {
        title: "Contact form & deploy",
        weight: 2,
        start: 10,
        due: null,
        tasks: [
          { title: "Contact form with validation", est: 120 },
          { title: "Deploy to Vercel", est: 60, blockedBy: [7] },
        ],
      },
    ],
  },
  {
    id: "appDev",
    name: "Mobile App — Habit Tracker",
    color: "#c9501a",
    petKind: "dog",
    deadline: 124,
    createdDaysAgo: 40,
    description: "React Native app for tracking daily habits with streaks, reminders, and analytics.",
    requirements: [
      {
        title: "Core habit screens",
        weight: 4,
        start: -40,
        due: -10,
        tasks: [
          { title: "Set up Expo project", est: 60, done: { daysAgo: 30, actual: 90 } },
          { title: "Design onboarding flow", est: 120, done: { daysAgo: 25, actual: 180 } },
          { title: "Build habit CRUD screens", est: 240, done: { daysAgo: 4, actual: 360 } },
        ],
      },
      {
        title: "Streaks & reminders",
        weight: 4,
        start: -20,
        due: 5,
        tasks: [
          { title: "Implement streak logic", est: 180, priority: true },
          { title: "Streak unit tests", est: 120, blockedBy: [4] },
          { title: "Push notification integration", est: 240 },
          { title: "Notification permission UX", est: 60, done: { daysAgo: 3, actual: 90 } },
        ],
      },
      {
        title: "Analytics",
        weight: 2,
        start: 1,
        due: 60,
        tasks: [{ title: "Analytics dashboard", est: 240, blockedBy: [4] }],
      },
    ],
  },
  {
    id: "Animation",
    name: "3D Animation Reel",
    color: "#3a7c4f",
    petKind: "frog",
    deadline: 18,
    createdDaysAgo: 35,
    description: "Produce a 90-second showreel showcasing motion graphics and 3D character animation.",
    requirements: [
      {
        title: "Story & modeling",
        weight: 3,
        start: -35,
        due: -15,
        tasks: [
          { title: "Storyboard all 6 scenes", est: 240, done: { daysAgo: 25, actual: 240 } },
          { title: "Model hero character", est: 300, done: { daysAgo: 18, actual: 300 } },
        ],
      },
      {
        title: "Rigging",
        weight: 4,
        start: -14,
        due: 3,
        tasks: [
          { title: "Rig hero character", est: 240, done: { daysAgo: 9, actual: 240 } },
          { title: "Weight paint character", est: 180, priority: true },
        ],
      },
      {
        title: "Animation & render",
        weight: 5,
        start: 4,
        due: 17,
        tasks: [
          { title: "Animate scenes 1 & 2", est: 480, blockedBy: [4] },
          { title: "Render final frames", est: 240, blockedBy: [5] },
          { title: "Sound design & export", est: 180, blockedBy: [6] },
        ],
      },
    ],
  },
  {
    id: "seniorCap",
    name: "Senior Capstone Project",
    color: "#7b4fa6",
    petKind: "cat",
    deadline: 208,
    createdDaysAgo: 60,
    description: "Full-stack AI-assisted tutoring platform — research, development, and thesis paper.",
    requirements: [
      {
        title: "Research",
        weight: 3,
        start: -60,
        due: -30,
        tasks: [
          { title: "Literature review (20 papers)", est: 600, done: { daysAgo: 40, actual: 600 } },
          { title: "Define research questions", est: 120, done: { daysAgo: 32, actual: 120 } },
        ],
      },
      {
        title: "Prototype v1",
        weight: 5,
        start: -30,
        due: 30,
        tasks: [
          { title: "System architecture design", est: 240, done: { daysAgo: 16, actual: 240 } },
          { title: "Build prototype v1", est: 900, priority: true, blockedBy: [3] },
          { title: "Prototype database schema", est: 180 },
        ],
      },
      {
        title: "User study",
        weight: 4,
        start: 20,
        due: 90,
        tasks: [
          { title: "Recruit participants (n=20)", est: 120, blockedBy: [4] },
          { title: "Run user study", est: 600, blockedBy: [6] },
        ],
      },
      {
        title: "Thesis & defense",
        weight: 4,
        start: 60,
        due: null,
        tasks: [
          { title: "Write thesis draft", est: 1200 },
          { title: "Defense presentation", est: 300, blockedBy: [8] },
        ],
      },
    ],
  },
  {
    id: "petExt",
    name: "Virtual Pet Extension",
    color: "#1a6e7e",
    petKind: "turtle",
    deadline: 62,
    createdDaysAgo: 14,
    description: "Chrome extension with project pets that follow you across the web and link to Studium.",
    requirements: [
      {
        title: "Pet basics",
        weight: 4,
        start: -14,
        due: -3,
        tasks: [
          { title: "Pet walks, drags, and throws", est: 240, done: { daysAgo: 10, actual: 240 } },
          { title: "One pet per project", est: 120, done: { daysAgo: 6, actual: 120 } },
          { title: "Pet types and art", est: 240, done: { daysAgo: 1, actual: 240 } },
        ],
      },
      {
        title: "Studium link",
        weight: 5,
        start: -2,
        due: 25,
        tasks: [
          { title: "Save Studium data between visits", est: 480, priority: true },
          { title: "Share pet mood with Studium", est: 300, blockedBy: [4] },
        ],
      },
      {
        title: "Sprites & polish",
        weight: 2,
        start: 25,
        due: null,
        tasks: [{ title: "Replace placeholder art with sprites", est: 600 }],
      },
    ],
  },
];

const TODAY_TASK_IDS = ["webDev-t5", "Animation-t4"];

export function buildSeed(now: Date): StudiumData {
  const at = (daysAgo: number) => new Date(now.getTime() - daysAgo * DAY_MS).toISOString();
  const day = (offset: number) => localDateKey(addDays(now, offset));

  const projects: Project[] = [];
  const requirements: Requirement[] = [];
  const tasks: Task[] = [];
  const events: StudiumEvent[] = [];

  for (const sp of SEED) {
    const createdAt = at(sp.createdDaysAgo);
    projects.push({
      id: sp.id,
      name: sp.name,
      shortName: sp.id,
      color: sp.color,
      deadline: day(sp.deadline),
      description: sp.description,
      petKind: sp.petKind,
      hatchedAt: createdAt,
      createdAt,
    });

    let taskNumber = 0;
    sp.requirements.forEach((sr, i) => {
      const requirementId = `${sp.id}-r${i + 1}`;
      requirements.push({
        id: requirementId,
        projectId: sp.id,
        title: sr.title,
        weight: sr.weight,
        startDate: day(sr.start),
        dueDate: sr.due === null ? null : day(sr.due),
        createdAt,
      });
      for (const st of sr.tasks) {
        taskNumber += 1;
        const id = `${sp.id}-t${taskNumber}`;
        tasks.push({
          id,
          projectId: sp.id,
          requirementId,
          title: st.title,
          estimateMin: st.est,
          blockedBy: (st.blockedBy ?? []).map((n) => `${sp.id}-t${n}`),
          priority: st.priority ?? false,
          done: st.done !== undefined,
          actualMin: st.done?.actual ?? null,
          createdAt,
        });
        if (st.done) {
          // Seed completions pay nothing, so the starting balance stays 650.
          events.push({
            type: "task_completed",
            at: at(st.done.daysAgo),
            taskId: id,
            requirementId,
            actualMin: st.done.actual,
            tokens: 0,
            breakdown: { ...ZERO_BREAKDOWN },
          });
        }
      }
    });
  }

  events.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  return giveDefaultBeds({ version: 1, projects, requirements, tasks, events, today: { date: localDateKey(now), taskIds: TODAY_TASK_IDS } });
}

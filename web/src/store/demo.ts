// The demo copy's save (docs/superpowers/specs/2026-11-18-demo-stand-design.md): the owner's five classes
// with made-up work, built from "now" so Today, Soon and moods are right whenever Reset is pressed.
// Day offsets: negative = in the past. Requirement numbers in blockedBy are within the same project.
// Ids are stable (<project>-r<n>, <project>-t<n>), so pets and toys on the desktop keep their place after a Reset.
import { DAY_MS, addDays, localDateKey } from "../planner/time";
import { eggProductId } from "../planner/pets";
import { EGG_PRICE } from "../planner/tuning";
import {
  ZERO_BREAKDOWN,
  type ExtraPet,
  type HabitatDecor,
  type PetKind,
  type PetStage,
  type Project,
  type Requirement,
  type StudiumData,
  type StudiumEvent,
  type Task,
} from "../planner/types";
import { giveDefaultBeds } from "./decor";
import { priceOf } from "./products";
import { DEFAULT_SETTINGS, type Settings } from "./settings";

/** What the pets call you in the demo copy. A placeholder: change it here. */
export const DEMO_NICKNAME = "Mustang";

export const DEMO_SETTINGS: Settings = {
  ...DEFAULT_SETTINGS,
  setupDone: true,
  tutorialDone: true,
  shopTutorialDone: true,
  petInvolvement: "moderate",
  petCount: "all",
  nickname: DEMO_NICKNAME,
  startWithComputer: false,
  petSounds: true,
};

/** The balance the demo starts with: enough for a few foods and a decor item. */
const DEMO_TOKENS = 1500;
/** What each finished task paid (shown in the history). */
const TOKENS_PER_TASK = 25;

type DemoTask = {
  title: string;
  est: number;
  done?: { daysAgo: number; actual: number };
  priority?: true;
  order?: number; // set on every unfinished task of a list that has been reordered
  today?: true;
};
type DemoRequirement = {
  title: string;
  sublabel?: string;
  weight: number;
  start: number;
  due: number;
  blockedBy?: number[];
  tasks: DemoTask[];
};
type DemoProject = {
  id: string;
  name: string;
  shortName: string;
  color: string;
  petKind: PetKind;
  stage: PetStage;
  hatchedDaysAgo: number;
  createdDaysAgo: number;
  deadline: number;
  description: string;
  requirements: DemoRequirement[];
};

const done = (daysAgo: number, actual: number) => ({ daysAgo, actual });

const DEMO: DemoProject[] = [
  {
    id: "capstone",
    name: "Capstone: Studium",
    shortName: "Capstone",
    color: "#2d3a8c",
    petKind: "cat",
    stage: "adult",
    hatchedDaysAgo: 75,
    createdDaysAgo: 76,
    deadline: 6,
    description: "A planner where every class gets a pet that thrives when you keep up.",
    requirements: [
      {
        title: "Planner and pets",
        weight: 3,
        start: -76,
        due: -40,
        tasks: [
          { title: "Projects, requirements and tasks", est: 240, done: done(60, 260) },
          { title: "Pet moods from progress", est: 180, done: done(50, 200) },
          { title: "Desktop pets", est: 300, done: done(42, 330) },
        ],
      },
      {
        title: "Accounts and sync",
        weight: 3,
        start: -40,
        due: -20,
        tasks: [
          { title: "Sign in with email and Google", est: 180, done: done(30, 170) },
          { title: "Sync between devices", est: 240, done: done(24, 280) },
        ],
      },
      {
        title: "Shop and toys",
        weight: 3,
        start: -20,
        due: -3,
        tasks: [
          { title: "Foods with flavors", est: 150, done: done(14, 140) },
          { title: "Focus Ball and Robo Mouse", est: 180, done: done(12, 190) },
          { title: "Window decor", est: 90, done: done(10, 80) },
        ],
      },
      {
        title: "Final release",
        sublabel: "Windows, Mac, Linux",
        weight: 1,
        start: -6,
        due: 3,
        tasks: [
          { title: "Fix tester feedback", est: 120, done: done(2, 110) },
          { title: "Publish the final installer", est: 45, done: done(1, 40) },
          { title: "Scan the QR code to check it", est: 10 },
        ],
      },
      {
        title: "Demo day",
        weight: 1,
        start: -3,
        due: 4,
        tasks: [
          { title: "Write the cheat sheet", est: 45, done: done(1, 50) },
          { title: "Rehearse the stand", est: 60, priority: true, today: true },
          { title: "Print the QR code", est: 10 },
        ],
      },
    ],
  },
  {
    id: "appDev",
    name: "App Dev: Mustang Closet",
    shortName: "App Dev",
    color: "#b5452e",
    petKind: "dog",
    stage: "adult",
    hatchedDaysAgo: 60,
    createdDaysAgo: 61,
    deadline: 16,
    description: "An app for the marching band to check uniforms in and out.",
    requirements: [
      {
        title: "Uniform inventory",
        weight: 3,
        start: -60,
        due: -25,
        tasks: [
          { title: "Inventory data model", est: 120, done: done(45, 110) },
          { title: "Inventory list screen", est: 180, done: done(38, 200) },
          { title: "Search by size", est: 90, done: done(30, 80) },
        ],
      },
      {
        title: "Check-out flow",
        sublabel: "Section leaders",
        weight: 4,
        start: -25,
        due: 6,
        tasks: [
          { title: "Scan a uniform's tag", est: 150, done: done(9, 160) },
          { title: "Check out to a member", est: 120, done: done(5, 120) },
          { title: "Check-in and condition notes", est: 120, done: done(2, 130) },
          { title: "Overdue reminders", est: 90, order: 0, today: true },
          { title: "Return receipt email", est: 60, order: 1 },
        ],
      },
      {
        title: "Testing with the band",
        weight: 2,
        start: 2,
        due: 16,
        tasks: [
          { title: "Test with five section leaders", est: 120 },
          { title: "Fix what they find", est: 180 },
        ],
      },
    ],
  },
  {
    id: "webDev",
    name: "Web Dev: Childcare website",
    shortName: "Web Dev",
    color: "#3f7d4e",
    petKind: "pigeon",
    stage: "adult",
    hatchedDaysAgo: 45,
    createdDaysAgo: 46,
    deadline: 20,
    description: "A full website for a childcare center: front end, back end, the layer between, and deployment.",
    requirements: [
      {
        title: "Front end",
        sublabel: "Accessibility",
        weight: 3,
        start: -14,
        due: 2,
        tasks: [
          { title: "Home and programs pages", est: 180, done: done(6, 200) },
          { title: "Enrollment form", est: 150, today: true },
          { title: "Keyboard and screen reader check", est: 90 },
          { title: "Mobile layout", est: 120, priority: true },
          { title: "Parent photo gallery", est: 90 },
        ],
      },
      {
        title: "Back end",
        weight: 3,
        start: -10,
        due: 9,
        tasks: [
          { title: "Database for families and classes", est: 150, done: done(4, 170) },
          { title: "Enrollment records", est: 120 },
          { title: "Staff log-in", est: 120 },
        ],
      },
      {
        title: "Middle layer",
        sublabel: "API",
        weight: 2,
        start: -3,
        due: 12,
        tasks: [
          { title: "Enrollment API", est: 120 },
          { title: "Form validation", est: 60 },
        ],
      },
      {
        title: "Deployment",
        weight: 1,
        start: 10,
        due: 18,
        blockedBy: [1, 2, 3],
        tasks: [
          { title: "Pick hosting", est: 30 },
          { title: "Deploy and test live", est: 90 },
        ],
      },
    ],
  },
  {
    id: "anim3d",
    name: "3D Animation: Blender short",
    shortName: "3D Anim",
    color: "#7a4fa3",
    petKind: "turtle",
    stage: "juvenile",
    hatchedDaysAgo: 5,
    createdDaysAgo: 30,
    deadline: 14,
    description: "A short animated film made in Blender.",
    requirements: [
      {
        title: "Storyboard",
        weight: 1,
        start: -30,
        due: -20,
        tasks: [
          { title: "Script the story", est: 60, done: done(26, 60) },
          { title: "Draw the storyboard", est: 120, done: done(22, 150) },
        ],
      },
      {
        title: "Modelling",
        weight: 3,
        start: -18,
        due: 1,
        tasks: [
          { title: "Model the main character", est: 240, done: done(15, 300) },
          { title: "Model the set", est: 180 },
          { title: "Props", est: 90 },
        ],
      },
      {
        title: "Rigging",
        weight: 2,
        start: -4,
        due: 6,
        tasks: [
          { title: "Rig the character", est: 180 },
          { title: "Test the rig's poses", est: 60 },
        ],
      },
      {
        title: "Animation and render",
        weight: 3,
        start: 4,
        due: 14,
        tasks: [
          { title: "Block out the shots", est: 180 },
          { title: "Polish the animation", est: 240 },
          { title: "Render and edit", est: 120 },
        ],
      },
    ],
  },
  {
    id: "uiux",
    name: "UI/UX: YouTube redesign",
    shortName: "UI/UX",
    color: "#c48a1c",
    petKind: "frog",
    stage: "adult",
    hatchedDaysAgo: 40,
    createdDaysAgo: 41,
    deadline: 12,
    description: "Evaluating YouTube's interface and redesigning what doesn't work.",
    requirements: [
      {
        title: "Heuristic evaluation",
        sublabel: "Nielsen's 10",
        weight: 2,
        start: -40,
        due: -20,
        tasks: [
          { title: "Walk through the home page", est: 60, done: done(32, 70) },
          { title: "Walk through watching a video", est: 60, done: done(29, 60) },
          { title: "Write up the problems", est: 90, done: done(24, 100) },
        ],
      },
      {
        title: "User interviews",
        weight: 2,
        start: -20,
        due: 1,
        tasks: [
          { title: "Write the interview guide", est: 45, done: done(16, 45) },
          { title: "Interview five students", est: 150, done: done(3, 160) },
          { title: "Sum up the findings", est: 60, today: true },
        ],
      },
      {
        title: "Wireframes",
        weight: 2,
        start: -2,
        due: 7,
        tasks: [
          { title: "Sketch the new home page", est: 90 },
          { title: "Sketch the new watch page", est: 90 },
        ],
      },
      {
        title: "Prototype",
        weight: 3,
        start: 5,
        due: 12,
        tasks: [
          { title: "Clickable prototype in Figma", est: 240 },
          { title: "Test it with two users", est: 90 },
        ],
      },
    ],
  },
];

/** The Capstone cat's habitat, fully decorated; the other habitats keep just their built-in bed. */
const CAPSTONE_DECOR: HabitatDecor = {
  wallpaper: "sage-stripes",
  flooring: "oak-planks",
  floorMiddle: "round-rug",
  floorRight: "scratching-post",
  wallLeft: "window",
  wallRight: "study-poster",
};
/** A second pet, bought in the Shop, in the Capstone project. */
const EXTRA_PET_ID = "capstone-pet2";
const TOYS = ["focus-ball", "robo-mouse"];

export const DEMO_PROJECT_IDS: readonly string[] = DEMO.map((p) => p.id);

export function buildDemo(now: Date): StudiumData {
  const at = (daysAgo: number) => new Date(now.getTime() - daysAgo * DAY_MS).toISOString();
  const day = (offset: number) => localDateKey(addDays(now, offset));

  const projects: Project[] = [];
  const requirements: Requirement[] = [];
  const tasks: Task[] = [];
  const events: StudiumEvent[] = [];
  const today: string[] = [];
  let earned = 0;

  for (const dp of DEMO) {
    const createdAt = at(dp.createdDaysAgo);
    projects.push({
      id: dp.id,
      name: dp.name,
      shortName: dp.shortName,
      color: dp.color,
      deadline: day(dp.deadline),
      description: dp.description,
      petKind: dp.petKind,
      stage: dp.stage,
      hatchedAt: at(dp.hatchedDaysAgo),
      type: "school",
      difficulty: "steady",
      createdAt,
    });

    let taskNumber = 0;
    dp.requirements.forEach((dr, i) => {
      const requirementId = `${dp.id}-r${i + 1}`;
      requirements.push({
        id: requirementId,
        projectId: dp.id,
        title: dr.title,
        weight: dr.weight,
        startDate: day(dr.start),
        dueDate: day(dr.due),
        createdAt,
        ...(dr.blockedBy ? { blockedBy: dr.blockedBy.map((n) => `${dp.id}-r${n}`) } : {}),
        ...(dr.sublabel ? { sublabel: dr.sublabel } : {}),
      });
      for (const dt of dr.tasks) {
        taskNumber += 1;
        const id = `${dp.id}-t${taskNumber}`;
        tasks.push({
          id,
          projectId: dp.id,
          requirementId,
          title: dt.title,
          estimateMin: dt.est,
          blockedBy: [],
          priority: dt.priority ?? false,
          done: dt.done !== undefined,
          actualMin: dt.done?.actual ?? null,
          createdAt,
          ...(dt.order !== undefined ? { order: dt.order } : {}),
        });
        if (dt.today) today.push(id);
        if (dt.done) {
          earned += TOKENS_PER_TASK;
          events.push({
            type: "task_completed",
            at: at(dt.done.daysAgo),
            taskId: id,
            requirementId,
            actualMin: dt.done.actual,
            tokens: TOKENS_PER_TASK,
            breakdown: { ...ZERO_BREAKDOWN, base: TOKENS_PER_TASK },
          });
        }
      }
    });
  }

  // The second Capstone pet: bought 20 days ago, hatched and grown up since.
  const extra: ExtraPet = { id: EXTRA_PET_ID, kind: "dog", stage: "adult", boughtAt: at(20), hatchedAt: at(18), name: "Byte", caresFor: null };
  projects[0] = { ...projects[0], pets: [extra] };

  // Purchases, a few days back: the toys, the Capstone habitat's decor, and the egg.
  let spent = 0;
  const buy = (productId: string, price: number, daysAgo: number) => {
    spent += price;
    events.push({ type: "purchase", at: at(daysAgo), productId, price });
  };
  buy(eggProductId("dog"), EGG_PRICE, 20);
  for (const id of [...TOYS, ...Object.values(CAPSTONE_DECOR)]) buy(id, priceOf(id) ?? 0, 8);

  events.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  return giveDefaultBeds({
    version: 1,
    projects,
    requirements,
    tasks,
    events,
    today: { date: localDateKey(now), taskIds: today },
    decor: { capstone: CAPSTONE_DECOR },
    startingTokens: DEMO_TOKENS - earned + spent,
  });
}

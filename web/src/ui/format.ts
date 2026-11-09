// All wording shown in the UI, in one place so it stays consistent and testable.
import type { NeglectedRequirement } from "../planner/mood";
import { findPet, suggestedPetName, type EggRefusal, type PetNews } from "../planner/pets";
import { DAY_MS, isDateKey, localDateKey, startOfLocalDay } from "../planner/time";
import { HATCH_REQUIREMENTS, LEARNING_MIN_SAMPLES_SHOWN, MAX_PETS_PER_PROJECT } from "../planner/tuning";
import { projectType } from "../planner/projectKind";
import type { Difficulty, Mood, Project, ProjectType, Requirement, StudiumData, Task } from "../planner/types";
import type { Blocker } from "../planner/blocking";
import type { PetInvolvement } from "../store/settings";
import type { Payout } from "../planner/value";

export const ESTIMATE_CHOICES: readonly number[] = [15, 30, 60, 120, 240, 480];

export const MOOD_COLORS: Record<Mood, string> = {
  Proud: "#3a7c4f",
  Delighted: "#3a7c4f",
  Happy: "#1a6e7e",
  Worried: "#c9501a",
  Upset: "#b4443c",
  Sick: "#7a8a2a",
};

export function formatMinutes(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} h ${rest} min` : `${h} h`;
}

/** A countdown, rounded up to the minute: "1h 20m", "45m" (food spec). */
export function durationLabel(ms: number): string {
  const minutes = Math.ceil(ms / 60_000);
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
}

export function focusedLabel(minutes: number): string {
  return `Focused ${formatMinutes(minutes)}`;
}

export function weekFocusLabel(minutes: number): string {
  return `Focused this week: ${formatMinutes(minutes)}`;
}

export type PetAway = { kind: "nap" | "sleep"; until: Date };

/** The extension's data-pet-away attribute: "<nap|sleep>:<ISO time it returns>". */
export function parsePetAway(value: string | null): PetAway | null {
  if (!value) return null;
  const colon = value.indexOf(":");
  const kind = value.slice(0, colon);
  const until = new Date(value.slice(colon + 1));
  if ((kind !== "nap" && kind !== "sleep") || !Number.isFinite(until.getTime())) return null;
  return { kind, until };
}

export function awayLabel(away: PetAway, now: Date): { title: string; detail: string } {
  if (away.kind === "nap") {
    const minutes = Math.max(1, Math.ceil((away.until.getTime() - now.getTime()) / 60_000));
    return { title: "is napping", detail: `back in ${minutes} min` };
  }
  // Newer ICU puts a narrow no-break space before AM/PM; keep plain spaces.
  const time = away.until.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).replace(/\s/g, " ");
  return { title: "is sleeping", detail: `back at ${time}` };
}

/** Where the copies of a decor item are: "1 here · 1 in appDev · 1 free". */
export function copiesLabel(here: number, elsewhere: { shortName: string; count: number }[], free: number): string {
  const parts = [
    ...(here > 0 ? [`${here} here`] : []),
    ...elsewhere.filter((e) => e.count > 0).map((e) => `${e.count} in ${e.shortName}`),
    ...(free > 0 ? [`${free} free`] : []),
  ];
  return parts.length > 0 ? parts.join(" · ") : "none";
}

export function formatDate(key: string): string {
  if (!isDateKey(key)) return "No date";
  return startOfLocalDay(key).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** Calendar days from today to the date: 0 = today, negative = past. */
export function daysUntil(key: string, now: Date): number {
  if (!isDateKey(key)) return 0;
  return Math.round((startOfLocalDay(key).getTime() - startOfLocalDay(localDateKey(now)).getTime()) / DAY_MS);
}

export function deadlineLabel(key: string, now: Date): string {
  const d = daysUntil(key, now);
  if (d > 1) return `${d} days left`;
  if (d === 1) return "1 day left";
  if (d === 0) return "Due today";
  return "Overdue";
}

export function percent(fraction: number): number {
  return Math.round(fraction * 100);
}

// ---- Pet lifecycle ----

/** Shown where the mood goes while the pet is still an egg. */
export const EGG_LABEL = "Egg";

export function hatchHint(remaining: number, words: ProjectWords = SCHOOL_WORDS): string {
  return `Add ${remaining} more ${remaining === 1 ? words.requirement : words.requirements} to hatch`;
}

// ---- Bought pets ----

/** How a bought egg hatches (any one requirement half done since the purchase). */
export function boughtEggHint(words: ProjectWords = SCHOOL_WORDS): string {
  return `Hatches when you finish half of any ${words.requirement}'s ${words.tasks}`;
}

export const EGG_REFUSAL_LABELS: Record<EggRefusal, string> = {
  firstEgg: "its own egg hasn't hatched",
  eggWaiting: "an egg is already waiting",
  full: `${MAX_PETS_PER_PROJECT} pets`,
};

export function eggBoughtMessage(shortName: string, words: ProjectWords = SCHOOL_WORDS): string {
  return `The egg is in ${shortName}'s habitats. It hatches when you finish half of any ${words.requirement}'s ${words.tasks}.`;
}

export const NO_PROJECTS_FOR_EGGS = "Start a project first; eggs go to a project.";

/** A habitat header's small label: what its pet cares about. */
export const CARES_SHARED_LABEL = "Project Companion";
export function caresForLabel(title: string): string {
  return `Looks after · ${title}`;
}
export const SHARES_MOOD_OPTION = "Shares the project's mood";
export function looksAfterOption(title: string): string {
  return `Looks after ${title}`;
}

/** How close a bought egg is: the requirement nearest to halfway. */
export function eggProgressLabel(done: number, needed: number, words: ProjectWords = SCHOOL_WORDS): string {
  return `${done} of ${needed} ${words.tasks} toward hatching`;
}

export const PET_SETUP_TEXT = "Your new companion hatched! Give it a name and choose what it cares about.";
export const ANOTHER_PET_PROMPT = "Want another companion?";
export const ANOTHER_PET_LINK = "Buy an egg in the Shop";

/** The edit dialog's companion line while the pet is an egg: it doesn't give the animal away. */
export function eggCompanionLabel(words: ProjectWords = SCHOOL_WORDS): string {
  return `Companion: an egg (it hatches once the project has ${HATCH_REQUIREMENTS} ${words.requirements}).`;
}

// ---- Project types ----

/** What one project calls its requirements and tasks (lower case). Screens that mix projects keep the school words. */
export type ProjectWords = { requirement: string; requirements: string; task: string; tasks: string };

const words = (requirement: string, task: string): ProjectWords => ({ requirement, requirements: `${requirement}s`, task, tasks: `${task}s` });
const SCHOOL_WORDS = words("requirement", "task");
const PROJECT_WORDS: Record<ProjectType, ProjectWords> = {
  school: SCHOOL_WORDS,
  writing: words("chapter", "scene"),
  art: words("piece", "step"),
  code: words("feature", "task"),
  music: words("track", "task"),
  other: words("milestone", "task"),
};

export function projectWords(type: ProjectType): ProjectWords {
  return PROJECT_WORDS[type];
}

/** The words for a project (missing type = school). */
export function wordsFor(project: Project | undefined): ProjectWords {
  return project ? PROJECT_WORDS[projectType(project)] : SCHOOL_WORDS;
}

/** The habitat's line before there's enough data for estimate accuracy. */
export function accuracyPending(words: ProjectWords = SCHOOL_WORDS): string {
  return `Finish a few ${words.tasks} with a time to see how your estimates compare.`;
}

/** The habitat's note while a pet recovers from medicine. */
export function recoveringNote(words: ProjectWords = SCHOOL_WORDS): string {
  return `Recovering: mood stays at Worried or below until the neglected ${words.requirements} move again.`;
}

export function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** What a toast says when completing a task hatched a bought egg or made a pet grow up. */
export function petNewsMessage(news: PetNews, data: StudiumData): string {
  const project = data.projects.find((p) => p.id === news.projectId);
  const pet = findPet(data, news.habitatId);
  if (news.kind === "hatched") return `${project?.shortName ?? "Your project"}'s new egg hatched! Name it in its habitat.`;
  const name = pet?.name ?? (pet && project ? suggestedPetName(project, pet.kind) : "Your pet");
  return `${name} grew up!`;
}

export function hatchingMessage(shortName: string): string {
  return `${shortName} is hatching!`;
}

export function gapLabel(gap: number): string {
  const n = Math.round(Math.abs(gap));
  if (n === 0) return "On plan";
  return `${n} ${n === 1 ? "point" : "points"} ${gap > 0 ? "ahead of" : "behind"} plan`;
}

export function attentionLabel(neglected: NeglectedRequirement[], words: ProjectWords = SCHOOL_WORDS): string {
  if (neglected.length === 0) return `All ${words.requirements} active`;
  const top = neglected[0];
  return `${top.requirement.title}: ${top.idleDays} days idle`;
}

export function accuracyLabel(shortName: string, multiplier: number, samples: number, words: ProjectWords = SCHOOL_WORDS): string | null {
  if (samples < LEARNING_MIN_SAMPLES_SHOWN) return null;
  return `Your ${shortName} ${words.tasks} take about ${multiplier.toFixed(1)}× your estimates`;
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

export function payoutMessage(payout: Payout, task: Task): string {
  if (payout.tokens === 0) {
    return task.requirementId
      ? "Done. No new tokens: this task was already paid."
      : "Done. Unlinked tasks earn no tokens; link it to a requirement next time.";
  }
  const b = payout.breakdown;
  const parts: string[] = [];
  if (b.unblockBonus > 0) parts.push(`unblocks work +${pct(b.unblockBonus)}`);
  if (b.neglectBonus > 0) parts.push(`revived a neglected requirement +${pct(b.neglectBonus)}`);
  if (b.finish > 0) parts.push("finished a requirement");
  if (b.dailyCurve < 1) parts.push(`busy day ×${b.dailyCurve.toFixed(2)}`);
  if (b.sickMultiplier < 1) parts.push(`sick pet ×${b.sickMultiplier}`);
  if ((b.foodMultiplier ?? 1) > 1) parts.push(`meal boost ×${b.foodMultiplier}`); // older saves have none
  return `+${payout.tokens} tokens${parts.length > 0 ? `: ${parts.join(", ")}` : ""}`;
}

// ---- Setup and settings ----

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  school: "School",
  writing: "Writing",
  art: "Art & design",
  code: "Code",
  music: "Music",
  other: "Something else",
};

/** One line under the type choice: what picking it changes (only the words). */
export const PROJECT_TYPE_HINTS: Record<ProjectType, string> = {
  school: "Requirements and tasks, like an assignment sheet.",
  writing: "Requirements are chapters and tasks are scenes.",
  art: "Requirements are pieces and tasks are steps.",
  code: "Requirements are features; tasks stay tasks.",
  music: "Requirements are tracks; tasks stay tasks.",
  other: "Requirements are milestones; tasks stay tasks.",
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = { gentle: "Gentle", steady: "Steady", strict: "Strict" };
export const DIFFICULTY_HINTS: Record<Difficulty, string> = {
  gentle: "Forgiving. Worried only when you're well behind, and slow to get sick.",
  steady: "Balanced. Worried when you fall a little behind, sick after two idle weeks.",
  strict: "Notices quickly when you fall behind or leave work idle.",
};

export const INVOLVEMENT_LABELS: Record<PetInvolvement, string> = { minimal: "Minimal", mild: "Mild", moderate: "Moderate" };
export const INVOLVEMENT_HINTS: Record<PetInvolvement, string> = {
  minimal: "Stays put and keeps quiet on your pages. Focus naps still work.",
  mild: "Walks around, celebrates finished tasks and checks in after naps.",
  moderate: "Mild, plus it leaves sticky notes about your work. More mischief coming in a future update.",
};

/** The desktop app's Start with computer setting. */
export const START_WITH_COMPUTER_LABEL = "Start Studium when your computer starts";
export const START_WITH_COMPUTER_HINT = "Your pets are there as soon as you log in.";
export const PET_SOUNDS_LABEL = "Pet sounds";
export const PET_SOUNDS_HINT = "On Moderate, pets make their sounds out loud, at most one every 30 seconds.";
export const PET_VOLUME_LABEL = "Volume";
export const SOUND_BUBBLES_LABEL = "Sound bubbles";
export const SOUND_BUBBLES_HINT = "Show a pet's sounds as words in a bubble, like captions (\"Meow!\"). Questions from your pets always show.";
export const START_OPEN_LABEL = "Open the window";
export const START_QUIETLY_LABEL = "Start quietly in the tray";
export const START_QUIETLY_HINT = "Studium waits in the tray by the clock (Windows may tuck it under the ^) until you open it.";

/** The Overview's heading: "Abby's Projects", or "Your Projects" with no nickname. */
export function projectsHeading(nickname: string): string {
  const name = nickname.trim();
  return name ? `${name}'s Projects` : "Your Projects";
}

export const NO_PROJECTS_TITLE = "No projects yet";
export const NO_PROJECTS_TEXT = "Start a project and its pet hatches once you've planned it.";
export const FIRST_PROJECT_TITLE = "Create your first project";
export const FIRST_PROJECT_TEXT =
  "Each project gets its own egg. Add a few requirements and it hatches into a pet that follows how the work is going.";

export const SETUP_COPY = {
  welcome: "Welcome to Studium",
  nameTitle: "What should we call you?",
  namePlaceholder: "Optional",
  nameHint: "Shown on your Overview and in your pets' notes. Leave it blank to go without.",
  petsTitle: "Your pets",
  involvementLegend: "How much they interact",
  lookTitle: "Your look",
  progressLegend: "How should Total Progress look?",
  themeLegend: "Light or dark?",
  changeLater: "You can change all of this later in Settings.",
} as const;

/** Made-up projects for setup's progress previews. */
export const SETUP_SAMPLE_PROJECTS = [
  { name: "portraits", color: "#2d3a8c", percent: 57 },
  { name: "novel", color: "#c9501a", percent: 49 },
  { name: "history", color: "#3a7c4f", percent: 24 },
] as const;

// ---- Blocking ----

/** How a blocker is named: a requirement by its title; a task by its title, plus its requirement when another task in the project has the same title. */
export function blockerName(b: Blocker, projectTasks: Task[], requirements: Requirement[]): string {
  if (b.kind === "requirement") return b.requirement.title;
  const { task } = b;
  const repeated = projectTasks.some((t) => t.id !== task.id && t.title.trim().toLowerCase() === task.title.trim().toLowerCase());
  if (!repeated) return task.title;
  const req = requirements.find((r) => r.id === task.requirementId);
  return `${task.title} (${req ? req.title : "Unlinked"})`;
}

/** "Waiting on Prototype 9" for one, "Waiting on 3" for more. */
export function waitingLabel(names: string[]): string {
  return names.length === 1 ? `Waiting on ${names[0]}` : `Waiting on ${names.length}`;
}

/** The "Blocked by" choice that waits on every other requirement in the project. */
export function blockedByAllLabel(words: ProjectWords = SCHOOL_WORDS): string {
  return `All other ${words.requirements}`;
}

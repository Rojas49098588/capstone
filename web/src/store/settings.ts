// User settings: preferences saved in this browser, apart from the project data (like the theme).
// "Pets on screen at once" and "Which pets show first" are read by the browser extension (content/pet.js copies it on the Studium
// page, on SETTINGS_EVENT). Progress style switches the Overview's Total Progress between rings and
// bars. Setup (components/Setup.tsx) fills in the nickname, default project type, default difficulty
// and how much pets interact; the extension reads the interaction level and the nickname.
import { NICKNAME_MAX } from "../planner/tuning";
import { DIFFICULTY_LEVELS, PROJECT_TYPES, type Difficulty, type ProjectType } from "../planner/types";
import { DIFFICULTY_LABELS, INVOLVEMENT_LABELS, PROJECT_TYPE_LABELS } from "../ui/format";

export const SETTINGS_KEY = "studium-settings-v1";
/** Sent after settings are saved, so the extension picks them up. extension/content/logic.js uses the same names. */
export const SETTINGS_EVENT = "studium:settings-updated";

export type ProgressStyle = "bar" | "circle";
export type PetInvolvement = "minimal" | "mild" | "moderate";
export const PET_INVOLVEMENT_LEVELS: readonly PetInvolvement[] = ["minimal", "mild", "moderate"];
/** How many pets show on screen at once: a number, or every project's pet. */
export type PetCount = number | "all";
/** Which pets show first when not all of them fit: project order, or the closest due date. */
export type PetOrder = "project" | "dueDate";

export type Settings = {
  difficulty: Difficulty; // the difficulty new projects start with
  petCount: PetCount;
  petOrder: PetOrder;
  progressStyle: ProgressStyle;
  petInvolvement: PetInvolvement;
  nickname: string; // "" = none
  projectType: ProjectType; // the type new projects start with
  setupDone: boolean; // the first-run setup has been finished
  tutorialDone: boolean; // the project tutorial has been finished or skipped (Settings can replay it)
  shopTutorialDone: boolean; // the same for the Shop tutorial
};

export const DEFAULT_SETTINGS: Settings = {
  difficulty: "steady",
  petCount: "all",
  petOrder: "project",
  progressStyle: "circle",
  petInvolvement: "mild",
  nickname: "",
  projectType: "school",
  setupDone: false,
  tutorialDone: false,
  shopTutorialDone: false,
};

export const DIFFICULTIES: { value: Difficulty; label: string }[] = DIFFICULTY_LEVELS.map((value) => ({ value, label: DIFFICULTY_LABELS[value] }));
export const PROJECT_TYPE_OPTIONS: { value: ProjectType; label: string }[] = PROJECT_TYPES.map((value) => ({ value, label: PROJECT_TYPE_LABELS[value] }));
export const PET_ORDERS: { value: PetOrder; label: string }[] = [
  { value: "project", label: "Project order" },
  { value: "dueDate", label: "Closest due date" },
];
export const PROGRESS_STYLES: { value: ProgressStyle; label: string }[] = [
  { value: "circle", label: "Circle" },
  { value: "bar", label: "Bar" },
];
export const PET_INVOLVEMENTS: { value: PetInvolvement; label: string }[] = PET_INVOLVEMENT_LEVELS.map((value) => ({
  value,
  label: INVOLVEMENT_LABELS[value],
}));

// Values saved before setup existed.
const OLD_DIFFICULTY: Record<string, Difficulty> = { easy: "gentle", medium: "steady", hard: "strict" };
const OLD_INVOLVEMENT: Record<string, PetInvolvement> = { notMuch: "minimal", very: "mild" };

export function cleanNickname(v: unknown): string {
  return typeof v === "string" ? v.trim().slice(0, NICKNAME_MAX).trim() : "";
}

const oneOf = <T extends string>(options: { value: T }[], v: unknown, fallback: T): T =>
  options.some((o) => o.value === v) ? (v as T) : fallback;

/** Saved settings with anything missing or invalid replaced by its default. Never throws. */
export function parseSettings(raw: string | null): Settings {
  let v: unknown;
  try {
    v = raw === null ? null : JSON.parse(raw);
  } catch {
    v = null;
  }
  if (!v || typeof v !== "object" || Array.isArray(v)) return DEFAULT_SETTINGS;
  const o = v as Record<string, unknown>;
  const count = o.petCount;
  return {
    difficulty: oneOf(DIFFICULTIES, OLD_DIFFICULTY[o.difficulty as string] ?? o.difficulty, DEFAULT_SETTINGS.difficulty),
    petCount: count === "all" || (Number.isInteger(count) && (count as number) >= 1) ? (count as PetCount) : DEFAULT_SETTINGS.petCount,
    petOrder: oneOf(PET_ORDERS, o.petOrder, DEFAULT_SETTINGS.petOrder),
    progressStyle: oneOf(PROGRESS_STYLES, o.progressStyle, DEFAULT_SETTINGS.progressStyle),
    petInvolvement: oneOf(PET_INVOLVEMENTS, OLD_INVOLVEMENT[o.petInvolvement as string] ?? o.petInvolvement, DEFAULT_SETTINGS.petInvolvement),
    nickname: cleanNickname(o.nickname),
    projectType: oneOf(PROJECT_TYPE_OPTIONS, o.projectType, DEFAULT_SETTINGS.projectType),
    setupDone: o.setupDone === true,
    tutorialDone: o.tutorialDone === true,
    // Saved before the tour was split in two: finishing the old tour covered the Shop too.
    shopTutorialDone: o.shopTutorialDone === undefined ? o.tutorialDone === true : o.shopTutorialDone === true,
  };
}

export function loadSettings(storage: Storage | null): Settings {
  try {
    return parseSettings(storage?.getItem(SETTINGS_KEY) ?? null);
  } catch {
    return DEFAULT_SETTINGS; // storage blocked
  }
}

/** False if they couldn't be saved (they still apply for this visit). */
export function saveSettings(storage: Storage | null, settings: Settings): boolean {
  if (!storage) return false;
  try {
    storage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    return false;
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SETTINGS_EVENT));
  return true;
}

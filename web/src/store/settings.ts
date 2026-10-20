// User settings: preferences saved in this browser, apart from the project data (like the theme).
// "Pets on screen at once" and "Which pets show first" are read by the browser extension (content/pet.js copies it on the Studium
// page, on SETTINGS_EVENT). Difficulty, progress style and pet involvement do nothing yet.

export const SETTINGS_KEY = "studium-settings-v1";
/** Sent after settings are saved, so the extension picks them up. extension/content/logic.js uses the same names. */
export const SETTINGS_EVENT = "studium:settings-updated";

export type Difficulty = "easy" | "medium" | "hard";
export type ProgressStyle = "bar" | "circle";
export type PetInvolvement = "notMuch" | "very";
/** How many pets show on screen at once: a number, or every project's pet. */
export type PetCount = number | "all";
/** Which pets show first when not all of them fit: project order, or the closest due date. */
export type PetOrder = "project" | "dueDate";

export type Settings = {
  difficulty: Difficulty;
  petCount: PetCount;
  petOrder: PetOrder;
  progressStyle: ProgressStyle;
  petInvolvement: PetInvolvement;
};

export const DEFAULT_SETTINGS: Settings = {
  difficulty: "easy",
  petCount: "all",
  petOrder: "project",
  progressStyle: "bar",
  petInvolvement: "very",
};

export const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
];
export const PET_ORDERS: { value: PetOrder; label: string }[] = [
  { value: "project", label: "Project order" },
  { value: "dueDate", label: "Closest due date" },
];
export const PROGRESS_STYLES: { value: ProgressStyle; label: string }[] = [
  { value: "bar", label: "Bar" },
  { value: "circle", label: "Circle" },
];
export const PET_INVOLVEMENTS: { value: PetInvolvement; label: string }[] = [
  { value: "notMuch", label: "Not much" },
  { value: "very", label: "Very" },
];

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
    difficulty: oneOf(DIFFICULTIES, o.difficulty, DEFAULT_SETTINGS.difficulty),
    petCount: count === "all" || (Number.isInteger(count) && (count as number) >= 1) ? (count as PetCount) : DEFAULT_SETTINGS.petCount,
    petOrder: oneOf(PET_ORDERS, o.petOrder, DEFAULT_SETTINGS.petOrder),
    progressStyle: oneOf(PROGRESS_STYLES, o.progressStyle, DEFAULT_SETTINGS.progressStyle),
    petInvolvement: oneOf(PET_INVOLVEMENTS, o.petInvolvement, DEFAULT_SETTINGS.petInvolvement),
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

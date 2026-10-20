// User settings: preferences saved in this browser, apart from the project data (like the theme).
// Difficulty, pets on screen, progress style and pet involvement are saved here now; what each one
// changes in Studium and the extension comes later.

export const SETTINGS_KEY = "studium-settings-v1";

export type Difficulty = "easy" | "medium" | "hard";
export type ProgressStyle = "bar" | "circle";
export type PetInvolvement = "notMuch" | "very";
/** How many pets show on screen at once: a number, or every project's pet. */
export type PetCount = number | "all";

export type Settings = {
  difficulty: Difficulty;
  petCount: PetCount;
  progressStyle: ProgressStyle;
  petInvolvement: PetInvolvement;
};

export const DEFAULT_SETTINGS: Settings = {
  difficulty: "easy",
  petCount: "all",
  progressStyle: "bar",
  petInvolvement: "very",
};

export const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
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
    return true;
  } catch {
    return false;
  }
}

// All wording shown in the UI, in one place so it stays consistent and testable.
import type { NeglectedRequirement } from "../planner/mood";
import { DAY_MS, isDateKey, localDateKey, startOfLocalDay } from "../planner/time";
import { HATCH_REQUIREMENTS, LEARNING_MIN_SAMPLES_SHOWN } from "../planner/tuning";
import type { Difficulty, Mood, ProjectType, Task } from "../planner/types";
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

export function hatchHint(remaining: number): string {
  return `Add ${remaining} more ${remaining === 1 ? "requirement" : "requirements"} to hatch`;
}

/** The edit dialog's companion line while the pet is an egg: it doesn't give the animal away. */
export function eggCompanionLabel(): string {
  return `Companion: an egg (it hatches once the project has ${HATCH_REQUIREMENTS} requirements).`;
}

export function hatchingMessage(shortName: string): string {
  return `${shortName} is hatching!`;
}

export function gapLabel(gap: number): string {
  const n = Math.round(Math.abs(gap));
  if (n === 0) return "On plan";
  return `${n} ${n === 1 ? "point" : "points"} ${gap > 0 ? "ahead of" : "behind"} plan`;
}

export function attentionLabel(neglected: NeglectedRequirement[]): string {
  if (neglected.length === 0) return "All requirements active";
  const top = neglected[0];
  return `${top.requirement.title}: ${top.idleDays} days idle`;
}

export function accuracyLabel(shortName: string, multiplier: number, samples: number): string | null {
  if (samples < LEARNING_MIN_SAMPLES_SHOWN) return null;
  return `Your ${shortName} tasks take about ${multiplier.toFixed(1)}× your estimates`;
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

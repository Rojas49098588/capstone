// How each project's requirements list looks on this device: the ≡ menu's view and the collapsed
// requirements (tasks and requirements view spec). Kept apart from the synced data on purpose.
import { REQUIREMENT_FILTERS, type RequirementFilter } from "../planner/requirementView";

export type ViewPrefs = { filters: RequirementFilter[]; collapsed: string[] };

export const viewPrefsKey = (projectId: string) => `studium.requirementView.${projectId}`;

const defaults = (): ViewPrefs => ({ filters: [], collapsed: [] });

export function loadViewPrefs(storage: Storage | null, projectId: string): ViewPrefs {
  let parsed: unknown;
  try {
    parsed = JSON.parse(storage?.getItem(viewPrefsKey(projectId)) ?? "null");
  } catch {
    return defaults();
  }
  if (typeof parsed !== "object" || parsed === null) return defaults();
  const { filters, view, collapsed } = parsed as Record<string, unknown>;
  // Saved before filters stacked: one view ("all" or a filter).
  const wanted = Array.isArray(filters) ? filters : typeof view === "string" ? [view] : [];
  return {
    filters: REQUIREMENT_FILTERS.filter((f) => wanted.includes(f)),
    collapsed: Array.isArray(collapsed) ? collapsed.filter((id): id is string => typeof id === "string") : [],
  };
}

export function saveViewPrefs(storage: Storage | null, projectId: string, prefs: ViewPrefs): void {
  try {
    storage?.setItem(viewPrefsKey(projectId), JSON.stringify(prefs));
  } catch {
    // Storage full or blocked: the view just isn't remembered.
  }
}

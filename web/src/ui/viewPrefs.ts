// How each project's requirements list looks on this device: the ≡ menu's view and the collapsed
// requirements (tasks and requirements view spec). Kept apart from the synced data on purpose.
import { REQUIREMENT_VIEWS, type RequirementView } from "../planner/requirementView";

export type ViewPrefs = { view: RequirementView; collapsed: string[] };

export const viewPrefsKey = (projectId: string) => `studium.requirementView.${projectId}`;

const defaults = (): ViewPrefs => ({ view: "all", collapsed: [] });

export function loadViewPrefs(storage: Storage | null, projectId: string): ViewPrefs {
  let parsed: unknown;
  try {
    parsed = JSON.parse(storage?.getItem(viewPrefsKey(projectId)) ?? "null");
  } catch {
    return defaults();
  }
  if (typeof parsed !== "object" || parsed === null) return defaults();
  const { view, collapsed } = parsed as Record<string, unknown>;
  return {
    view: REQUIREMENT_VIEWS.includes(view as RequirementView) ? (view as RequirementView) : "all",
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

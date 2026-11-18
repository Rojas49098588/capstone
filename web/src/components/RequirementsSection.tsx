import { useState } from "react";
import { sortListTasks } from "../planner/order";
import { VIEW_LABELS, viewOf, type RequirementView } from "../planner/requirementView";
import { loadViewPrefs, saveViewPrefs, type ViewPrefs } from "../ui/viewPrefs";
import ViewMenu from "./ViewMenu";
import { useStudiumContext } from "../store/useStudium";
import { capitalize, hatchingMessage, wordsFor } from "../ui/format";
import { BUTTON_SMALL, CARD, SERIF } from "../ui/styles";
import RequirementCard from "./RequirementCard";
import RequirementForm from "./RequirementForm";
import TaskRow from "./TaskRow";

type Props = {
  projectId: string;
  onRequestComplete: (taskId: string) => void;
  onHatch: (message: string) => void; // the 3rd requirement just hatched the project's egg
};

export default function RequirementsSection({ projectId, onRequestComplete, onHatch }: Props) {
  const s = useStudiumContext();
  const [adding, setAdding] = useState(false);
  // What this device remembers about the list (tasks and requirements view spec); reloaded per project.
  const [prefs, setPrefsState] = useState<{ projectId: string; prefs: ViewPrefs }>(() => ({ projectId, prefs: loadViewPrefs(s.storage, projectId) }));
  const current = prefs.projectId === projectId ? prefs.prefs : loadViewPrefs(s.storage, projectId);
  const setPrefs = (next: ViewPrefs) => {
    setPrefsState({ projectId, prefs: next });
    saveViewPrefs(s.storage, projectId, next);
  };
  const requirements = s.data.requirements.filter((r) => r.projectId === projectId);
  const words = wordsFor(s.data.projects.find((p) => p.id === projectId));
  const shown = viewOf(projectId, s.data, current.view, s.now);
  const collapsed = new Set(current.collapsed);
  const allCollapsed = shown.requirements.length > 0 && shown.requirements.every((r) => collapsed.has(r.id));
  const unlinkedFilter = shown.tasksShown(null);
  const unlinkedAll = sortListTasks(s.data.tasks.filter((t) => t.projectId === projectId && t.requirementId === null));
  const unlinked = shown.showUnlinked ? unlinkedAll.filter(unlinkedFilter) : [];
  const unlinkedOpen = unlinkedAll.filter((t) => !t.done).length;
  const view = current.view;
  const setView = (v: RequirementView) => setPrefs({ ...current, view: v });
  const toggle = (id: string) =>
    setPrefs({ ...current, collapsed: collapsed.has(id) ? current.collapsed.filter((x) => x !== id) : [...current.collapsed, id] });
  const collapseAll = (collapse: boolean) => {
    const ids = new Set(shown.requirements.map((r) => r.id));
    const rest = current.collapsed.filter((id) => !ids.has(id));
    setPrefs({ ...current, collapsed: collapse ? [...rest, ...ids] : rest });
  };
  const empty: Record<RequirementView, string> = {
    all: "",
    soon: "Nothing due in the next 3 days.",
    today: "Nothing on today's list for this project.",
    hideCompleted: "Everything here is finished.",
  };

  return (
    <section aria-labelledby="requirements-heading" data-tour="requirements" className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <h2 id="requirements-heading" style={SERIF} className="text-2xl">
          {capitalize(words.requirements)}
        </h2>
        <div className="flex items-center gap-2">
          {!adding && (
            <button type="button" onClick={() => setAdding(true)} className={BUTTON_SMALL}>
              + Add {words.requirement}
            </button>
          )}
          {requirements.length > 0 && <ViewMenu view={view} onView={setView} allCollapsed={allCollapsed} onCollapseAll={collapseAll} />}
        </div>
      </div>
      {adding && (
        <div className={`${CARD} p-5`}>
          <RequirementForm
            submitLabel={`Add ${words.requirement}`}
            words={words}
            blockerChoices={requirements.filter((r) => !r.blockedByAll)}
            canWaitOnAll={requirements.length > 0 && !requirements.some((r) => r.blockedByAll)}
            onSubmit={(values) => {
              const { hatched } = s.createRequirement({ projectId, ...values });
              const project = s.data.projects.find((p) => p.id === projectId);
              if (hatched && project) onHatch(hatchingMessage(project.shortName));
              setAdding(false);
            }}
            onCancel={() => setAdding(false)}
          />
        </div>
      )}
      {requirements.length === 0 && !adding && (
        <p className="text-sm italic text-[var(--color-muted-foreground)]">
          No {words.requirements} yet. Add one first: every {words.task} belongs to a {words.requirement}, and its weight
          decides what the {words.tasks} are worth.
        </p>
      )}
      {requirements.length > 0 && shown.requirements.length === 0 && view !== "all" && (
        <p className="text-sm text-[var(--color-muted-foreground)] flex items-center gap-2">
          <span className="italic">{empty[view]}</span>
          <button type="button" onClick={() => setView("all")} className={BUTTON_SMALL}>
            Show all
          </button>
        </p>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {shown.requirements.map((r) => (
          <RequirementCard
            key={r.id}
            requirementId={r.id}
            onRequestComplete={onRequestComplete}
            onHatch={onHatch}
            collapsed={collapsed.has(r.id)}
            onToggleCollapsed={() => toggle(r.id)}
            taskFilter={view === "all" ? undefined : shown.tasksShown(r.id)}
            reorderable={view !== "today"}
          />
        ))}
      </div>
      {view !== "all" && shown.hiddenCount > 0 && shown.requirements.length > 0 && (
        <p className="text-sm text-[var(--color-muted-foreground)] flex items-center gap-2">
          {shown.hiddenCount} more hidden by {VIEW_LABELS[view]}
          <button type="button" onClick={() => setView("all")} className={BUTTON_SMALL}>
            Show all
          </button>
        </p>
      )}
      {unlinked.length > 0 && (
        <section aria-label={`Unlinked ${words.tasks}`} className={`${CARD} p-5 border-dashed`}>
          <h3 className="font-semibold">Unlinked</h3>
          <p className="text-xs text-[var(--color-muted-foreground)] mb-2">
            These {words.tasks} earn nothing until you link them to a {words.requirement}.
          </p>
          <div data-reorder-list>
            {unlinked.map((t, i) => (
              <TaskRow
                key={t.id}
                taskId={t.id}
                onRequestComplete={onRequestComplete}
                reorder={t.done || view === "today" ? undefined : { index: i, count: unlinkedOpen, onMove: (to) => s.moveTask(t.id, to) }}
              />
            ))}
          </div>
        </section>
      )}
    </section>
  );
}

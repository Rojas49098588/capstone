import { taskDueLimit } from "../planner/dueDates";
import { useState } from "react";
import { sortListTasks } from "../planner/order";
import { canBlockByAll, openRequirementBlockers, requirementBlockerOptions } from "../planner/blocking";
import { estimateMultipliers, multiplierFor } from "../planner/learning";
import { neglectDays, requirementIdleDays } from "../planner/mood";
import { isRequirementDone, plannedProgress, requirementProgress, tasksOfRequirement } from "../planner/progress";
import { useStudiumContext } from "../store/useStudium";
import { formatDate, hatchingMessage, percent, wordsFor } from "../ui/format";
import type { Task } from "../planner/types";
import { BUTTON_SECONDARY, BUTTON_SMALL, CARD } from "../ui/styles";
import RequirementForm from "./RequirementForm";
import TaskForm from "./TaskForm";
import TaskRow from "./TaskRow";
import WaitingOn from "./WaitingOn";

type Props = {
  requirementId: string;
  onRequestComplete: (taskId: string) => void;
  onHatch?: (message: string) => void; // a duplicate just hatched the project's egg
  collapsed?: boolean; // one line: title, sublabel, due date, Waiting on (tasks and requirements view spec)
  onToggleCollapsed?: () => void; // shows the ▾ / ▸ toggle
  taskFilter?: (t: Task) => boolean; // the ≡ view's tasks; missing = all
  reorderable?: boolean; // Move up / down and the grip (default true)
};
type Mode = "view" | "edit" | "confirmDelete" | "addTask";

/** A requirement's sublabel: a small, muted tag (only a label, no grouping). */
export function SublabelTag({ text }: { text: string }) {
  return (
    <span className="inline-block align-middle text-[10px] font-mono uppercase tracking-widest border border-[var(--color-border)] px-1.5 text-[var(--color-muted-foreground)] break-all">
      {text}
    </span>
  );
}

export default function RequirementCard({ requirementId, onRequestComplete, onHatch, collapsed = false, onToggleCollapsed, taskFilter, reorderable = true }: Props) {
  const s = useStudiumContext();
  const [mode, setMode] = useState<Mode>("view");
  const requirement = s.data.requirements.find((r) => r.id === requirementId);
  const project = requirement ? s.data.projects.find((p) => p.id === requirement.projectId) : undefined;
  if (!requirement || !project) return null;

  const projectTasks = s.data.tasks.filter((t) => t.projectId === project.id);
  const requirements = s.data.requirements.filter((r) => r.projectId === project.id);
  const tasks = sortListTasks(tasksOfRequirement(requirement.id, projectTasks));
  const openCount = tasks.filter((t) => !t.done).length;
  const multiplier = multiplierFor(estimateMultipliers(s.data), project.id);
  const progress = requirementProgress(requirement.id, s.data.tasks, multiplier);
  const planned = plannedProgress(requirement, project, s.now);
  const done = isRequirementDone(requirement.id, s.data.tasks);
  const idle = requirementIdleDays(requirement, s.data, s.now);
  const neglected = !done && planned > 0 && idle >= neglectDays(project);
  const words = wordsFor(project);
  const due = `Due ${formatDate(requirement.dueDate ?? project.deadline)}`;
  const dates = `${requirement.startDate ? `${formatDate(requirement.startDate)} – ` : ""}${due}`;
  const shown = taskFilter ? tasks.filter(taskFilter) : tasks;
  const blockerNames = openRequirementBlockers(requirement, s.data).map((r) => r.title);
  const toggle = onToggleCollapsed && (
    <button
      type="button"
      aria-label={`${collapsed ? "Expand" : "Collapse"} ${requirement.title}`}
      aria-expanded={!collapsed}
      disabled={mode === "edit"}
      onClick={onToggleCollapsed}
      className="flex-shrink-0 w-5 text-sm leading-6 text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] disabled:opacity-30"
    >
      {collapsed ? "▸" : "▾"}
    </button>
  );

  if (collapsed) {
    return (
      <article aria-label={requirement.title} className={`${CARD} px-5 py-3`}>
        <div className="flex items-start gap-2">
          {toggle}
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-semibold text-[var(--color-foreground)] break-words">{requirement.title}</span>
              {requirement.sublabel && <SublabelTag text={requirement.sublabel} />}
              <span className="text-xs font-mono text-[var(--color-muted-foreground)]">{due}</span>
              {done && <span className="text-xs text-[var(--color-muted-foreground)]">Finished</span>}
            </p>
            <WaitingOn names={blockerNames} />
          </div>
        </div>
      </article>
    );
  }

  return (
    <article aria-label={requirement.title} className={`${CARD} p-5 space-y-3`}>
      {mode === "edit" ? (
        <RequirementForm
          initial={requirement}
          submitLabel={`Save ${words.requirement}`}
          words={words}
          blockerChoices={requirementBlockerOptions(requirement.id, s.data)}
          canWaitOnAll={canBlockByAll(requirement.id, s.data)}
          onSubmit={(values) => {
            s.updateRequirement(requirement.id, values);
            setMode("view");
          }}
          onCancel={() => setMode("view")}
        />
      ) : (
        <div className="flex items-start justify-between gap-3">
          {toggle}
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-[var(--color-foreground)] break-words">{requirement.title}</h3>
            {requirement.sublabel && (
              <div className="mt-0.5">
                <SublabelTag text={requirement.sublabel} />
              </div>
            )}
            <p className="text-xs font-mono text-[var(--color-muted-foreground)] mt-0.5">
              Weight {requirement.weight} · {dates}
            </p>
            <WaitingOn names={blockerNames} />
          </div>
          <div className="flex gap-1 flex-shrink-0">
            <button type="button" aria-label={`Edit ${requirement.title}`} onClick={() => setMode("edit")} className={BUTTON_SMALL}>
              Edit
            </button>
            <button
              type="button"
              aria-label={`Duplicate ${requirement.title}`}
              title={`Copy as the next ${words.requirement}, with its ${words.tasks} unchecked`}
              onClick={() => {
                const { hatched } = s.duplicateRequirement(requirement.id);
                if (hatched) onHatch?.(hatchingMessage(project.shortName));
              }}
              className={BUTTON_SMALL}
            >
              Duplicate
            </button>
            <button type="button" aria-label={`Delete ${requirement.title}`} onClick={() => setMode("confirmDelete")} className={BUTTON_SMALL}>
              Delete
            </button>
          </div>
        </div>
      )}

      <div>
        <div
          className="relative h-2 bg-[var(--color-muted)]"
          role="progressbar"
          aria-label={`${requirement.title} progress`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent(progress)}
        >
          <div className="h-full transition-all duration-500" style={{ width: `${percent(progress)}%`, backgroundColor: project.color }} />
          <div
            className="absolute -top-1 h-4 w-0.5 bg-[var(--color-foreground)]"
            style={{ left: `${percent(planned)}%` }}
            title={`Planned by today: ${percent(planned)}%`}
            aria-hidden="true"
          />
        </div>
        <p className="text-xs mt-1 flex justify-between gap-2 text-[var(--color-muted-foreground)]">
          <span>
            {percent(progress)}% done · plan {percent(planned)}%
          </span>
          {neglected && <span className="text-[var(--color-accent)] font-medium">{idle} days idle</span>}
          {done && <span>Finished</span>}
        </p>
      </div>

      {mode === "confirmDelete" && (
        <div role="alert" className="border border-[var(--color-accent)] p-3 space-y-2 text-sm">
          <p>
            Delete “{requirement.title}”? What should happen to its {tasks.length} {tasks.length === 1 ? words.task : words.tasks}?
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => s.deleteRequirement(requirement.id, "unlinkTasks")} className={BUTTON_SECONDARY}>
              Move {words.tasks} to Unlinked
            </button>
            <button type="button" onClick={() => s.deleteRequirement(requirement.id, "deleteTasks")} className={BUTTON_SECONDARY}>
              Delete {words.tasks} too
            </button>
            <button type="button" onClick={() => setMode("view")} className={BUTTON_SECONDARY}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div data-reorder-list>
        {shown.length === 0 ? (
          <p className="text-sm italic text-[var(--color-muted-foreground)]">No {words.tasks} yet.</p>
        ) : (
          shown.map((t, i) => (
            <TaskRow
              key={t.id}
              taskId={t.id}
              onRequestComplete={onRequestComplete}
              reorder={t.done || !reorderable ? undefined : { index: i, count: openCount, onMove: (to) => s.moveTask(t.id, to) }}
            />
          ))
        )}
      </div>

      {mode === "addTask" ? (
        <TaskForm
          requirements={requirements}
          projectTasks={projectTasks}
          initial={{ requirementId: requirement.id }}
          submitLabel={`Add ${words.task}`}
          words={words}
          dueLimit={(requirementId) => taskDueLimit({ projectId: project.id, requirementId }, s.data)}
          onSubmit={(values) => {
            s.createTask({ projectId: project.id, ...values });
            setMode("view");
          }}
          onCancel={() => setMode("view")}
        />
      ) : (
        <button type="button" onClick={() => setMode("addTask")} className={BUTTON_SMALL}>
          + Add {words.task}
        </button>
      )}
    </article>
  );
}

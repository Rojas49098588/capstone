import { useState } from "react";
import { estimateMultipliers, multiplierFor } from "../planner/learning";
import { requirementIdleDays } from "../planner/mood";
import { isRequirementDone, plannedProgress, requirementProgress, tasksOfRequirement } from "../planner/progress";
import { NEGLECT_DAYS } from "../planner/tuning";
import { useStudiumContext } from "../store/useStudium";
import { formatDate, percent } from "../ui/format";
import { BUTTON_SECONDARY, BUTTON_SMALL, CARD } from "../ui/styles";
import RequirementForm from "./RequirementForm";
import TaskForm from "./TaskForm";
import TaskRow from "./TaskRow";

type Props = { requirementId: string; onRequestComplete: (taskId: string) => void };
type Mode = "view" | "edit" | "confirmDelete" | "addTask";

export default function RequirementCard({ requirementId, onRequestComplete }: Props) {
  const s = useStudiumContext();
  const [mode, setMode] = useState<Mode>("view");
  const requirement = s.data.requirements.find((r) => r.id === requirementId);
  const project = requirement ? s.data.projects.find((p) => p.id === requirement.projectId) : undefined;
  if (!requirement || !project) return null;

  const projectTasks = s.data.tasks.filter((t) => t.projectId === project.id);
  const requirements = s.data.requirements.filter((r) => r.projectId === project.id);
  const tasks = [...tasksOfRequirement(requirement.id, projectTasks)].sort(
    (a, b) => Number(a.done) - Number(b.done) || Number(b.priority) - Number(a.priority),
  );
  const multiplier = multiplierFor(estimateMultipliers(s.data), project.id);
  const progress = requirementProgress(requirement.id, s.data.tasks, multiplier);
  const planned = plannedProgress(requirement, project, s.now);
  const done = isRequirementDone(requirement.id, s.data.tasks);
  const idle = requirementIdleDays(requirement, s.data, s.now);
  const neglected = !done && planned > 0 && idle >= NEGLECT_DAYS;
  const dates = `${requirement.startDate ? `${formatDate(requirement.startDate)} – ` : ""}Due ${formatDate(requirement.dueDate ?? project.deadline)}`;

  return (
    <article aria-label={requirement.title} className={`${CARD} p-5 space-y-3`}>
      {mode === "edit" ? (
        <RequirementForm
          initial={requirement}
          submitLabel="Save requirement"
          onSubmit={(values) => {
            s.updateRequirement(requirement.id, values);
            setMode("view");
          }}
          onCancel={() => setMode("view")}
        />
      ) : (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-semibold text-[var(--color-foreground)] break-words">{requirement.title}</h3>
            <p className="text-xs font-mono text-[var(--color-muted-foreground)] mt-0.5">
              Weight {requirement.weight} · {dates}
            </p>
          </div>
          <div className="flex gap-1 flex-shrink-0">
            <button type="button" aria-label={`Edit ${requirement.title}`} onClick={() => setMode("edit")} className={BUTTON_SMALL}>
              Edit
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
            Delete “{requirement.title}”? What should happen to its {tasks.length} {tasks.length === 1 ? "task" : "tasks"}?
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => s.deleteRequirement(requirement.id, "unlinkTasks")} className={BUTTON_SECONDARY}>
              Move tasks to Unlinked
            </button>
            <button type="button" onClick={() => s.deleteRequirement(requirement.id, "deleteTasks")} className={BUTTON_SECONDARY}>
              Delete tasks too
            </button>
            <button type="button" onClick={() => setMode("view")} className={BUTTON_SECONDARY}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div>
        {tasks.length === 0 ? (
          <p className="text-sm italic text-[var(--color-muted-foreground)]">No tasks yet.</p>
        ) : (
          tasks.map((t) => <TaskRow key={t.id} taskId={t.id} onRequestComplete={onRequestComplete} />)
        )}
      </div>

      {mode === "addTask" ? (
        <TaskForm
          requirements={requirements}
          projectTasks={projectTasks}
          initial={{ requirementId: requirement.id }}
          submitLabel="Add task"
          onSubmit={(values) => {
            s.createTask({ projectId: project.id, ...values });
            setMode("view");
          }}
          onCancel={() => setMode("view")}
        />
      ) : (
        <button type="button" onClick={() => setMode("addTask")} className={BUTTON_SMALL}>
          + Add task
        </button>
      )}
    </article>
  );
}

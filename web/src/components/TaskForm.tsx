import { useState, type FormEvent } from "react";
import { blockerOptions } from "../planner/blocking";
import { DEFAULT_ESTIMATE_MIN } from "../planner/tuning";
import type { Requirement, Task } from "../planner/types";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, INPUT, LABEL } from "../ui/styles";
import EstimatePicker from "./EstimatePicker";

export type TaskFormValues = { title: string; requirementId: string | null; estimateMin: number; blockedBy: string[] };

type Props = {
  requirements: Requirement[];
  projectTasks: Task[];
  taskId?: string; // set when editing, so loop-creating blockers are hidden
  initial?: Partial<TaskFormValues>;
  submitLabel: string;
  onSubmit: (values: TaskFormValues) => void;
  onCancel?: () => void;
};

export default function TaskForm({ requirements, projectTasks, taskId, initial, submitLabel, onSubmit, onCancel }: Props) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [requirementId, setRequirementId] = useState<string | null>(
    initial?.requirementId !== undefined ? initial.requirementId : (requirements[0]?.id ?? null),
  );
  const [estimateMin, setEstimateMin] = useState(initial?.estimateMin ?? DEFAULT_ESTIMATE_MIN);
  const [blockedBy, setBlockedBy] = useState<string[]>(initial?.blockedBy ?? []);
  const [error, setError] = useState("");
  const options = taskId ? blockerOptions(taskId, projectTasks) : projectTasks;

  function toggleBlocker(id: string) {
    setBlockedBy((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Give the task a title.");
      return;
    }
    onSubmit({ title: title.trim(), requirementId, estimateMin, blockedBy });
  }

  return (
    <form onSubmit={submit} className="space-y-3 py-2">
      <div>
        <label className={LABEL} htmlFor={`${taskId ?? "new"}-title`}>
          Task
        </label>
        <input
          id={`${taskId ?? "new"}-title`}
          aria-label="Task title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs doing?"
          className={INPUT}
        />
        {error && <p className="text-xs text-[var(--color-accent)] mt-1">{error}</p>}
      </div>
      <div>
        <label className={LABEL} htmlFor={`${taskId ?? "new"}-req`}>
          Requirement
        </label>
        <select
          id={`${taskId ?? "new"}-req`}
          aria-label="Requirement"
          value={requirementId ?? ""}
          onChange={(e) => setRequirementId(e.target.value || null)}
          className={INPUT}
        >
          {requirements.map((r) => (
            <option key={r.id} value={r.id}>
              {r.title}
            </option>
          ))}
          <option value="">Unlinked (earns no tokens)</option>
        </select>
      </div>
      <EstimatePicker label="Estimate" value={estimateMin} onChange={setEstimateMin} />
      {options.length > 0 && (
        <fieldset>
          <legend className={LABEL}>Blocked by</legend>
          <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
            {options.map((t) => (
              <label key={t.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={blockedBy.includes(t.id)} onChange={() => toggleBlocker(t.id)} />
                {t.title}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <div className="flex gap-2">
        <button type="submit" className={BUTTON_PRIMARY}>
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className={BUTTON_SECONDARY}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

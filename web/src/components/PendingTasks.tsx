// Tasks added on the phone (quick add) wait here until they get a requirement and an estimate.
// Until then they earn nothing and don't count toward any mood (store/actions.ts createPendingTask).
import { useState, type FormEvent } from "react";
import { taskDueLimit } from "../planner/dueDates";
import { DEFAULT_ESTIMATE_MIN } from "../planner/tuning";
import type { Task } from "../planner/types";
import { isPending } from "../store/actions";
import { useStudiumContext } from "../store/useStudium";
import { capitalize, wordsFor } from "../ui/format";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, BUTTON_SMALL, CARD, INPUT, LABEL, MUTED } from "../ui/styles";
import EstimatePicker from "./EstimatePicker";

type Props = { onSelect: (projectId: string) => void };

export default function PendingTasks({ onSelect }: Props) {
  const s = useStudiumContext();
  const [open, setOpen] = useState<string | null>(null);
  const tasks = s.data.tasks.filter(isPending);
  if (tasks.length === 0) return null;

  return (
    <section aria-labelledby="pending-heading" className={`${CARD} p-5 border-dashed space-y-3`}>
      <div>
        <h3 id="pending-heading" className="font-semibold">
          Pending
        </h3>
        <p className={`text-xs ${MUTED}`}>Added on your phone. Add the details to start earning tokens for them.</p>
      </div>
      <ul className="space-y-3">
        {tasks.map((t) => {
          const project = s.data.projects.find((p) => p.id === t.projectId);
          return (
            <li key={t.id} className="space-y-2">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <span className={`block text-xs font-mono uppercase tracking-widest ${MUTED}`}>{project?.shortName}</span>
                  <span className={`block text-sm break-words ${t.done ? `line-through ${MUTED}` : ""}`}>{t.title}</span>
                </div>
                {open !== t.id && (
                  <button type="button" aria-label={`Add details to ${t.title}`} onClick={() => setOpen(t.id)} className={BUTTON_SMALL}>
                    Add details
                  </button>
                )}
                <button type="button" aria-label={`Delete ${t.title}`} onClick={() => s.deleteTask(t.id)} className={`${MUTED} hover:text-[var(--color-foreground)] text-lg leading-none`}>
                  ×
                </button>
              </div>
              {open === t.id && <DetailsForm task={t} onSelect={onSelect} onDone={() => setOpen(null)} />}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function DetailsForm({ task, onSelect, onDone }: { task: Task; onSelect: (projectId: string) => void; onDone: () => void }) {
  const s = useStudiumContext();
  const project = s.data.projects.find((p) => p.id === task.projectId);
  const words = wordsFor(project);
  const requirements = s.data.requirements.filter((r) => r.projectId === task.projectId);
  const [requirementId, setRequirementId] = useState(requirements[0]?.id ?? "");
  const [estimateMin, setEstimateMin] = useState(DEFAULT_ESTIMATE_MIN);
  const [dueDate, setDueDate] = useState("");

  if (requirements.length === 0) {
    return (
      <p className="text-sm">
        {`Add a ${words.requirement} to ${project?.shortName ?? "its project"} first. `}
        <button type="button" onClick={() => onSelect(task.projectId)} className="underline">
          Open {project?.shortName}
        </button>
      </p>
    );
  }

  function save(e: FormEvent) {
    e.preventDefault();
    s.finishTaskDetails(task.id, { requirementId, estimateMin, dueDate: dueDate || null });
    onDone();
  }

  return (
    <form onSubmit={save} className="space-y-3 pl-2 border-l-2 border-[var(--color-border)]">
      <div>
        <label className={LABEL} htmlFor={`${task.id}-pending-req`}>
          {capitalize(words.requirement)}
        </label>
        <select id={`${task.id}-pending-req`} value={requirementId} onChange={(e) => setRequirementId(e.target.value)} className={INPUT}>
          {requirements.map((r) => (
            <option key={r.id} value={r.id}>
              {r.title}
            </option>
          ))}
        </select>
      </div>
      <EstimatePicker label="Estimate" value={estimateMin} onChange={setEstimateMin} />
      <div>
        <label className={LABEL} htmlFor={`${task.id}-pending-due`}>
          Due date (optional)
        </label>
        <input
          id={`${task.id}-pending-due`}
          type="date"
          value={dueDate}
          max={taskDueLimit({ projectId: task.projectId, requirementId }, s.data) ?? undefined}
          onChange={(e) => setDueDate(e.target.value)}
          className={INPUT}
        />
      </div>
      <div className="flex gap-2">
        <button type="submit" className={BUTTON_PRIMARY}>
          Save details
        </button>
        <button type="button" onClick={onDone} className={BUTTON_SECONDARY}>
          Cancel
        </button>
      </div>
    </form>
  );
}

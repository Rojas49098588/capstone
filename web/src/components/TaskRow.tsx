import { useState } from "react";
import { openBlockers } from "../planner/blocking";
import { todayTaskIds } from "../planner/suggest";
import { useStudiumContext } from "../store/useStudium";
import { formatMinutes } from "../ui/format";
import { BUTTON_SMALL } from "../ui/styles";
import TaskForm from "./TaskForm";

type Props = { taskId: string; onRequestComplete: (taskId: string) => void };

export default function TaskRow({ taskId, onRequestComplete }: Props) {
  const s = useStudiumContext();
  const [editing, setEditing] = useState(false);
  const task = s.data.tasks.find((t) => t.id === taskId);
  if (!task) return null;

  const project = s.data.projects.find((p) => p.id === task.projectId);
  const projectTasks = s.data.tasks.filter((t) => t.projectId === task.projectId);
  const requirements = s.data.requirements.filter((r) => r.projectId === task.projectId);
  const inToday = todayTaskIds(s.data, s.now).includes(task.id);
  const blockers = task.done ? [] : openBlockers(task, projectTasks);
  const color = project?.color ?? "var(--color-foreground)";

  if (editing) {
    return (
      <TaskForm
        requirements={requirements}
        projectTasks={projectTasks}
        taskId={task.id}
        initial={task}
        submitLabel="Save task"
        onSubmit={(values) => {
          s.updateTask(task.id, values);
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="group flex items-start gap-3 py-1.5">
      <button
        type="button"
        role="checkbox"
        aria-checked={task.done}
        aria-label={task.done ? `Reopen ${task.title}` : `Complete ${task.title}`}
        disabled={blockers.length > 0}
        onClick={() => (task.done ? s.reopenTask(task.id) : onRequestComplete(task.id))}
        className="mt-0.5 w-4 h-4 flex-shrink-0 border rounded-sm flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ borderColor: task.done ? color : "var(--color-border)", backgroundColor: task.done ? color : "transparent" }}
      >
        {task.done && (
          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm leading-relaxed break-words ${
            task.done ? "line-through text-[var(--color-muted-foreground)]" : "text-[var(--color-foreground)]"
          }`}
        >
          {task.title}
        </p>
        <p className="text-xs text-[var(--color-muted-foreground)]">
          {formatMinutes(task.estimateMin)} estimate
          {task.done && task.actualMin !== null && ` · took ${formatMinutes(task.actualMin)}`}
          {blockers.length > 0 && (
            <span className="text-[var(--color-accent)]"> · Waiting on: {blockers.map((b) => b.title).join(", ")}</span>
          )}
        </p>
        {task.requirementId === null && requirements.length > 0 && (
          <select
            aria-label={`Link ${task.title} to a requirement`}
            value=""
            onChange={(e) => e.target.value && s.updateTask(task.id, { requirementId: e.target.value })}
            className="mt-1 text-xs border border-[var(--color-border)] px-2 py-1"
          >
            <option value="">Link to a requirement…</option>
            {requirements.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {!task.done && (
          <button
            type="button"
            aria-pressed={inToday}
            onClick={() => (inToday ? s.removeFromToday(task.id) : s.addToToday(task.id))}
            className={BUTTON_SMALL}
          >
            {inToday ? "In today" : "+ Today"}
          </button>
        )}
        <button
          type="button"
          aria-pressed={task.priority}
          aria-label={`${task.priority ? "Unpin" : "Pin"} ${task.title}`}
          title={task.priority ? "Pinned to the top of Suggested next" : "Pin to the top of Suggested next"}
          onClick={() => s.togglePriority(task.id)}
          className={`px-1 ${task.priority ? "text-[var(--color-accent)]" : "text-[var(--color-border)] hover:text-[var(--color-accent)]"}`}
        >
          <svg className="w-4 h-4" fill={task.priority ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M6 21V5.5A2.5 2.5 0 0 1 8.5 3H19l-2.5 4L19 11H8" />
          </svg>
        </button>
        <button type="button" aria-label={`Edit ${task.title}`} onClick={() => setEditing(true)} className={BUTTON_SMALL}>
          Edit
        </button>
        <button
          type="button"
          aria-label={`Delete ${task.title}`}
          onClick={() => s.deleteTask(task.id)}
          className="px-1 text-lg leading-none text-[var(--color-muted-foreground)] hover:text-[var(--color-accent)]"
        >
          ×
        </button>
      </div>
    </div>
  );
}

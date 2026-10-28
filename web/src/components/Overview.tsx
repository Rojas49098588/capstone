import { isBlocked } from "../planner/blocking";
import { petStage } from "../planner/lifecycle";
import { suggestNext, todayTaskIds } from "../planner/suggest";
import type { Task } from "../planner/types";
import { useStudiumContext } from "../store/useStudium";
import { summarizeAll } from "../ui/derive";
import { EGG_LABEL, MOOD_COLORS, daysUntil, deadlineLabel, formatDate, gapLabel, percent } from "../ui/format";
import { CARD, LABEL, SERIF } from "../ui/styles";

type Props = { onSelect: (projectId: string) => void; onRequestComplete: (taskId: string) => void };

function Ring({ value, color, radius, strokeWidth }: { value: number; color: string; radius: number; strokeWidth: number }) {
  return (
    <g>
      <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--color-muted)" strokeWidth={strokeWidth} />
      <circle
        cx="50"
        cy="50"
        r={radius}
        pathLength="100"
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={`${value} ${100 - value}`}
        strokeLinecap="round"
        className="transition-all duration-700"
      />
    </g>
  );
}

export default function Overview({ onSelect, onRequestComplete }: Props) {
  const s = useStudiumContext();
  const dash = summarizeAll(s.data, s.now);
  const total = percent(dash.total);
  const projectsById = new Map(s.data.projects.map((p) => [p.id, p]));
  const todayTasks = todayTaskIds(s.data, s.now)
    .map((id) => s.data.tasks.find((t) => t.id === id))
    .filter((t): t is Task => t !== undefined);
  const suggestions = suggestNext(s.data, s.now);
  const count = dash.summaries.length;

  return (
    <div className="space-y-8">
      <div>
        <h1 style={SERIF} className="text-4xl text-[var(--color-foreground)]">
          Your Projects
        </h1>
        <p className="text-[var(--color-muted-foreground)] mt-1 text-sm">
          {count} active {count === 1 ? "project" : "projects"} · {todayTasks.filter((t) => !t.done).length} tasks planned
          today
        </p>
      </div>

      {/* Total progress */}
      <div data-tour="total-progress" className={`${CARD} p-6`}>
        <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
          <div>
            <p className={LABEL}>Total Progress — All Projects</p>
            <p style={SERIF} className="text-5xl">
              {total}
              <span className="text-2xl text-[var(--color-muted-foreground)]">%</span>
            </p>
          </div>
          <div className="text-right">
            <p className={LABEL}>Tasks</p>
            <p style={SERIF} className="text-2xl">
              {dash.tasksDone}
              <span className="text-base text-[var(--color-muted-foreground)]"> / {dash.tasksTotal}</span>
            </p>
          </div>
        </div>
        {s.settings.progressStyle === "bar" ? (
          // Bar style (User Settings): one bar per project.
          <ul aria-label="Progress by project" className="space-y-3 border-t border-[var(--color-border)] pt-6">
            {dash.summaries.map((sum) => (
              <li key={sum.project.id}>
                <button type="button" onClick={() => onSelect(sum.project.id)} className="w-full text-left group">
                  <span className="flex items-center justify-between gap-3 mb-1">
                    <span className="flex items-center gap-2 text-xs font-mono text-[var(--color-muted-foreground)] group-hover:text-[var(--color-foreground)]">
                      <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: sum.project.color }} />
                      {sum.project.shortName}
                    </span>
                    <span className="text-xs font-mono">{percent(sum.progress)}%</span>
                  </span>
                  <span
                    role="progressbar"
                    aria-label={`${sum.project.shortName} progress`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={percent(sum.progress)}
                    className="block h-2 bg-[var(--color-muted)] overflow-hidden"
                  >
                    <span
                      className="block h-full transition-all duration-700"
                      style={{ width: `${percent(sum.progress)}%`, backgroundColor: sum.project.color }}
                    />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col md:flex-row items-center gap-8 border-t border-[var(--color-border)] pt-6">
            <div className="relative w-44 h-44 flex-shrink-0">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100" aria-label={`${total}% total progress`}>
                {dash.summaries.map((sum, i) => (
                  <Ring
                    key={sum.project.id}
                    value={percent(sum.progress)}
                    color={sum.project.color}
                    radius={44 - i * (30 / Math.max(count - 1, 1))}
                    strokeWidth={Math.min(5, 26 / Math.max(count, 1))}
                  />
                ))}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span style={SERIF} className="text-xl leading-none">
                  {total}
                </span>
                <span className="text-xs font-mono text-[var(--color-muted-foreground)]">%</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-3 flex-1 w-full">
              {dash.summaries.map((sum) => (
                <button key={sum.project.id} type="button" onClick={() => onSelect(sum.project.id)} className="flex items-center gap-3 text-left group">
                  <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: sum.project.color }} />
                  <span className="text-xs font-mono text-[var(--color-muted-foreground)] group-hover:text-[var(--color-foreground)]">
                    {sum.project.shortName} · {percent(sum.progress)}%
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Priority focus */}
      <section
        aria-labelledby="priority-focus"
        data-tour="priority-focus"
        className="bg-[var(--color-inverse)] text-[var(--color-inverse-foreground)] border-l-4 border-[var(--color-accent)] p-6 space-y-6"
      >
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-white/55 mb-1">Priority Focus</p>
          <h2 id="priority-focus" style={SERIF} className="text-2xl">
            What matters next
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <section aria-labelledby="today-heading">
            <h3 id="today-heading" className="text-xs font-mono uppercase tracking-widest text-white/55 mb-3">
              Today
            </h3>
            {todayTasks.length === 0 ? (
              <p className="text-sm text-white/55">Nothing planned yet. Add tasks from Suggested next.</p>
            ) : (
              <ul className="space-y-3">
                {todayTasks.map((t) => {
                  const p = projectsById.get(t.projectId);
                  return (
                    <li key={t.id} className="flex items-start gap-3">
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={t.done}
                        aria-label={t.done ? `Reopen ${t.title}` : `Complete ${t.title}`}
                        disabled={!t.done && isBlocked(t, s.data.tasks)}
                        onClick={() => (t.done ? s.reopenTask(t.id) : onRequestComplete(t.id))}
                        className="mt-0.5 w-5 h-5 flex-shrink-0 border border-white/40 hover:border-white flex items-center justify-center text-xs disabled:opacity-40"
                      >
                        {t.done ? "✓" : ""}
                      </button>
                      <button type="button" onClick={() => p && onSelect(p.id)} className="flex-1 text-left min-w-0">
                        <span className="block text-xs font-mono uppercase tracking-widest text-white/50">{p?.shortName}</span>
                        <span className={`block text-sm break-words ${t.done ? "line-through text-white/50" : ""}`}>{t.title}</span>
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove ${t.title} from today`}
                        onClick={() => s.removeFromToday(t.id)}
                        className="text-white/50 hover:text-white text-lg leading-none"
                      >
                        ×
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
          <section aria-labelledby="suggested-heading">
            <h3 id="suggested-heading" className="text-xs font-mono uppercase tracking-widest text-white/55 mb-3">
              Suggested next
            </h3>
            {suggestions.length === 0 ? (
              <p className="text-sm text-white/55">No open tasks to suggest.</p>
            ) : (
              <ul className="space-y-3">
                {suggestions.map((sg) => (
                  <li key={sg.task.id} className="flex items-start gap-3">
                    <span className="w-4 flex-shrink-0 text-[var(--color-accent)]" aria-hidden="true">
                      {sg.task.priority ? "⚑" : ""}
                    </span>
                    <button type="button" onClick={() => onSelect(sg.project.id)} className="flex-1 text-left min-w-0">
                      <span className="block text-xs font-mono uppercase tracking-widest text-white/50">
                        {sg.project.shortName} · ~{sg.expectedTokens} tokens
                      </span>
                      <span className="block text-sm break-words">{sg.task.title}</span>
                    </button>
                    <button
                      type="button"
                      aria-label={`Add ${sg.task.title} to today`}
                      onClick={() => s.addToToday(sg.task.id)}
                      className="text-xs border border-white/30 hover:border-white px-2 py-1 flex-shrink-0"
                    >
                      + Today
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </section>

      {/* Project cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {dash.summaries.map((sum) => {
          const p = sum.project;
          const soon = daysUntil(p.deadline, s.now) < 30;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelect(p.id)}
              className={`${CARD} p-6 text-left hover:border-[var(--color-foreground)] transition-colors`}
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: p.color }} />
                  <div className="min-w-0">
                    <p className="text-xs font-mono text-[var(--color-muted-foreground)] uppercase tracking-widest">{p.shortName}</p>
                    <p className="font-semibold text-[var(--color-foreground)] leading-tight mt-0.5 break-words">{p.name}</p>
                  </div>
                </div>
                {petStage(p) === "egg" ? (
                  <span className="text-xs font-mono uppercase tracking-widest flex-shrink-0 text-[var(--color-muted-foreground)]">
                    {EGG_LABEL}
                  </span>
                ) : (
                  <span className="text-xs font-mono uppercase tracking-widest flex-shrink-0" style={{ color: MOOD_COLORS[sum.mood] }}>
                    {sum.mood}
                  </span>
                )}
              </div>
              <div className="mb-3">
                <div className="flex justify-between items-baseline mb-1.5 text-xs">
                  <span className="text-[var(--color-muted-foreground)]">
                    {sum.tasksDone} / {sum.tasksTotal} tasks{petStage(p) === "egg" ? "" : ` · ${gapLabel(sum.gap)}`}
                  </span>
                  <span className="font-mono font-medium">{percent(sum.progress)}%</span>
                </div>
                <div className="h-1.5 bg-[var(--color-muted)] overflow-hidden">
                  <div className="h-full" style={{ width: `${percent(sum.progress)}%`, backgroundColor: p.color }} />
                </div>
              </div>
              <p className={`text-xs ${soon ? "text-[var(--color-accent)] font-medium" : "text-[var(--color-muted-foreground)]"}`}>
                {deadlineLabel(p.deadline, s.now)} · {formatDate(p.deadline)}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

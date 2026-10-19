import { focusMinutes } from "../planner/focus";
import { startOfWeek } from "../planner/time";
import { useStudiumContext } from "../store/useStudium";
import { summarizeProject } from "../ui/derive";
import { daysUntil, deadlineLabel, formatDate, gapLabel, percent, weekFocusLabel } from "../ui/format";
import { BUTTON_SMALL, LABEL, SERIF } from "../ui/styles";
import Habitat from "./Habitat";
import RequirementsSection from "./RequirementsSection";

type Props = {
  projectId: string;
  justHatched: boolean;
  onRequestComplete: (taskId: string) => void;
  onEditProject: () => void;
  onOpenShop: () => void;
};

export default function ProjectDetail({ projectId, justHatched, onRequestComplete, onEditProject, onOpenShop }: Props) {
  const s = useStudiumContext();
  const project = s.data.projects.find((p) => p.id === projectId);
  if (!project) return null;
  const summary = summarizeProject(project, s.data, s.now);
  const soon = daysUntil(project.deadline, s.now) < 30;
  const focusedThisWeek = focusMinutes(s.data.events, { projectId: project.id, since: startOfWeek(s.now) });

  return (
    <div className="space-y-8">
      <div className="border-l-4 pl-5" style={{ borderColor: project.color }}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className={LABEL}>{project.shortName}</p>
            <h1 style={SERIF} className="text-3xl text-[var(--color-foreground)] break-words">
              {project.name}
            </h1>
            {project.description && <p className="text-[var(--color-muted-foreground)] text-sm mt-1 max-w-xl">{project.description}</p>}
            <button type="button" onClick={onEditProject} className={`${BUTTON_SMALL} mt-3`}>
              Edit project
            </button>
          </div>
          <div className="text-right flex-shrink-0">
            <p className={LABEL}>Deadline</p>
            <p style={SERIF} className="text-2xl">
              {formatDate(project.deadline)}
            </p>
            <p className={`text-xs font-mono mt-0.5 ${soon ? "text-[var(--color-accent)]" : "text-[var(--color-muted-foreground)]"}`}>
              {deadlineLabel(project.deadline, s.now)}
            </p>
          </div>
        </div>
        <div className="mt-5">
          <div className="flex justify-between items-baseline mb-2">
            <span className={LABEL}>Overall Progress</span>
            <span className="font-mono text-sm font-medium">{percent(summary.progress)}%</span>
          </div>
          <div
            className="h-2.5 bg-[var(--color-muted)] overflow-hidden"
            role="progressbar"
            aria-label="Overall progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent(summary.progress)}
          >
            <div className="h-full transition-all duration-500" style={{ width: `${percent(summary.progress)}%`, backgroundColor: project.color }} />
          </div>
          <p className="text-xs text-[var(--color-muted-foreground)] mt-1">
            {summary.tasksDone} of {summary.tasksTotal} tasks complete · {gapLabel(summary.gap)}
          </p>
          {focusedThisWeek > 0 && (
            <p className="text-xs text-[var(--color-muted-foreground)] mt-1">{weekFocusLabel(focusedThisWeek)}</p>
          )}
        </div>
      </div>

      <RequirementsSection projectId={project.id} onRequestComplete={onRequestComplete} />
      <Habitat projectId={project.id} justHatched={justHatched} onOpenShop={onOpenShop} />
    </div>
  );
}

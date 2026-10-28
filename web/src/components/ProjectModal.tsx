import { useEffect, useState, type FormEvent } from "react";
import { petStage } from "../planner/lifecycle";
import { isDateKey } from "../planner/time";
import { projectDifficulty, projectType } from "../planner/projectKind";
import { DIFFICULTY_LEVELS, PROJECT_TYPES, type Difficulty, type PetKind, type Project, type ProjectType } from "../planner/types";
import { useStudiumContext } from "../store/useStudium";
import { DIFFICULTY_HINTS, DIFFICULTY_LABELS, PROJECT_TYPE_LABELS, eggCompanionLabel } from "../ui/format";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, CARD, INPUT, LABEL, PROJECT_COLORS, SERIF } from "../ui/styles";
import EggPicker from "./EggPicker";
import { useReturnFocus } from "./useReturnFocus";

type Props = {
  project?: Project; // set = edit mode
  onClose: () => void;
  onCreated?: (project: Project) => void;
  onDeleted?: () => void;
};

export default function ProjectModal({ project, onClose, onCreated, onDeleted }: Props) {
  const s = useStudiumContext();
  useReturnFocus();
  const [name, setName] = useState(project?.name ?? "");
  const [shortName, setShortName] = useState(project?.shortName ?? "");
  const [deadline, setDeadline] = useState(project?.deadline ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [color, setColor] = useState(project?.color ?? PROJECT_COLORS[0]);
  const [petKind, setPetKind] = useState<PetKind | null>(null);
  const [type, setType] = useState<ProjectType>(project ? projectType(project) : s.settings.projectType);
  const [difficulty, setDifficulty] = useState<Difficulty>(project ? projectDifficulty(project) : s.settings.difficulty);
  const [errors, setErrors] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const problems: string[] = [];
    if (!name.trim()) problems.push("Add a project name.");
    if (!isDateKey(deadline)) problems.push("Pick a deadline.");
    if (!project && !petKind) problems.push("Choose an egg.");
    setErrors(problems);
    if (problems.length > 0) return;

    const fields = {
      name: name.trim(),
      shortName: shortName.trim() || name.trim().split(/\s+/)[0],
      color,
      deadline,
      description: description.trim(),
    };
    if (project) {
      // Only what changed, so an old project with no type or difficulty stays that way.
      s.updateProject(project.id, {
        ...fields,
        ...(type !== projectType(project) ? { type } : {}),
        ...(difficulty !== projectDifficulty(project) ? { difficulty } : {}),
      });
    } else if (petKind) {
      const created = s.createProject({ ...fields, petKind, type, difficulty });
      onCreated?.(created);
    }
    onClose();
  }

  const title = project ? "Edit Project" : "New Project";

  function radioGroup<T extends string>(legend: string, values: readonly T[], labels: Record<T, string>, value: T, onPick: (v: T) => void) {
    return (
      <fieldset>
        <legend className={LABEL}>{legend}</legend>
        <div className="flex flex-wrap gap-2 mt-1" role="radiogroup" aria-label={legend}>
          {values.map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={value === v}
              onClick={() => onPick(v)}
              className={`px-3 py-1 text-sm border transition-colors ${
                value === v
                  ? "bg-[var(--color-inverse)] text-[var(--color-inverse-foreground)] border-[var(--color-inverse)]"
                  : "border-[var(--color-border)] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
              }`}
            >
              {labels[v]}
            </button>
          ))}
        </div>
      </fieldset>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-overlay)] overflow-y-auto py-8">
      <div role="dialog" aria-modal="true" aria-labelledby="project-modal-title" className={`${CARD} w-full max-w-lg mx-4 p-8`}>
        <div className="flex items-center justify-between mb-6">
          <h2 id="project-modal-title" style={SERIF} className="text-2xl">
            {title}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] text-xl leading-none">
            ×
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <label className={LABEL}>
            Project Name *
            <input aria-label="Project name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Senior Capstone Project" className={`${INPUT} mt-1 normal-case tracking-normal font-sans`} />
          </label>
          <label className={LABEL}>
            Short Label
            <input aria-label="Short label" value={shortName} onChange={(e) => setShortName(e.target.value)} placeholder="e.g. seniorCap" className={`${INPUT} mt-1 normal-case tracking-normal font-sans`} />
          </label>
          <label className={LABEL}>
            Deadline *
            <input aria-label="Deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={`${INPUT} mt-1`} />
          </label>
          <label className={LABEL}>
            Description
            <textarea aria-label="Description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="What is this project about?" className={`${INPUT} mt-1 resize-none normal-case tracking-normal font-sans`} />
          </label>
          <fieldset>
            <legend className={LABEL}>Color</legend>
            <div className="flex gap-2" role="radiogroup" aria-label="Color">
              {PROJECT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={color === c}
                  aria-label={`Color ${c}`}
                  onClick={() => setColor(c)}
                  className="w-7 h-7 rounded-sm"
                  style={{ backgroundColor: c, outline: color === c ? `2px solid ${c}` : "none", outlineOffset: "2px" }}
                />
              ))}
            </div>
          </fieldset>
          {radioGroup("Type", PROJECT_TYPES, PROJECT_TYPE_LABELS, type, setType)}
          {radioGroup("Difficulty", DIFFICULTY_LEVELS, DIFFICULTY_LABELS, difficulty, setDifficulty)}
          <p className="text-xs text-[var(--color-muted-foreground)] -mt-2">{DIFFICULTY_HINTS[difficulty]}</p>
          {project && petStage(project) === "egg" ? (
            <p className="text-sm text-[var(--color-muted-foreground)]">{eggCompanionLabel()}</p>
          ) : project ? (
            <p className="text-sm text-[var(--color-muted-foreground)]">
              Companion: {project.petKind} (it has hatched, so it can't be changed).
            </p>
          ) : (
            <fieldset>
              <legend className={LABEL}>Companion egg *</legend>
              <EggPicker value={petKind} onChange={setPetKind} />
            </fieldset>
          )}
          {errors.length > 0 && (
            <ul role="alert" className="text-sm text-[var(--color-accent)] space-y-0.5">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className={`flex-1 ${BUTTON_SECONDARY}`}>
              Cancel
            </button>
            <button type="submit" className={`flex-1 ${BUTTON_PRIMARY}`}>
              {project ? "Save project" : "Create project"}
            </button>
          </div>
        </form>
        {project && (
          <div className="mt-6 border-t border-[var(--color-border)] pt-4">
            {confirmDelete ? (
              <div className="space-y-2 text-sm">
                <p>Delete “{project.name}” and all its requirements and tasks? Your tokens and purchases stay.</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      s.deleteProject(project.id);
                      onDeleted?.();
                      onClose();
                    }}
                    className={BUTTON_PRIMARY}
                  >
                    Delete
                  </button>
                  <button type="button" onClick={() => setConfirmDelete(false)} className={BUTTON_SECONDARY}>
                    Keep
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)} className="text-sm text-[var(--color-accent)] hover:underline">
                Delete project
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

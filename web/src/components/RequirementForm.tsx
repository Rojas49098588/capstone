import { useState, type FormEvent } from "react";
import type { Requirement } from "../planner/types";
import { blockedByAllLabel, capitalize, wordsFor, type ProjectWords } from "../ui/format";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, INPUT, LABEL } from "../ui/styles";

export type RequirementFormValues = {
  title: string;
  weight: number;
  startDate: string | null;
  dueDate: string | null;
  blockedBy: string[];
  blockedByAll: boolean;
};

type Props = {
  initial?: Partial<RequirementFormValues>;
  submitLabel: string;
  onSubmit: (values: RequirementFormValues) => void;
  onCancel?: () => void;
  words?: ProjectWords; // the project's words (school by default)
  blockerChoices?: Requirement[]; // requirements this one may wait on (no loops)
  canWaitOnAll?: boolean; // may it wait on every other requirement?
};

export default function RequirementForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  words = wordsFor(undefined),
  blockerChoices = [],
  canWaitOnAll = false,
}: Props) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [weight, setWeight] = useState(String(initial?.weight ?? 5));
  const [startDate, setStartDate] = useState(initial?.startDate ?? "");
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? "");
  const [blockedBy, setBlockedBy] = useState<string[]>(initial?.blockedBy ?? []);
  const [blockedByAll, setBlockedByAll] = useState(initial?.blockedByAll ?? false);
  const [error, setError] = useState("");

  function toggleBlocker(id: string) {
    setBlockedBy((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError(`Give the ${words.requirement} a title.`);
      return;
    }
    onSubmit({
      title: title.trim(),
      weight: Number(weight),
      startDate: startDate || null,
      dueDate: dueDate || null,
      blockedBy: blockedByAll ? [] : blockedBy.filter((id) => blockerChoices.some((r) => r.id === id)),
      blockedByAll,
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className={LABEL}>
          {capitalize(words.requirement)}
          <input aria-label={`${capitalize(words.requirement)} title`} value={title} onChange={(e) => setTitle(e.target.value)} className={`${INPUT} mt-1 normal-case tracking-normal font-sans`} />
        </label>
        {error && <p className="text-xs text-[var(--color-accent)] mt-1">{error}</p>}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <label className={LABEL}>
          Weight
          <input
            aria-label="Weight (1–10)"
            type="number"
            min={1}
            max={10}
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className={`${INPUT} mt-1`}
          />
        </label>
        <label className={LABEL}>
          Start
          <input aria-label="Start date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={`${INPUT} mt-1`} />
        </label>
        <label className={LABEL}>
          Due
          <input aria-label="Due date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={`${INPUT} mt-1`} />
        </label>
      </div>
      <p className="text-xs text-[var(--color-muted-foreground)]">
        Weight decides what this requirement is worth compared with the others. Start and due dates set the plan; leave them
        empty to use today and the project deadline.
      </p>
      {(blockerChoices.length > 0 || canWaitOnAll || blockedByAll) && (
        <fieldset>
          <legend className={LABEL}>Blocked by</legend>
          <p className="text-xs text-[var(--color-muted-foreground)] mb-1">
            Its {words.tasks} can't be checked off until every {words.task} in these is done.
          </p>
          <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
            {(canWaitOnAll || blockedByAll) && (
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={blockedByAll} onChange={(e) => setBlockedByAll(e.target.checked)} />
                {blockedByAllLabel(words)}
              </label>
            )}
            {blockerChoices.map((r) => (
              <label key={r.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" disabled={blockedByAll} checked={!blockedByAll && blockedBy.includes(r.id)} onChange={() => toggleBlocker(r.id)} />
                {r.title}
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

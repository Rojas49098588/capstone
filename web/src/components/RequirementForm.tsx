import { useState, type FormEvent } from "react";
import { capitalize, wordsFor, type ProjectWords } from "../ui/format";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, INPUT, LABEL } from "../ui/styles";

export type RequirementFormValues = { title: string; weight: number; startDate: string | null; dueDate: string | null };

type Props = {
  initial?: Partial<RequirementFormValues>;
  submitLabel: string;
  onSubmit: (values: RequirementFormValues) => void;
  onCancel?: () => void;
  words?: ProjectWords; // the project's words (school by default)
};

export default function RequirementForm({ initial, submitLabel, onSubmit, onCancel, words = wordsFor(undefined) }: Props) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [weight, setWeight] = useState(String(initial?.weight ?? 5));
  const [startDate, setStartDate] = useState(initial?.startDate ?? "");
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? "");
  const [error, setError] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError(`Give the ${words.requirement} a title.`);
      return;
    }
    onSubmit({ title: title.trim(), weight: Number(weight), startDate: startDate || null, dueDate: dueDate || null });
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

import { ESTIMATE_CHOICES, formatMinutes } from "../ui/format";
import { LABEL } from "../ui/styles";

type Props = { label: string; value: number; onChange: (minutes: number) => void };

/** Quick time choices (15 min to 8 h) plus a box for any number of minutes. */
export default function EstimatePicker({ label, value, onChange }: Props) {
  const isPreset = ESTIMATE_CHOICES.includes(value);
  return (
    <fieldset>
      <legend className={LABEL}>{label}</legend>
      <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label={label}>
        {ESTIMATE_CHOICES.map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={value === m}
            onClick={() => onChange(m)}
            className={`px-2.5 py-1 text-xs border transition-colors ${
              value === m
                ? "bg-[var(--color-inverse)] text-[var(--color-inverse-foreground)] border-[var(--color-inverse)]"
                : "border-[var(--color-border)] hover:border-[var(--color-foreground)]"
            }`}
          >
            {formatMinutes(m)}
          </button>
        ))}
        <label className="flex items-center gap-1 text-xs text-[var(--color-muted-foreground)]">
          <input
            type="number"
            min={1}
            aria-label={`${label} in minutes`}
            placeholder="other"
            value={isPreset ? "" : value}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n) && n > 0) onChange(Math.round(n));
            }}
            className="w-16 border border-[var(--color-border)] px-2 py-1 text-xs focus:outline-none focus:border-[var(--color-foreground)]"
          />
          min
        </label>
      </div>
    </fieldset>
  );
}

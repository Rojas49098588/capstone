import { useEffect, useRef, useState } from "react";
import { ESTIMATE_CHOICES, formatMinutes } from "../ui/format";
import { LABEL } from "../ui/styles";

type Props = { label: string; value: number; onChange: (minutes: number) => void };

const boxText = (value: number) => (ESTIMATE_CHOICES.includes(value) ? "" : String(value));

/** Quick time choices (15 min to 8 h) plus a box for any number of minutes. */
export default function EstimatePicker({ label, value, onChange }: Props) {
  // The box keeps its own text so typing "300" isn't cut short when "30" matches a quick choice,
  // and so it can be emptied while editing.
  const [text, setText] = useState(() => boxText(value));
  const typed = useRef<number | null>(null);

  useEffect(() => {
    if (value !== typed.current) setText(boxText(value));
  }, [value]);

  const custom = text !== "";
  return (
    <fieldset>
      <legend className={LABEL}>{label}</legend>
      <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label={label}>
        {ESTIMATE_CHOICES.map((m) => {
          const checked = !custom && value === m;
          return (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={checked}
              onClick={() => {
                typed.current = null;
                setText("");
                onChange(m);
              }}
              className={`px-2.5 py-1 text-xs border transition-colors ${
                checked
                  ? "bg-[var(--color-inverse)] text-[var(--color-inverse-foreground)] border-[var(--color-inverse)]"
                  : "border-[var(--color-border)] hover:border-[var(--color-foreground)]"
              }`}
            >
              {formatMinutes(m)}
            </button>
          );
        })}
        <label className="flex items-center gap-1 text-xs text-[var(--color-muted-foreground)]">
          <input
            type="number"
            min={1}
            aria-label={`${label} in minutes`}
            placeholder="other"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              const n = Math.round(Number(e.target.value));
              if (e.target.value !== "" && Number.isFinite(n) && n > 0) {
                typed.current = n;
                onChange(n);
              }
            }}
            className="w-16 border border-[var(--color-border)] px-2 py-1 text-xs focus:outline-none focus:border-[var(--color-foreground)]"
          />
          min
        </label>
      </div>
    </fieldset>
  );
}

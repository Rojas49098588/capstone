import { useRef, useState, type KeyboardEvent } from "react";
import type { PetKind } from "../planner/types";
import { shuffledEggs, type EggLook } from "../pets/eggs";
import EggArt from "./EggArt";

type Props = { value: PetKind | null; onChange: (kind: PetKind) => void; eggs?: EggLook[] };

/** Five mystery eggs. Highlighting one shows a vague hint about what's inside. */
export default function EggPicker({ value, onChange, eggs: given }: Props) {
  const [eggs] = useState(() => given ?? shuffledEggs());
  const [highlighted, setHighlighted] = useState<PetKind | null>(null);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const shown = eggs.find((e) => e.kind === (highlighted ?? value));

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (step === 0) return;
    e.preventDefault();
    const next = (index + step + eggs.length) % eggs.length;
    onChange(eggs[next].kind);
    buttons.current[next]?.focus();
  }

  return (
    <div>
      <div role="radiogroup" aria-label="Choose an egg" className="flex flex-wrap gap-2">
        {eggs.map((egg, i) => {
          const selected = value === egg.kind;
          return (
            <button
              key={egg.kind}
              ref={(el) => {
                buttons.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`Egg ${i + 1}`}
              tabIndex={selected || (value === null && i === 0) ? 0 : -1}
              onClick={() => onChange(egg.kind)}
              onKeyDown={(e) => onKeyDown(e, i)}
              onFocus={() => setHighlighted(egg.kind)}
              onBlur={() => setHighlighted(null)}
              onMouseEnter={() => setHighlighted(egg.kind)}
              onMouseLeave={() => setHighlighted(null)}
              className={`p-2 border-2 transition-colors text-[var(--color-foreground)] ${
                selected ? "border-[var(--color-accent)]" : "border-transparent hover:border-[var(--color-border)]"
              }`}
            >
              <EggArt egg={egg} />
            </button>
          );
        })}
      </div>
      <p aria-live="polite" className="text-sm italic text-[var(--color-muted-foreground)] mt-2 min-h-[1.25rem]">
        {shown ? shown.description : "Pick an egg. Each one holds a different companion."}
      </p>
    </div>
  );
}

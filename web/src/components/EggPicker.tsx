import { useId, useRef, useState, type KeyboardEvent, type ReactElement } from "react";
import type { PetKind } from "../planner/types";
import { shuffledEggs, type EggLook, type EggPattern } from "../pets/eggs";

const EGG_PATH = "M30 3C15 3 4 27 4 45c0 16 12 28 26 28s26-12 26-28C56 27 45 3 30 3Z";

const PATTERNS: Record<EggPattern, ReactElement> = {
  dots: (
    <>
      {[[18, 24], [38, 20], [28, 40], [14, 52], [42, 50], [30, 62]].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="3" />
      ))}
    </>
  ),
  stripes: (
    <>
      {[30, 44, 58].map((y) => (
        <rect key={y} x="0" y={y} width="60" height="5" />
      ))}
    </>
  ),
  zigzag: <path d="M0 42l8-8 8 8 8-8 8 8 8-8 8 8 8-8" fill="none" strokeWidth="4" />,
  spots: (
    <>
      {[[20, 30, 6], [40, 44, 8], [24, 58, 5]].map(([x, y, r]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={r} />
      ))}
    </>
  ),
  stars: (
    <>
      {[[20, 28], [40, 40], [26, 56]].map(([x, y]) => (
        <path key={`${x}-${y}`} d={`M${x} ${y - 5}l1.5 3.5 3.5 1.5-3.5 1.5-1.5 3.5-1.5-3.5-3.5-1.5 3.5-1.5z`} />
      ))}
    </>
  ),
};

function EggSvg({ egg }: { egg: EggLook }) {
  const clipId = useId();
  return (
    <svg viewBox="0 0 60 76" className="w-12 h-16" aria-hidden="true">
      <defs>
        <clipPath id={clipId}>
          <path d={EGG_PATH} />
        </clipPath>
      </defs>
      <path d={EGG_PATH} fill={egg.shell} />
      <g clipPath={`url(#${clipId})`} fill={egg.speckle} stroke={egg.speckle}>
        {PATTERNS[egg.pattern]}
      </g>
      <path d={EGG_PATH} fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.5" />
    </svg>
  );
}

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
              <EggSvg egg={egg} />
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

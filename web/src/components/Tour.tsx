import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { TourStep } from "../ui/tourSteps";
import { BUTTON_PRIMARY, BUTTON_SMALL, CARD, LABEL, SERIF } from "../ui/styles";

type Props = {
  step: TourStep;
  index: number;
  count: number;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
};

type Box = { top: number; left: number; width: number; height: number };

const PAD = 6; // room around the highlighted element
const GAP = 12; // between the highlight and the card
const CARD_W = 360;
const MARGIN = 16;

function sameBox(a: Box | null, b: Box | null) {
  return a === b || (!!a && !!b && a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height);
}

/** Where the card goes: below the highlight if it fits, else above it; in the middle without one. */
export function cardPosition(box: Box | null, cardH: number, viewport: { width: number; height: number }) {
  const width = Math.min(CARD_W, viewport.width - 2 * MARGIN);
  if (!box) return { width, left: (viewport.width - width) / 2, top: Math.max(MARGIN, (viewport.height - cardH) / 2) };
  const left = Math.min(Math.max(MARGIN, box.left + box.width / 2 - width / 2), viewport.width - width - MARGIN);
  const below = box.top + box.height + GAP;
  const above = box.top - GAP - cardH;
  const top = below + cardH <= viewport.height - MARGIN || above < MARGIN ? Math.min(below, viewport.height - cardH - MARGIN) : above;
  return { width, left, top: Math.max(MARGIN, top) };
}

/** One step of the tutorial: the target is lit up, the rest dimmed, with a card explaining it. */
export default function Tour({ step, index, count, onNext, onBack, onSkip }: Props) {
  const [box, setBox] = useState<Box | null>(null);
  const [cardH, setCardH] = useState(180);
  const cardRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const last = index === count - 1;

  // Bring the target into view, then follow it (pages scroll, sections grow, the window resizes).
  useEffect(() => {
    const find = () => (step.target ? document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`) : null);
    find()?.scrollIntoView?.({ block: "center", behavior: "smooth" });
    let frame = 0;
    let current: Box | null = null;
    const measure = () => {
      const r = find()?.getBoundingClientRect();
      const next = r && r.width > 0 ? { top: r.top - PAD, left: r.left - PAD, width: r.width + 2 * PAD, height: r.height + 2 * PAD } : null;
      if (!sameBox(current, next)) {
        current = next;
        setBox(next);
      }
      frame = requestAnimationFrame(measure);
    };
    measure();
    return () => cancelAnimationFrame(frame);
  }, [step]);

  useLayoutEffect(() => {
    if (cardRef.current) setCardH(cardRef.current.offsetHeight || 180);
  }, [step, box]);

  useEffect(() => nextRef.current?.focus(), [step]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onSkip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSkip]);

  const pos = cardPosition(box, cardH, { width: window.innerWidth, height: window.innerHeight });

  return (
    <div className="fixed inset-0 z-50">
      {/* Clicks outside the card do nothing while the tour is open. */}
      <div className={`absolute inset-0 ${box ? "" : "bg-black/55"}`} />
      {box && (
        <div
          aria-hidden="true"
          className="absolute pointer-events-none border-2 border-[var(--color-accent)] transition-all duration-300"
          style={{ ...box, boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.55)" }}
        />
      )}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-text"
        className={`${CARD} absolute p-5 shadow-lg space-y-3`}
        style={{ top: pos.top, left: pos.left, width: pos.width }}
      >
        <p className={LABEL}>{`Tutorial · ${index + 1} of ${count}`}</p>
        <h2 id="tour-title" style={SERIF} className="text-xl">
          {step.title}
        </h2>
        <p id="tour-text" className="text-sm text-[var(--color-muted-foreground)]">
          {step.text}
        </p>
        <div className="flex items-center justify-between gap-2 pt-1">
          <button type="button" onClick={onSkip} className="text-xs underline text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]">
            Skip tour
          </button>
          <div className="flex gap-2">
            {index > 0 && (
              <button type="button" onClick={onBack} className={BUTTON_SMALL}>
                Back
              </button>
            )}
            <button ref={nextRef} type="button" onClick={onNext} className={BUTTON_PRIMARY}>
              {last ? "Finish" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { waitingLabel } from "../ui/format";

const TEXT = "text-xs text-[var(--color-accent)]";

/**
 * What a task or requirement is waiting on: the name for one, "Waiting on 3" for more, whose list
 * opens on hover, focus or a tap and closes on leaving, Escape, a second tap or a tap elsewhere.
 */
export default function WaitingOn({ names }: { names: string[] }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement>(null);
  // Mouse: hover shows the list. Touch: a tap toggles it. Keyboard: focus shows it.
  const pointer = useRef<{ type: string; down: boolean }>({ type: "", down: false });

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  if (names.length === 0) return null;
  if (names.length === 1) return <p className={TEXT}>{waitingLabel(names)}</p>;
  const mouse = (e: { pointerType: string }) => e.pointerType === "mouse";
  return (
    <span
      ref={box}
      className="relative inline-block"
      onPointerEnter={(e) => mouse(e) && setOpen(true)}
      onPointerLeave={(e) => mouse(e) && setOpen(false)}
    >
      <button
        type="button"
        aria-expanded={open}
        onPointerDown={(e) => (pointer.current = { type: e.pointerType, down: true })}
        onClick={() => {
          const wasMouse = pointer.current.type === "mouse" && pointer.current.down;
          pointer.current = { type: "", down: false };
          if (wasMouse) setOpen(true);
          else setOpen((o) => !o);
        }}
        onFocus={() => !pointer.current.down && setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        className={`${TEXT} underline decoration-dotted underline-offset-2`}
      >
        {waitingLabel(names)}
      </button>
      {open && (
        <ul className="absolute left-0 top-full z-20 mt-1 min-w-48 border border-[var(--color-border)] bg-[var(--color-card)] p-2 text-xs text-[var(--color-foreground)] shadow-md space-y-0.5">
          {names.map((n, i) => (
            <li key={`${i}-${n}`}>{n}</li>
          ))}
        </ul>
      )}
    </span>
  );
}

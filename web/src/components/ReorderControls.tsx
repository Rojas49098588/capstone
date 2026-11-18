import { useLayoutEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { dropIndex, reorderRows } from "../ui/reorder";

type Props = {
  title: string; // the task's title, for the button labels
  index: number; // its place among the list's unfinished tasks
  count: number; // how many unfinished tasks the list has
  onMove: (toIndex: number) => void;
  tone?: "light" | "dark"; // dark = on the Overview's dark panel
};

const DROP_LINE = "inset 0 2px 0 0 currentColor";
const DROP_LINE_BELOW = "inset 0 -2px 0 0 currentColor";

/**
 * The grip (drag) and Move up / Move down buttons on an unfinished task. The row around it is marked
 * data-reorder-row and the list data-reorder-list. After a move, focus stays on this task's buttons.
 */
export default function ReorderControls({ title, index, count, onMove, tone = "light" }: Props) {
  const upRef = useRef<HTMLButtonElement>(null);
  const downRef = useRef<HTMLButtonElement>(null);
  const refocus = useRef<"up" | "down" | null>(null);

  useLayoutEffect(() => {
    const wanted = refocus.current;
    if (!wanted) return;
    refocus.current = null;
    const first = wanted === "up" ? upRef.current : downRef.current;
    const other = wanted === "up" ? downRef.current : upRef.current;
    (first && !first.disabled ? first : other)?.focus();
  }, [index]);

  function move(direction: "up" | "down") {
    refocus.current = direction;
    onMove(index + (direction === "up" ? -1 : 1));
  }

  function startDrag(e: ReactPointerEvent<HTMLSpanElement>) {
    if (e.button !== 0) return;
    e.preventDefault();
    const grip = e.currentTarget;
    const rows = reorderRows(grip);
    const self = grip.closest<HTMLElement>("[data-reorder-row]");
    const from = self ? rows.indexOf(self) : -1;
    if (from < 0) return;
    let target = from;
    let marked: HTMLElement | null = null;
    const mark = (row: HTMLElement | null, below = false) => {
      if (marked) marked.style.boxShadow = "";
      marked = row;
      if (row) row.style.boxShadow = below ? DROP_LINE_BELOW : DROP_LINE;
    };
    const place = (y: number) => {
      const mids = rows.map((r) => {
        const box = r.getBoundingClientRect();
        return box.top + box.height / 2;
      });
      target = dropIndex(y, mids, from);
      // The line goes above the row the task would land before.
      const others = rows.filter((_, i) => i !== from);
      if (target === from) mark(null);
      else if (target < others.length) mark(others[target]);
      else mark(others[others.length - 1] ?? null, true); // to the end: the line goes under the last row
    };
    const stop = () => {
      window.removeEventListener("pointermove", onMoveEvent, true);
      window.removeEventListener("pointerup", onUp, true);
      window.removeEventListener("pointercancel", cancel, true);
      window.removeEventListener("keydown", onKey, true);
      mark(null);
      document.body.style.cursor = "";
    };
    const onMoveEvent = (ev: PointerEvent | MouseEvent) => place(ev.clientY);
    const onUp = (ev: PointerEvent | MouseEvent) => {
      place(ev.clientY);
      stop();
      if (target !== from) onMove(index + (target - from));
    };
    const cancel = () => stop();
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") stop();
    };
    window.addEventListener("pointermove", onMoveEvent, true);
    window.addEventListener("pointerup", onUp, true);
    window.addEventListener("pointercancel", cancel, true);
    window.addEventListener("keydown", onKey, true);
    document.body.style.cursor = "grabbing";
  }

  const muted = tone === "dark" ? "text-white/40 hover:text-white" : "text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]";
  const arrow = `px-0.5 leading-none text-xs disabled:opacity-20 disabled:cursor-default ${muted}`;
  return (
    <div className="flex items-center gap-0.5 flex-shrink-0 opacity-50 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
      <span
        data-grip
        aria-hidden="true"
        title="Drag to reorder"
        onPointerDown={startDrag}
        onMouseDown={(e) => e.preventDefault() /* no text selection while dragging */}
        className={`cursor-grab select-none touch-none text-sm leading-none px-0.5 ${muted}`}
      >
        ⋮⋮
      </span>
      <button ref={upRef} type="button" aria-label={`Move ${title} up`} disabled={index <= 0} onClick={() => move("up")} className={arrow}>
        ↑
      </button>
      <button ref={downRef} type="button" aria-label={`Move ${title} down`} disabled={index >= count - 1} onClick={() => move("down")} className={arrow}>
        ↓
      </button>
    </div>
  );
}

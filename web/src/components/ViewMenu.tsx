import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { FILTER_LABELS, REQUIREMENT_FILTERS, SHOW_ALL_LABEL, filtersLabel, type RequirementFilter } from "../planner/requirementView";
import { BUTTON_SMALL } from "../ui/styles";

type Props = {
  filters: RequirementFilter[];
  onFilters: (filters: RequirementFilter[]) => void;
  allCollapsed: boolean; // every shown requirement is collapsed: offer Expand all
  onCollapseAll: (collapse: boolean) => void;
};

/**
 * The ≡ menu on a project's requirements: Collapse all / Expand all, Show all, then filters that stack
 * (owner's call, 2026-11-18). Ticking a filter keeps the menu open so another can be added.
 */
export default function ViewMenu({ filters, onFilters, allCollapsed, onCollapseAll }: Props) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const items = () => [...(menuRef.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? [])];

  useEffect(() => {
    if (!open) return;
    items()[0]?.focus();
    const outside = (e: PointerEvent | MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  function close() {
    setOpen(false);
    buttonRef.current?.focus();
  }

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    const list = items();
    const at = list.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Escape" || e.key === "Tab") {
      if (e.key === "Escape") e.preventDefault();
      close();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      list[(at + step + list.length) % list.length]?.focus();
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      (e.key === "Home" ? list[0] : list[list.length - 1])?.focus();
    }
  }

  const label = filtersLabel(filters);
  const all = filters.length === 0;
  const item = "block w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--color-muted)] focus:bg-[var(--color-muted)] focus:outline-none";
  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label={all ? "Requirements view" : `Requirements view: ${label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Collapse and view options"
        onClick={() => setOpen((o) => !o)}
        className={BUTTON_SMALL}
      >
        {all ? "≡" : `≡ ${label}`}
      </button>
      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Requirements view"
          onKeyDown={onKey}
          className="absolute right-0 z-20 mt-1 min-w-48 border border-[var(--color-border)] bg-[var(--color-card)] shadow-lg py-1"
        >
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            onClick={() => {
              onCollapseAll(!allCollapsed);
              close();
            }}
            className={item}
          >
            {allCollapsed ? "Expand all" : "Collapse all"}
          </button>
          <div role="separator" className="my-1 border-t border-[var(--color-border)]" />
          <button
            type="button"
            role="menuitemradio"
            aria-checked={all}
            tabIndex={-1}
            onClick={() => {
              onFilters([]);
              close();
            }}
            className={item}
          >
            <span aria-hidden="true" className="inline-block w-4">
              {all ? "•" : ""}
            </span>
            {SHOW_ALL_LABEL}
          </button>
          {REQUIREMENT_FILTERS.map((f) => {
            const checked = filters.includes(f);
            return (
              <button
                key={f}
                type="button"
                role="menuitemcheckbox"
                aria-checked={checked}
                tabIndex={-1}
                onClick={() => onFilters(checked ? filters.filter((x) => x !== f) : [...filters, f])}
                className={item}
              >
                <span aria-hidden="true" className="inline-block w-4">
                  {checked ? "✓" : ""}
                </span>
                {FILTER_LABELS[f]}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

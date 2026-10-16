// Shared class strings so every screen keeps Studium's look.
export const CARD = "bg-[var(--color-card)] border border-[var(--color-border)]";
export const LABEL = "block text-xs font-mono uppercase tracking-widest text-[var(--color-muted-foreground)] mb-1";
export const INPUT =
  "w-full border border-[var(--color-border)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-foreground)]";
export const BUTTON_PRIMARY =
  "px-4 py-2 text-sm bg-[var(--color-primary)] text-[var(--color-primary-foreground)] hover:bg-[var(--color-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors";
export const BUTTON_SECONDARY =
  "px-4 py-2 text-sm border border-[var(--color-border)] hover:border-[var(--color-foreground)] transition-colors";
export const BUTTON_SMALL =
  "px-2 py-1 text-xs border border-[var(--color-border)] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:border-[var(--color-foreground)] transition-colors";
export const MUTED = "text-[var(--color-muted-foreground)]";
export const SERIF = { fontFamily: "var(--font-serif)" } as const;
export const PROJECT_COLORS = ["#2d3a8c", "#c9501a", "#3a7c4f", "#7b4fa6", "#8a6a00", "#1a6e7e"];

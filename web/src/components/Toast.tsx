import { useEffect } from "react";

export const TOAST_MS = 6000;

type Props = { message: string | null; onDismiss: () => void; timeoutMs?: number };

export default function Toast({ message, onDismiss, timeoutMs = TOAST_MS }: Props) {
  useEffect(() => {
    if (!message) return;
    const id = setTimeout(onDismiss, timeoutMs);
    return () => clearTimeout(id);
  }, [message, onDismiss, timeoutMs]);

  return (
    <div role="status" aria-live="polite" className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 w-full max-w-md">
      {message && (
        <div className="flex items-start gap-3 bg-[var(--color-inverse)] text-[var(--color-inverse-foreground)] px-4 py-3 shadow-lg">
          <span className="flex-1 text-sm">{message}</span>
          <button type="button" aria-label="Dismiss" onClick={onDismiss} className="text-white/60 hover:text-white">
            ×
          </button>
        </div>
      )}
    </div>
  );
}

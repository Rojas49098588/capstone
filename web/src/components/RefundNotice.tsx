// Clothes and the Puzzle Cube left the Shop (shop, toys and window spec). What was paid for them already
// counts as given back (planner/history.ts retiredRefund); this says so once on each device.
import { useState } from "react";

export const REFUND_NOTICE_KEY = "studium.refundNoticeSeen";

function seen(storage: Storage | null): boolean {
  try {
    return storage?.getItem(REFUND_NOTICE_KEY) === "1";
  } catch {
    return false;
  }
}

export default function RefundNotice({ tokens, storage }: { tokens: number; storage: Storage | null }) {
  const [hidden, setHidden] = useState(() => seen(storage));
  if (tokens <= 0 || hidden) return null;

  function dismiss() {
    try {
      storage?.setItem(REFUND_NOTICE_KEY, "1");
    } catch {
      // Can't remember it: it shows again next time, which is harmless.
    }
    setHidden(true);
  }

  return (
    <div role="status" className="bg-[var(--color-muted)] text-[var(--color-foreground)]">
      <div className="max-w-6xl mx-auto px-6 py-2 flex items-start gap-3 text-sm">
        <span className="flex-1">{`Clothes are gone for now, so you got ${tokens} tokens back.`}</span>
        <button type="button" onClick={dismiss} aria-label="Dismiss" className="opacity-80 hover:opacity-100">
          ×
        </button>
      </div>
    </div>
  );
}

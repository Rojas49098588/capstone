import { useEffect, useState } from "react";
import { useStudiumContext } from "../store/useStudium";
import { formatMinutes, payoutMessage } from "../ui/format";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, CARD, SERIF } from "../ui/styles";
import EstimatePicker from "./EstimatePicker";

type Props = { taskId: string; onClose: () => void; onDone: (message: string) => void };

/** Asks roughly how long a task took, then completes it and reports the tokens. */
export default function CompletionPrompt({ taskId, onClose, onDone }: Props) {
  const s = useStudiumContext();
  const task = s.data.tasks.find((t) => t.id === taskId);
  const [minutes, setMinutes] = useState(task?.estimateMin ?? 60);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!task) return null;

  function finish(actualMin: number | null) {
    if (!task) return;
    const payout = s.completeTask(task.id, actualMin);
    onDone(payout ? payoutMessage(payout, task) : "That task can't be completed yet.");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-overlay)]">
      <div role="dialog" aria-modal="true" aria-labelledby="complete-title" className={`${CARD} w-full max-w-md mx-4 p-6 space-y-4`}>
        <h2 id="complete-title" style={SERIF} className="text-xl">
          About how long did "{task.title}" take?
        </h2>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          You estimated {formatMinutes(task.estimateMin)}. A rough answer is fine; it helps Studium learn your pace.
        </p>
        <EstimatePicker label="Time taken" value={minutes} onChange={setMinutes} />
        <div className="flex flex-wrap gap-2 pt-2">
          {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
          <button type="button" autoFocus onClick={() => finish(minutes)} className={BUTTON_PRIMARY}>
            Save and complete
          </button>
          <button type="button" onClick={() => finish(null)} className={BUTTON_SECONDARY}>
            Skip
          </button>
          <button type="button" onClick={onClose} className={BUTTON_SECONDARY}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

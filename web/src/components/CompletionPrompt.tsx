import { useEffect, useState } from "react";
import { taskFocusMinutes } from "../planner/focus";
import { useStudiumContext } from "../store/useStudium";
import { formatMinutes, payoutMessage } from "../ui/format";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, CARD, SERIF } from "../ui/styles";
import EstimatePicker from "./EstimatePicker";
import { useReturnFocus } from "./useReturnFocus";

type Props = { taskId: string; onClose: () => void; onDone: (message: string) => void };

/** Asks roughly how long a task took, then completes it and reports the tokens. */
export default function CompletionPrompt({ taskId, onClose, onDone }: Props) {
  const s = useStudiumContext();
  useReturnFocus();
  const task = s.data.tasks.find((t) => t.id === taskId);
  // Focus time from naps with the pet pre-fills the answer. A nap can arrive after the prompt opens
  // (Done from a pet opens a new Studium tab), so follow it until the user picks a time.
  const focused = task ? taskFocusMinutes(task, s.data.events) : 0;
  const prefill = focused > 0 ? focused : (task?.estimateMin ?? 60);
  const [minutes, setMinutes] = useState(prefill);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!touched) setMinutes(prefill);
  }, [prefill, touched]);

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
          You estimated {formatMinutes(task.estimateMin)}
          {focused > 0 ? ` and focused ${formatMinutes(focused)} on it with your pet` : ""}. A rough answer is fine; it helps
          Studium learn your pace.
        </p>
        <EstimatePicker
          label="Time taken"
          value={minutes}
          onChange={(m) => {
            setTouched(true);
            setMinutes(m);
          }}
        />
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

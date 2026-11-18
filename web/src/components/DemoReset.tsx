// Settings → Demo, only in the demo copy (demo stand spec): puts the demo save back, after asking in a
// pop-up that also takes the next tester's nickname ("Mustang" unless they type their own).
import { useEffect, useState } from "react";
import { DEMO_NICKNAME, resetDemo } from "../store/demo";
import { useStudiumContext } from "../store/useStudium";
import { NICKNAME_MAX } from "../planner/tuning";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, CARD, INPUT, LABEL, MUTED, SERIF } from "../ui/styles";
import { useReturnFocus } from "./useReturnFocus";

export const RESET_DEMO_CONFIRM = "This replaces everything in this demo copy with fresh demo data.";
export const RESET_DEMO_REFUSED =
  "This folder holds data the demo didn't make, so Reset won't replace it. Check the shortcut's --user-data folder.";

export default function DemoReset() {
  const { storage } = useStudiumContext();
  const [asking, setAsking] = useState(false);
  const [refused, setRefused] = useState(false);
  if (!storage) return null; // nothing saved here to replace

  const reset = (nickname: string) => {
    const done = resetDemo({ storage, now: new Date(), nickname, reloadPets: window.studiumDesktop?.reloadPets, reload: () => window.location.reload() });
    if (!done) {
      setRefused(true);
      setAsking(false);
    }
  };

  return (
    <div>
      <button type="button" onClick={() => setAsking(true)} className={BUTTON_SECONDARY}>
        Reset demo
      </button>
      <p className={`text-xs mt-2 ${MUTED}`}>Starts the demo over: the five classes, their pets and today's plan, dated from today.</p>
      {refused && (
        <p role="alert" className="text-sm mt-2 text-[var(--color-accent)]">
          {RESET_DEMO_REFUSED}
        </p>
      )}
      {asking && <ResetDialog onReset={reset} onClose={() => setAsking(false)} />}
    </div>
  );
}

function ResetDialog({ onReset, onClose }: { onReset: (nickname: string) => void; onClose: () => void }) {
  useReturnFocus();
  const [nickname, setNickname] = useState(DEMO_NICKNAME);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-overlay)]">
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="reset-demo-title"
        className={`${CARD} w-full max-w-md mx-4 p-6 space-y-4`}
        onSubmit={(e) => {
          e.preventDefault();
          onReset(nickname);
        }}
      >
        <h2 id="reset-demo-title" style={SERIF} className="text-xl">
          Reset demo
        </h2>
        <p className="text-sm">{RESET_DEMO_CONFIRM}</p>
        <div>
          <label htmlFor="reset-demo-nickname" className={LABEL}>
            Nickname
          </label>
          {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
          <input
            id="reset-demo-nickname"
            autoFocus
            value={nickname}
            maxLength={NICKNAME_MAX}
            onChange={(e) => setNickname(e.target.value)}
            onFocus={(e) => e.target.select()}
            className={INPUT}
          />
          <p className={`text-xs mt-2 ${MUTED}`}>What the pets call the next tester. Left blank, it's {DEMO_NICKNAME}.</p>
        </div>
        <div className="flex gap-2 pt-2">
          <button type="submit" className={BUTTON_PRIMARY}>
            Reset
          </button>
          <button type="button" onClick={onClose} className={BUTTON_SECONDARY}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

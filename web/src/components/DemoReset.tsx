// Settings → Demo, only in the demo copy (demo stand spec): puts the demo save back, after asking.
import { useState } from "react";
import { resetDemo } from "../store/demo";
import { useStudiumContext } from "../store/useStudium";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, MUTED } from "../ui/styles";

export const RESET_DEMO_CONFIRM = "This replaces everything in this demo copy with fresh demo data.";

export default function DemoReset() {
  const { storage } = useStudiumContext();
  const [asking, setAsking] = useState(false);
  if (!storage) return null; // nothing saved here to replace

  const reset = () =>
    resetDemo({ storage, now: new Date(), reloadPets: window.studiumDesktop?.reloadPets, reload: () => window.location.reload() });

  if (!asking) {
    return (
      <div>
        <button type="button" onClick={() => setAsking(true)} className={BUTTON_SECONDARY}>
          Reset demo
        </button>
        <p className={`text-xs mt-2 ${MUTED}`}>Starts the demo over: the five classes, their pets and today's plan, dated from today.</p>
      </div>
    );
  }
  return (
    <div role="group" aria-label="Reset demo" className="space-y-2">
      <p className="text-sm">{RESET_DEMO_CONFIRM}</p>
      <div className="flex gap-2">
        <button type="button" onClick={reset} className={BUTTON_PRIMARY}>
          Reset
        </button>
        <button type="button" onClick={() => setAsking(false)} className={BUTTON_SECONDARY} autoFocus>
          Cancel
        </button>
      </div>
    </div>
  );
}

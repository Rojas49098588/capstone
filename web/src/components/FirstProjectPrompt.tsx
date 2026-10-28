import { FIRST_PROJECT_TEXT, FIRST_PROJECT_TITLE } from "../ui/format";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, CARD, SERIF } from "../ui/styles";
import { useReturnFocus } from "./useReturnFocus";

type Props = { onCreate: () => void; onClose: () => void };

/** Shown on the Overview while there are no projects: start the first one. */
export default function FirstProjectPrompt({ onCreate, onClose }: Props) {
  useReturnFocus();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-overlay)]">
      <div role="dialog" aria-modal="true" aria-labelledby="first-project-title" className={`${CARD} w-full max-w-md mx-4 p-6 space-y-4`}>
        <h2 id="first-project-title" style={SERIF} className="text-xl">
          {FIRST_PROJECT_TITLE}
        </h2>
        <p className="text-sm text-[var(--color-muted-foreground)]">{FIRST_PROJECT_TEXT}</p>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={BUTTON_SECONDARY}>
            Not now
          </button>
          <button type="button" onClick={onCreate} className={BUTTON_PRIMARY} autoFocus>
            Create my first project
          </button>
        </div>
      </div>
    </div>
  );
}

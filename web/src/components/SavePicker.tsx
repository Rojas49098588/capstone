import { useState } from "react";
import { hasMoreProgress, type SaveSummary } from "../sync/saveSummary";
import {
  PET_STAGE_NAMES,
  PICKER_ACCOUNT_TAG,
  PICKER_EGG,
  PICKER_FOOTER,
  PICKER_KEEP_ACCOUNT,
  PICKER_KEEP_LOCAL,
  PICKER_LEAD,
  PICKER_LOCAL_TAG,
  PICKER_MORE_PROGRESS,
  PICKER_NOT_NOW,
  PICKER_TITLE,
  PICKER_UNKNOWN_ACCOUNT,
  PICKER_UNKNOWN_LOCAL,
  savedAtLabel,
} from "../ui/format";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, CARD, LABEL, MUTED, SERIF } from "../ui/styles";
import { useReturnFocus } from "./useReturnFocus";

type Summary = SaveSummary & { more: number };
type Props = {
  local: Summary;
  account: Summary;
  /** Set once a choice failed: the message shows, and the only way on is Close. */
  error: string | null;
  now: Date;
  onChoose: (keep: "local" | "account") => Promise<void>;
  /** "Not now": sign out instead of choosing. Works even while a choice is still going. */
  onNotNow: () => Promise<void>;
  onClose: () => void;
};

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** "You have two saves": this computer's and the account's, side by side; the person keeps one. */
export default function SavePicker({ local, account, error, now, onChoose, onNotNow, onClose }: Props) {
  useReturnFocus();
  const [busy, setBusy] = useState(false);

  async function choose(keep: "local" | "account") {
    setBusy(true);
    await onChoose(keep);
    setBusy(false);
  }

  function card(which: "local" | "account", s: Summary, more: boolean) {
    const tag = which === "local" ? PICKER_LOCAL_TAG : PICKER_ACCOUNT_TAG;
    const device = s.savedBy ?? (which === "local" ? PICKER_UNKNOWN_LOCAL : PICKER_UNKNOWN_ACCOUNT);
    const stats: [number, string][] = [
      [s.projects, plural(s.projects, "project", "projects")],
      [s.tokens, "tokens"],
      [s.tasksDone, "tasks done"],
      [s.petsGrownUp, plural(s.petsGrownUp, "pet grown up", "pets grown up")],
    ];
    return (
      <section aria-label={tag} className={`${CARD} p-5 flex flex-col`}>
        <p className={LABEL}>
          {tag}
          {more && (
            <span className="ml-2 px-1.5 py-0.5 bg-[var(--color-accent)] text-white text-[10px] tracking-wider normal-case">
              {PICKER_MORE_PROGRESS}
            </span>
          )}
        </p>
        <h3 style={SERIF} className="text-lg">
          {device}
        </h3>
        <p className={`text-sm mb-4 ${MUTED}`}>{savedAtLabel(s.savedAt, now)}</p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {stats.map(([n, label]) => (
            <div key={label} className="bg-[var(--color-background)] px-3 py-2">
              <b style={SERIF} className="block text-xl font-normal">
                {n}
              </b>
              <span className={`text-xs ${MUTED}`}>{label}</span>
            </div>
          ))}
        </div>
        <ul className="text-sm mb-4 leading-relaxed flex-1">
          {s.pets.map((p, i) => (
            <li key={i}>
              {p.stage === "egg" ? (
                <span className={MUTED}>{PICKER_EGG}</span>
              ) : (
                <>
                  <span>{p.name}</span> <span className={MUTED}>· {PET_STAGE_NAMES[p.stage]}</span>
                </>
              )}
            </li>
          ))}
          {s.more > 0 && <li className={MUTED}>{`+ ${s.more} more`}</li>}
        </ul>
        {!error && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void choose(which)}
            className={`${which === "account" ? BUTTON_PRIMARY : BUTTON_SECONDARY} w-full`}
          >
            {which === "local" ? PICKER_KEEP_LOCAL : PICKER_KEEP_ACCOUNT}
          </button>
        )}
      </section>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-overlay)] overflow-y-auto">
      <div role="dialog" aria-modal="true" aria-labelledby="save-picker-title" className={`${CARD} w-full max-w-3xl m-4 p-6 space-y-4`}>
        <h2 id="save-picker-title" style={SERIF} className="text-2xl">
          {PICKER_TITLE}
        </h2>
        <p className={`text-sm ${MUTED}`}>{PICKER_LEAD}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {card("local", local, hasMoreProgress(local, account))}
          {card("account", account, hasMoreProgress(account, local))}
        </div>
        {error ? (
          <div className="flex items-center justify-between gap-4">
            <p role="alert" className="text-sm text-[var(--color-accent)]">
              {error}
            </p>
            <button type="button" onClick={onClose} className={BUTTON_SECONDARY} autoFocus>
              Close
            </button>
          </div>
        ) : (
          <>
            <div className="flex justify-center">
              <button type="button" onClick={() => void onNotNow()} className={`text-sm underline ${MUTED} hover:text-[var(--color-foreground)]`}>
                {PICKER_NOT_NOW}
              </button>
            </div>
            <p className={`text-xs ${MUTED}`}>{PICKER_FOOTER}</p>
          </>
        )}
      </div>
    </div>
  );
}

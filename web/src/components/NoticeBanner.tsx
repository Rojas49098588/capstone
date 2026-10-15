import type { Notice } from "../store/useStudium";

const MESSAGES: Record<Exclude<Notice, null>, string> = {
  "damaged-data":
    "Your saved data couldn't be read, so Studium started fresh with the example projects. The old data was kept as a backup in this browser.",
  "storage-unavailable": "This browser isn't letting Studium save, so changes won't be saved after you close the tab.",
  "save-failed": "Studium couldn't save your last change (storage may be full). Changes won't be saved until this is fixed.",
};

export default function NoticeBanner({ notice, onDismiss }: { notice: Notice; onDismiss: () => void }) {
  if (!notice) return null;
  return (
    <div role="alert" className="bg-[var(--color-accent)] text-[var(--color-accent-foreground)]">
      <div className="max-w-6xl mx-auto px-6 py-2 flex items-start gap-3 text-sm">
        <span className="flex-1">{MESSAGES[notice]}</span>
        <button type="button" onClick={onDismiss} aria-label="Dismiss notice" className="opacity-80 hover:opacity-100">
          ×
        </button>
      </div>
    </div>
  );
}

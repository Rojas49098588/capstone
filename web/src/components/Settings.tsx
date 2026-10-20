import {
  DIFFICULTIES,
  PET_INVOLVEMENTS,
  PET_ORDERS,
  PROGRESS_STYLES,
  type PetCount,
  type Settings as SettingsValues,
} from "../store/settings";
import { useStudiumContext } from "../store/useStudium";
import { BUTTON_SECONDARY, CARD, INPUT, LABEL, MUTED, SERIF } from "../ui/styles";

const LATER = "Saved now; what it changes comes in a later update.";

/** The User Settings page: account details (once accounts exist) and preferences. */
type Props = { onReplayTutorial?: () => void };

export default function Settings({ onReplayTutorial }: Props) {
  const s = useStudiumContext();
  const { settings, settingsSaved: saved } = s;
  const change = (next: Partial<SettingsValues>) => s.updateSettings(next);

  // One choice per pet that exists, plus every pet.
  const petCounts = Array.from({ length: Math.max(1, s.data.projects.length) }, (_, i) => i + 1);

  function choices<T extends string>(
    name: string,
    legend: string,
    options: { value: T; label: string }[],
    value: T,
    onPick: (v: T) => void,
    note: string = LATER,
  ) {
    return (
      <fieldset>
        <legend className="text-sm font-semibold mb-2">{legend}</legend>
        <div className="flex flex-wrap gap-2">
          {options.map((o) => (
            <label
              key={o.value}
              className={`px-3 py-1.5 text-sm border cursor-pointer transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 ${
                value === o.value
                  ? "bg-[var(--color-inverse)] text-[var(--color-inverse-foreground)] border-[var(--color-inverse)]"
                  : "border-[var(--color-border)] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
              }`}
            >
              <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onPick(o.value)} className="sr-only" />
              {o.label}
            </label>
          ))}
        </div>
        <p className={`text-xs mt-2 ${MUTED}`}>{note}</p>
      </fieldset>
    );
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <p className={LABEL}>Preferences</p>
        <h1 style={SERIF} className="text-3xl">
          User Settings
        </h1>
        {!saved && <p className="text-sm text-[var(--color-accent)] mt-2">These settings couldn't be saved in this browser; they apply until you leave.</p>}
      </div>

      <section aria-labelledby="settings-account" className={`${CARD} p-6 space-y-4`}>
        <h2 id="settings-account" style={SERIF} className="text-xl">
          Account
        </h2>
        <p className={`text-sm ${MUTED}`}>Your account details will show here once accounts are added.</p>
        <dl className="grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
          <dt className={LABEL}>Email</dt>
          <dd className={MUTED}>Not set yet</dd>
          <dt className={LABEL}>Nickname</dt>
          <dd className={MUTED}>Not set yet</dd>
        </dl>
      </section>

      <section aria-labelledby="settings-settings" className={`${CARD} p-6 space-y-6`}>
        <h2 id="settings-settings" style={SERIF} className="text-xl">
          Settings
        </h2>
        {choices("difficulty", "Difficulty", DIFFICULTIES, settings.difficulty, (difficulty) => change({ difficulty }))}
        <div>
          <label htmlFor="settings-pet-count" className="text-sm font-semibold block mb-2">
            Pets on screen at once
          </label>
          <select
            id="settings-pet-count"
            value={String(settings.petCount)}
            onChange={(e) => change({ petCount: (e.target.value === "all" ? "all" : Number(e.target.value)) as PetCount })}
            className={`${INPUT} max-w-[12rem] bg-[var(--color-card)]`}
          >
            <option value="all">All pets</option>
            {petCounts.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <p className={`text-xs mt-2 ${MUTED}`}>
            How many pets walk around your pages, first projects first. A napping pet makes room for the next one. A project page always shows its own pet.
          </p>
        </div>
        {choices(
          "pet-order",
          "Which pets show first",
          PET_ORDERS,
          settings.petOrder,
          (petOrder) => change({ petOrder }),
          "When not every pet fits: in the order of your projects, or the project due soonest first (overdue ones before that).",
        )}
        {choices(
          "progress",
          "Progress style",
          PROGRESS_STYLES,
          settings.progressStyle,
          (progressStyle) => change({ progressStyle }),
          "How Total Progress on the Overview shows each project: rings in a circle, or one bar per project.",
        )}
        {choices("involvement", "How involved your pet is", PET_INVOLVEMENTS, settings.petInvolvement, (petInvolvement) => change({ petInvolvement }))}
      </section>

      <section aria-labelledby="settings-tutorial" className={`${CARD} p-6 space-y-3`}>
        <h2 id="settings-tutorial" style={SERIF} className="text-xl">
          Tutorial
        </h2>
        <p className={`text-sm ${MUTED}`}>A short tour of the project page, the Overview and the Shop.</p>
        <button type="button" onClick={onReplayTutorial} className={BUTTON_SECONDARY}>
          Replay tutorial
        </button>
      </section>
    </div>
  );
}

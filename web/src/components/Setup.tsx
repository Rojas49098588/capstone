import { useState, type ReactNode } from "react";
import { NICKNAME_MAX } from "../planner/tuning";
import { DIFFICULTY_LEVELS, PROJECT_TYPES, type Difficulty, type ProjectType } from "../planner/types";
import { PET_INVOLVEMENT_LEVELS, cleanNickname, type PetInvolvement, type ProgressStyle } from "../store/settings";
import { useStudiumContext } from "../store/useStudium";
import {
  DIFFICULTY_HINTS,
  DIFFICULTY_LABELS,
  INVOLVEMENT_HINTS,
  INVOLVEMENT_LABELS,
  PROJECT_TYPE_LABELS,
  SETUP_COPY,
  SETUP_SAMPLE_PROJECTS,
} from "../ui/format";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, CARD, INPUT, LABEL, MUTED, SERIF } from "../ui/styles";

type Theme = "light" | "dark";
type Props = { theme: Theme; onTheme: (theme: Theme) => void; onFinish: () => void };

const STEPS = 4;

/**
 * The first-run setup: what you make, a nickname, your pets, your look. Nothing is saved until the
 * last step, so leaving part-way starts it again next time. The theme switches as soon as it's picked.
 */
export default function Setup({ theme, onTheme, onFinish }: Props) {
  const s = useStudiumContext();
  const [step, setStep] = useState(0);
  const [projectType, setProjectType] = useState<ProjectType>(s.settings.projectType);
  const [nickname, setNickname] = useState(s.settings.nickname);
  const [difficulty, setDifficulty] = useState<Difficulty>(s.settings.difficulty);
  const [involvement, setInvolvement] = useState<PetInvolvement>(s.settings.petInvolvement);
  const [progressStyle, setProgressStyle] = useState<ProgressStyle>(s.settings.progressStyle);

  function finish() {
    s.updateSettings({ projectType, nickname: cleanNickname(nickname), difficulty, petInvolvement: involvement, progressStyle, setupDone: true });
    onFinish();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-background)] px-4 py-10">
      <div className={`${CARD} w-full max-w-xl p-8 space-y-6`}>
        <div className="flex items-center justify-between">
          <p className={LABEL}>{SETUP_COPY.welcome}</p>
          <p className={`text-xs font-mono ${MUTED}`} aria-hidden="true">
            {Array.from({ length: STEPS }, (_, i) => (i <= step ? "●" : "○")).join(" ")}
          </p>
        </div>
        <p className={`text-xs font-mono ${MUTED}`}>{`Step ${step + 1} of ${STEPS}`}</p>

        {step === 0 && (
          <Step title={SETUP_COPY.makeTitle}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PROJECT_TYPES.map((t) => (
                <Choice key={t} name="setup-type" checked={projectType === t} onPick={() => setProjectType(t)} label={PROJECT_TYPE_LABELS[t]} />
              ))}
            </div>
            <p className={`text-xs ${MUTED}`}>{SETUP_COPY.makeHint}</p>
          </Step>
        )}

        {step === 1 && (
          <Step title={SETUP_COPY.nameTitle}>
            <input
              aria-label="Nickname"
              value={nickname}
              maxLength={NICKNAME_MAX}
              onChange={(e) => setNickname(e.target.value)}
              placeholder={SETUP_COPY.namePlaceholder}
              className={INPUT}
              autoFocus
            />
            <p className={`text-xs ${MUTED}`}>{SETUP_COPY.nameHint}</p>
          </Step>
        )}

        {step === 2 && (
          <Step title={SETUP_COPY.petsTitle}>
            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold mb-1">{SETUP_COPY.difficultyLegend}</legend>
              {DIFFICULTY_LEVELS.map((d) => (
                <Choice key={d} name="setup-difficulty" checked={difficulty === d} onPick={() => setDifficulty(d)} label={DIFFICULTY_LABELS[d]} hint={DIFFICULTY_HINTS[d]} />
              ))}
            </fieldset>
            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold mb-1">{SETUP_COPY.involvementLegend}</legend>
              {PET_INVOLVEMENT_LEVELS.map((v) => (
                <Choice key={v} name="setup-involvement" checked={involvement === v} onPick={() => setInvolvement(v)} label={INVOLVEMENT_LABELS[v]} hint={INVOLVEMENT_HINTS[v]} />
              ))}
            </fieldset>
          </Step>
        )}

        {step === 3 && (
          <Step title={SETUP_COPY.lookTitle}>
            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold mb-1">{SETUP_COPY.progressLegend}</legend>
              <Choice name="setup-progress" checked={progressStyle === "bar"} onPick={() => setProgressStyle("bar")} label="Bars">
                <BarsPreview />
              </Choice>
              <Choice name="setup-progress" checked={progressStyle === "circle"} onPick={() => setProgressStyle("circle")} label="Rings">
                <RingsPreview />
              </Choice>
            </fieldset>
            <fieldset>
              <legend className="text-sm font-semibold mb-2">{SETUP_COPY.themeLegend}</legend>
              <div className="grid grid-cols-2 gap-2">
                <Choice name="setup-theme" checked={theme === "light"} onPick={() => onTheme("light")} label="Light" />
                <Choice name="setup-theme" checked={theme === "dark"} onPick={() => onTheme("dark")} label="Dark" />
              </div>
            </fieldset>
            <p className={`text-xs ${MUTED}`}>{SETUP_COPY.changeLater}</p>
          </Step>
        )}

        <div className="flex justify-between gap-2 pt-2">
          {step > 0 ? (
            <button type="button" onClick={() => setStep(step - 1)} className={BUTTON_SECONDARY}>
              Back
            </button>
          ) : (
            <span />
          )}
          {step < STEPS - 1 ? (
            <button type="button" onClick={() => setStep(step + 1)} className={BUTTON_PRIMARY}>
              Continue
            </button>
          ) : (
            <button type="button" onClick={finish} className={BUTTON_PRIMARY}>
              Start using Studium
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Step({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <h1 style={SERIF} className="text-3xl">
        {title}
      </h1>
      {children}
    </section>
  );
}

/** One radio choice drawn as a card: a label, an optional hint, and an optional preview below. */
function Choice({ name, checked, onPick, label, hint, children }: { name: string; checked: boolean; onPick: () => void; label: string; hint?: string; children?: ReactNode }) {
  return (
    <label
      className={`block border p-3 cursor-pointer transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 ${
        checked ? "border-[var(--color-primary)] bg-[var(--color-muted)]" : "border-[var(--color-border)] hover:border-[var(--color-foreground)]"
      }`}
    >
      <input type="radio" name={name} aria-label={label} checked={checked} onChange={onPick} className="sr-only" />
      <span className="flex items-center justify-between gap-2 text-sm font-semibold">
        {label}
        {checked && <span aria-hidden="true">✓</span>}
      </span>
      {hint && <span className={`block text-xs mt-1 ${MUTED}`}>{hint}</span>}
      {children && <span className="block mt-3">{children}</span>}
    </label>
  );
}

/** What Total Progress looks like as bars, with sample projects (copies the Overview's bars). */
function BarsPreview() {
  return (
    <span className="block space-y-2" aria-hidden="true">
      {SETUP_SAMPLE_PROJECTS.map((p) => (
        <span key={p.name} className="block">
          <span className="flex items-center justify-between text-xs font-mono mb-1">
            <span className={`flex items-center gap-2 ${MUTED}`}>
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
              {p.name}
            </span>
            <span>{p.percent}%</span>
          </span>
          <span className="block h-2 bg-[var(--color-border)] overflow-hidden">
            <span className="block h-full" style={{ width: `${p.percent}%`, backgroundColor: p.color }} />
          </span>
        </span>
      ))}
    </span>
  );
}

/** The same sample as nested rings with a legend (copies the Overview's rings). */
function RingsPreview() {
  const radii = [44, 29, 14];
  return (
    <span className="flex items-center gap-6" aria-hidden="true">
      <svg className="w-24 h-24 -rotate-90 flex-shrink-0" viewBox="0 0 100 100">
        {SETUP_SAMPLE_PROJECTS.map((p, i) => {
          const c = 2 * Math.PI * radii[i];
          return (
            <g key={p.name}>
              <circle cx="50" cy="50" r={radii[i]} fill="none" stroke="var(--color-border)" strokeWidth="5" />
              <circle cx="50" cy="50" r={radii[i]} fill="none" stroke={p.color} strokeWidth="5" strokeDasharray={c} strokeDashoffset={c * (1 - p.percent / 100)} />
            </g>
          );
        })}
      </svg>
      <span className="grid grid-cols-1 gap-1 text-xs font-mono">
        {SETUP_SAMPLE_PROJECTS.map((p) => (
          <span key={p.name} className={`flex items-center gap-2 ${MUTED}`}>
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: p.color }} />
            {p.name} · {p.percent}%
          </span>
        ))}
      </span>
    </span>
  );
}

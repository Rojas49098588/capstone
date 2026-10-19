import { useEffect, useRef, useState } from "react";
import { inventory } from "../planner/history";
import type { DecorSlot } from "../planner/types";
import { MEDICINE_PRODUCT_ID } from "../planner/tuning";
import { PET_AWAY_ATTR, WAKE_PET_EVENT } from "../store/petStatus";
import { useStudiumContext } from "../store/useStudium";
import { summarizeProject } from "../ui/derive";
import { MOOD_COLORS, accuracyLabel, attentionLabel, awayLabel, gapLabel, parsePetAway, type PetAway } from "../ui/format";
import { BUTTON_SECONDARY, BUTTON_SMALL, CARD, LABEL, SERIF } from "../ui/styles";
import HabitatDecor, { type Placing } from "./HabitatDecor";

/** How long to wait for the extension to put a pet in the box before showing a still picture. */
export const HABITAT_FALLBACK_MS = 1000;

type Props = {
  projectId: string;
  justHatched: boolean;
  onOpenShop: () => void;
  placing?: Placing;
  onPickSlot?: (slot: DecorSlot) => void;
};

export default function Habitat({ projectId, justHatched, onOpenShop, placing = null, onPickSlot }: Props) {
  const s = useStudiumContext();
  const boxRef = useRef<HTMLDivElement>(null);
  const [showStill, setShowStill] = useState(false);
  const [away, setAway] = useState<PetAway | null>(null);

  // The extension finds this box, puts the project's pet in it and sets data-pet-attached.
  // It removes the attribute when it lets go (pets hidden, extension gone), and the still picture comes back.
  // While the pet naps or sleeps, the extension also sets data-pet-away.
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    let waited = false;
    const update = () => {
      setShowStill(waited && !box.hasAttribute("data-pet-attached"));
      setAway(parsePetAway(box.getAttribute(PET_AWAY_ATTR)));
    };
    setShowStill(false);
    setAway(parsePetAway(box.getAttribute(PET_AWAY_ATTR)));
    const timer = setTimeout(() => {
      waited = true;
      update();
    }, HABITAT_FALLBACK_MS);
    const observer = new MutationObserver(update);
    observer.observe(box, { attributes: true, attributeFilter: ["data-pet-attached", PET_AWAY_ATTR] });
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [projectId]);

  const project = s.data.projects.find((p) => p.id === projectId);
  if (!project) return null;
  const summary = summarizeProject(project, s.data, s.now);
  const medicine = inventory(s.data.events)[MEDICINE_PRODUCT_ID] ?? 0;
  const accuracy = accuracyLabel(project.shortName, summary.multiplier, summary.samples);
  const sick = summary.mood === "Sick";

  return (
    <section aria-label={`${project.shortName} habitat`} className={CARD}>
      <div className="flex items-center justify-between gap-4 border-b border-[var(--color-border)] px-6 py-3">
        <div>
          <p className={LABEL}>Project Companion</p>
          <h2 style={SERIF} className="text-xl">
            Habitat
          </h2>
        </div>
        <span className="text-xs font-mono uppercase tracking-widest" style={{ color: MOOD_COLORS[summary.mood] }}>
          {summary.mood}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_20rem]">
        <div ref={boxRef} data-pet-habitat={project.id} className="relative h-56 overflow-hidden bg-[var(--color-muted)]">
          <div className="absolute inset-x-0 bottom-0 h-10 border-t border-[var(--color-border)] bg-[var(--color-card)]" />
          <HabitatDecor projectId={project.id} placing={placing} onPickSlot={onPickSlot} />
          {away ? (
            <div className="absolute top-3 inset-x-0 flex flex-wrap items-center justify-center gap-2 px-3 text-sm">
              <p>
                <strong style={{ color: project.color }}>{`${project.shortName} ${awayLabel(away, s.now).title}`}</strong> ·{" "}
                {awayLabel(away, s.now).detail}
              </p>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent(WAKE_PET_EVENT, { detail: project.id }))}
                className={BUTTON_SMALL}
              >
                Wake
              </button>
            </div>
          ) : (
            justHatched && (
              <p className="absolute top-3 inset-x-0 text-center text-sm font-semibold" style={{ color: project.color }}>
                It hatched: a {project.petKind}!
              </p>
            )
          )}
          {showStill && (
            <img
              src={`${import.meta.env.BASE_URL}pets/${project.petKind}.png`}
              alt={`${project.shortName}'s ${project.petKind}`}
              className="absolute bottom-6 left-1/2 -translate-x-1/2 h-24"
              style={{ filter: `drop-shadow(0 0 2px ${project.color})${sick ? " saturate(0.5) hue-rotate(40deg)" : ""}` }}
            />
          )}
        </div>

        <div className="border-t sm:border-t-0 sm:border-l border-[var(--color-border)] p-5 space-y-4 text-sm">
          <div>
            <p className={LABEL}>Mood</p>
            <p>
              <span className="font-semibold" style={{ color: MOOD_COLORS[summary.mood] }}>
                {summary.mood}
              </span>{" "}
              · {gapLabel(summary.gap)}
            </p>
            {summary.health.recovering && (
              <p className="text-xs text-[var(--color-muted-foreground)] mt-1">
                Recovering: mood stays at Worried or below until the neglected requirements move again.
              </p>
            )}
          </div>
          <div>
            <p className={LABEL}>Attention</p>
            <p className={summary.neglected.length > 0 ? "text-[var(--color-accent)]" : ""}>{attentionLabel(summary.neglected)}</p>
          </div>
          <div>
            <p className={LABEL}>Estimate accuracy</p>
            <p>{accuracy ?? "Finish a few tasks with a time to see how your estimates compare."}</p>
          </div>
          {/* Giving medicine is in the inventory below; here, only say where to get it. */}
          {sick && medicine === 0 && (
            <button type="button" onClick={onOpenShop} className={BUTTON_SECONDARY}>
              Buy medicine in the Shop
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

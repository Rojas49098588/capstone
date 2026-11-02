import { useEffect, useRef, useState } from "react";
import { textIn } from "../ui/color";
import { inventory } from "../planner/history";
import { requirementsToHatch } from "../planner/lifecycle";
import { findPet, petMood, suggestedPetName, workSince, type PetRef } from "../planner/pets";
import type { DecorSlot, Project, StudiumData } from "../planner/types";
import { EGG_HATCH_SHARE, JUVENILE_SCALE, MEDICINE_PRODUCT_ID } from "../planner/tuning";
import { PET_AWAY_ATTR, WAKE_PET_EVENT } from "../store/petStatus";
import { useStudiumContext } from "../store/useStudium";
import { summarizeProject } from "../ui/derive";
import {
  CARES_SHARED_LABEL,
  EGG_LABEL,
  MOOD_COLORS,
  accuracyLabel,
  accuracyPending,
  attentionLabel,
  awayLabel,
  boughtEggHint,
  caresForLabel,
  eggProgressLabel,
  gapLabel,
  hatchHint,
  parsePetAway,
  recoveringNote,
  wordsFor,
  type PetAway,
  type ProjectWords,
} from "../ui/format";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, BUTTON_SMALL, CARD, LABEL, SERIF } from "../ui/styles";
import HabitatDecor, { type Placing } from "./HabitatDecor";
import PetSetup, { CaresAboutSelect } from "./PetSetup";

/** How long to wait for the extension to put a pet in the box before showing a still picture. */
export const HABITAT_FALLBACK_MS = 1000;
/** The still picture's height for an adult, in px; juveniles are JUVENILE_SCALE of it. */
const STILL_HEIGHT_PX = 96;

type Props = {
  habitatId: string; // the project id for its first pet, the pet id for a bought one (planner/pets.ts)
  onOpenShop: () => void;
  placing?: Placing;
  onPickSlot?: (slot: DecorSlot) => void;
};

/** A bought egg's progress: the requirement closest to halfway since the purchase. */
function eggProgress(pet: PetRef, boughtAt: string, data: StudiumData, words: ProjectWords): string | null {
  let best: { done: number; needed: number } | null = null;
  for (const r of data.requirements.filter((x) => x.projectId === pet.projectId)) {
    const ids = data.tasks.filter((t) => t.requirementId === r.id).map((t) => t.id);
    const w = workSince(ids, data.events, boughtAt);
    const needed = Math.max(1, Math.ceil(w.total * EGG_HATCH_SHARE));
    if (!best || w.done / needed > best.done / best.needed) best = { done: Math.min(w.done, needed), needed };
  }
  return best ? eggProgressLabel(best.done, best.needed, words) : null;
}

export default function Habitat({ habitatId, onOpenShop, placing = null, onPickSlot }: Props) {
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
  }, [habitatId]);

  const pet = findPet(s.data, habitatId);
  const project: Project | undefined = pet && s.data.projects.find((p) => p.id === pet.projectId);
  if (!pet || !project) return null;
  const summary = summarizeProject(project, s.data, s.now);
  const mood = petMood(pet, s.data, s.now) ?? summary;
  const medicine = inventory(s.data.events)[MEDICINE_PRODUCT_ID] ?? 0;
  const words = wordsFor(project);
  const accuracy = accuracyLabel(project.shortName, summary.multiplier, summary.samples, words);
  const sick = mood.mood === "Sick";
  const egg = pet.stage === "egg";
  const name = pet.name ?? suggestedPetName(project, pet.kind);
  const caredFor = pet.caresFor ? s.data.requirements.find((r) => r.id === pet.caresFor) : undefined;
  const ownHealth = !pet.first && caredFor !== undefined;
  const bought = pet.first ? undefined : project.pets?.find((p) => p.id === pet.petId);
  const needsSetup = !pet.first && !egg && pet.name === null;

  return (
    <section aria-label={`${name} habitat`} data-tour={pet.first ? "habitat" : undefined} className={CARD}>
      <div className="flex items-center justify-between gap-4 border-b border-[var(--color-border)] px-6 py-3">
        <div className="min-w-0">
          <p className={LABEL}>{caredFor ? caresForLabel(caredFor.title) : CARES_SHARED_LABEL}</p>
          <h2 style={SERIF} className="text-xl break-words">
            {name}
          </h2>
        </div>
        {egg ? (
          <span className="text-xs font-mono uppercase tracking-widest text-[var(--color-muted-foreground)]">{EGG_LABEL}</span>
        ) : (
          <span className="text-xs font-mono uppercase tracking-widest" style={{ color: MOOD_COLORS[mood.mood] }}>
            {mood.mood}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_20rem]">
        <div ref={boxRef} data-pet-habitat={habitatId} className="relative h-56 overflow-hidden bg-[var(--color-muted)]">
          <div className="absolute inset-x-0 bottom-0 h-10 border-t border-[var(--color-border)] bg-[var(--color-card)]" />
          <HabitatDecor projectId={habitatId} placing={placing} onPickSlot={onPickSlot} />
          {away ? (
            <div className="absolute top-3 inset-x-0 flex flex-wrap items-center justify-center gap-2 px-3 text-sm">
              <p>
                <strong style={{ color: textIn(project.color) }}>{`${name} ${awayLabel(away, s.now).title}`}</strong> ·{" "}
                {awayLabel(away, s.now).detail}
              </p>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent(WAKE_PET_EVENT, { detail: habitatId }))}
                className={BUTTON_SMALL}
              >
                Wake
              </button>
            </div>
          ) : null}
          {/* Eggs aren't sent to the extension, so Studium draws the egg itself, straight away. */}
          {egg && (
            <img
              src={`${import.meta.env.BASE_URL}pets/egg.png`}
              alt={`${name}'s egg`}
              className="absolute bottom-6 left-1/2 -translate-x-1/2 h-20 pointer-events-none"
              style={{ imageRendering: "pixelated" }}
            />
          )}
          {showStill && !egg && (
            <img
              src={`${import.meta.env.BASE_URL}pets/${pet.kind}.png`}
              alt={`${name}'s ${pet.kind}`}
              className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-none"
              style={{
                height: STILL_HEIGHT_PX * (pet.stage === "juvenile" ? JUVENILE_SCALE : 1),
                filter: `drop-shadow(0 0 2px ${project.color})${sick ? " saturate(0.5) hue-rotate(40deg)" : ""}`,
              }}
            />
          )}
        </div>

        <div className="border-t sm:border-t-0 sm:border-l border-[var(--color-border)] p-5 space-y-4 text-sm">
          {egg ? (
            <div>
              <p className={LABEL}>Hatching</p>
              {pet.first ? (
                <p>{hatchHint(requirementsToHatch(project, s.data), words)}</p>
              ) : (
                <>
                  <p>{boughtEggHint(words)}</p>
                  {bought && <p className="text-xs text-[var(--color-muted-foreground)] mt-1">{eggProgress(pet, bought.boughtAt, s.data, words)}</p>}
                </>
              )}
            </div>
          ) : needsSetup ? (
            <PetSetup pet={pet} />
          ) : (
            <>
              <div>
                <p className={LABEL}>Mood</p>
                <p>
                  <span className="font-semibold" style={{ color: MOOD_COLORS[mood.mood] }}>
                    {mood.mood}
                  </span>{" "}
                  · {gapLabel(mood.gap)}
                </p>
                {mood.health.recovering && <p className="text-xs text-[var(--color-muted-foreground)] mt-1">{recoveringNote(words)}</p>}
              </div>
              <div>
                <p className={LABEL}>Attention</p>
                <p className={mood.neglected.length > 0 ? "text-[var(--color-accent)]" : ""}>{attentionLabel(mood.neglected, words)}</p>
              </div>
              {!pet.first && (
                <CaresAboutSelect
                  pet={pet}
                  value={pet.caresFor ?? ""}
                  onChange={(v) => s.setUpPet(pet.projectId, pet.petId, { caresFor: v || null })}
                />
              )}
            </>
          )}
          {!needsSetup && (
            <div>
              <p className={LABEL}>Estimate accuracy</p>
              <p>{accuracy ?? accuracyPending(words)}</p>
            </div>
          )}
          {/* A pet sharing the project's health gets medicine in the inventory below; one with its own health, here. */}
          {!egg && sick && ownHealth && medicine > 0 && (
            <button type="button" onClick={() => s.giveMedicine(project.id, pet.petId)} className={BUTTON_PRIMARY}>
              {`Give medicine (${medicine} left)`}
            </button>
          )}
          {!egg && sick && medicine === 0 && (
            <button type="button" onClick={onOpenShop} className={BUTTON_SECONDARY}>
              Buy medicine in the Shop
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

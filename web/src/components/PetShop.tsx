import { useState } from "react";
import { tokenBalance } from "../planner/history";
import { eggRefusal } from "../planner/pets";
import { EGG_PRICE } from "../planner/tuning";
import { PET_KINDS, type PetKind } from "../planner/types";
import { eggLookFor } from "../pets/eggs";
import { useStudiumContext } from "../store/useStudium";
import { EGG_REFUSAL_LABELS, NO_PROJECTS_FOR_EGGS, capitalize, eggBoughtMessage, wordsFor } from "../ui/format";
import { CARD, SERIF } from "../ui/styles";
import EggArt from "./EggArt";

/**
 * The Shop's Pets tab: one egg per kind of pet, each bought for a chosen project. Laid out by kind so
 * later styles of a kind can be added as more eggs under the same heading.
 */
export default function PetShop() {
  const s = useStudiumContext();
  if (s.data.projects.length === 0) return <p className="text-sm text-[var(--color-muted-foreground)]">{NO_PROJECTS_FOR_EGGS}</p>;
  return (
    <div className="space-y-10">
      {PET_KINDS.map((kind) => (
        <section key={kind} aria-labelledby={`pet-shop-${kind}`}>
          <h2 id={`pet-shop-${kind}`} style={SERIF} className="text-2xl mb-4">
            {capitalize(kind)}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <EggCard kind={kind} />
          </div>
        </section>
      ))}
    </div>
  );
}

function EggCard({ kind }: { kind: PetKind }) {
  const s = useStudiumContext();
  const [projectId, setProjectId] = useState("");
  const [bought, setBought] = useState<string | null>(null); // the project it was just bought for
  const balance = tokenBalance(s.data);
  const canAfford = balance >= EGG_PRICE;
  const egg = eggLookFor(kind);
  const boughtFor = s.data.projects.find((p) => p.id === bought);
  const selectId = `pet-shop-${kind}-project`;

  function buy() {
    if (s.buyEgg(projectId, kind)) {
      setBought(projectId);
      setProjectId("");
    }
  }

  return (
    <article aria-label={`${capitalize(kind)} egg`} className={`${CARD} p-5 flex gap-5`}>
      <div className="w-24 h-24 flex-shrink-0 bg-[var(--color-muted)] text-[var(--color-foreground)] flex items-center justify-center">
        <EggArt egg={egg} className="w-14 h-20" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-[var(--color-foreground)]">{`${capitalize(kind)} egg`}</h3>
        <p className="text-xs text-[var(--color-muted-foreground)] leading-relaxed mt-1">{egg.description}</p>
        <label htmlFor={selectId} className="block text-xs font-mono uppercase tracking-widest text-[var(--color-muted-foreground)] mt-3 mb-1">
          Project
        </label>
        <select
          id={selectId}
          value={projectId}
          onChange={(e) => {
            setProjectId(e.target.value);
            setBought(null);
          }}
          className="w-full border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-1.5 text-sm"
        >
          <option value="">Choose a project</option>
          {s.data.projects.map((p) => {
            const refusal = eggRefusal(p);
            return (
              <option key={p.id} value={p.id} disabled={refusal !== null}>
                {refusal ? `${p.shortName} (${EGG_REFUSAL_LABELS[refusal]})` : p.shortName}
              </option>
            );
          })}
        </select>
        {boughtFor ? (
          <p role="status" className="mt-4 text-sm text-[var(--color-foreground)]">
            {eggBoughtMessage(boughtFor.shortName, wordsFor(boughtFor))}
          </p>
        ) : (
          <button
            type="button"
            onClick={buy}
            disabled={!canAfford || projectId === ""}
            className="mt-4 w-full px-3 py-2 text-xs font-mono uppercase tracking-widest bg-[var(--color-primary)] text-[var(--color-primary-foreground)] hover:bg-[var(--color-primary-hover)] disabled:bg-[var(--color-muted)] disabled:text-[var(--color-muted-foreground)] disabled:cursor-not-allowed transition-colors"
          >
            {canAfford ? `Buy · ${EGG_PRICE} tokens` : `Need ${EGG_PRICE - balance} more`}
          </button>
        )}
      </div>
    </article>
  );
}

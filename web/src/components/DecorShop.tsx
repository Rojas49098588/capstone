import { inventory, tokenBalance } from "../planner/history";
import { DECOR_GROUPS, DECOR_ITEMS } from "../store/decor";
import { useStudiumContext } from "../store/useStudium";
import { CARD, SERIF } from "../ui/styles";

/** The Shop's Habitat tab: decor for the project habitats, grouped by type. */
export default function DecorShop() {
  const s = useStudiumContext();
  const balance = tokenBalance(s.data.events);
  const owned = inventory(s.data.events);

  return (
    <div className="space-y-10">
      {DECOR_GROUPS.map(({ type, label }) => (
        <section key={type} aria-labelledby={`decor-${type}`}>
          <h2 id={`decor-${type}`} style={SERIF} className="text-2xl mb-4">
            {label}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {DECOR_ITEMS.filter((i) => i.type === type).map((item) => {
              const count = owned[item.id] ?? 0;
              const canAfford = balance >= item.price;
              return (
                <article key={item.id} aria-labelledby={`decor-item-${item.id}`} className={`${CARD} p-5 flex gap-5`}>
                  <div className="w-24 h-24 flex-shrink-0 bg-[var(--color-muted)] flex items-center justify-center overflow-hidden">
                    <img src={`${import.meta.env.BASE_URL}${item.image}`} alt="" className="max-w-full max-h-full" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 id={`decor-item-${item.id}`} className="font-semibold text-[var(--color-foreground)]">
                          {item.name}
                        </h3>
                        <p className="text-xs text-[var(--color-muted-foreground)] leading-relaxed mt-1">{item.description}</p>
                        {item.forKind && <p className="text-xs font-mono text-[var(--color-muted-foreground)] mt-1">For the {item.forKind}</p>}
                      </div>
                      {count > 0 && <span className="text-xs font-mono text-[var(--color-accent)] whitespace-nowrap">Owned ×{count}</span>}
                    </div>
                    <button
                      type="button"
                      onClick={() => s.purchase(item.id)}
                      disabled={!canAfford}
                      className="mt-4 w-full px-3 py-2 text-xs font-mono uppercase tracking-widest bg-[var(--color-primary)] text-[var(--color-primary-foreground)] hover:bg-[var(--color-primary-hover)] disabled:bg-[var(--color-muted)] disabled:text-[var(--color-muted-foreground)] disabled:cursor-not-allowed transition-colors"
                    >
                      {canAfford ? `Buy · ${item.price} tokens` : `Need ${item.price - balance} more`}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

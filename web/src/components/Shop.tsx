import { useState } from "react";
import { inventory, tokenBalance } from "../planner/history";
import { SHOP_PRODUCTS, type ShopCategory } from "../store/products";
import { useStudiumContext } from "../store/useStudium";
import { CARD, SERIF } from "../ui/styles";
import DecorShop from "./DecorShop";

type ShopTab = "supplies" | "habitat";
const TABS: { id: ShopTab; label: string }[] = [
  { id: "supplies", label: "Supplies" },
  { id: "habitat", label: "Habitat" },
];

const CATEGORIES: { category: ShopCategory; blurb: string }[] = [
  { category: "Care", blurb: "Health & recovery" },
  { category: "Food", blurb: "Care & energy" },
  { category: "Clothes", blurb: "Companion style" },
  { category: "Toys", blurb: "Play & enrichment" },
];

function ProductIcon({ category }: { category: ShopCategory }) {
  const common = { className: "w-16 h-16", viewBox: "0 0 64 64", fill: "none", stroke: "currentColor", "aria-hidden": true } as const;
  if (category === "Care") {
    return (
      <svg {...common}>
        <path d="M24 10h16v8H24zM20 18h24v36H20z" strokeWidth="2" strokeLinejoin="round" />
        <path d="M32 28v16M24 36h16" strokeWidth="3" strokeLinecap="round" />
      </svg>
    );
  }
  if (category === "Food") {
    return (
      <svg {...common}>
        <path d="M14 28h36l-4 22H18l-4-22Z" strokeWidth="2" strokeLinejoin="round" />
        <path d="M21 28c1-8 6-13 11-13s10 5 11 13M26 20c-2-5 1-9 6-10" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  if (category === "Clothes") {
    return (
      <svg {...common}>
        <path d="m22 14-12 9 7 10 6-4v22h18V29l6 4 7-10-12-9c-2 4-5 6-10 6s-8-2-10-6Z" strokeWidth="2" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M18 41c0-12 7-22 14-22s14 10 14 22" strokeWidth="2" strokeLinecap="round" />
      <circle cx="18" cy="43" r="7" strokeWidth="2" />
      <circle cx="46" cy="43" r="7" strokeWidth="2" />
    </svg>
  );
}

export default function Shop() {
  const s = useStudiumContext();
  const balance = tokenBalance(s.data.events);
  const owned = inventory(s.data.events);
  const ownedCount = Object.values(owned).reduce((n, c) => n + c, 0);
  const [tab, setTab] = useState<ShopTab>("supplies");

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-5 border-b border-[var(--color-border)] pb-7">
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-[var(--color-accent)] mb-2">Companion Supplies</p>
          <h1 style={SERIF} className="text-4xl text-[var(--color-foreground)]">
            Shop
          </h1>
          <p className="text-sm text-[var(--color-muted-foreground)] mt-2 max-w-lg">
            Spend study tokens on care, treats, outfits and toys for your project companions.
          </p>
        </div>
        <div className="bg-[var(--color-inverse)] text-[var(--color-inverse-foreground)] px-5 py-3 min-w-44">
          <p className="text-xs font-mono uppercase tracking-widest text-white/55">Your Balance</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span style={SERIF} className="text-3xl">
              {balance}
            </span>
            <span className="text-xs font-mono uppercase tracking-widest text-white/65">Study Tokens</span>
          </div>
        </div>
      </div>

      <div role="tablist" aria-label="Shop sections" className="flex gap-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`shop-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`shop-panel-${t.id}`}
            onClick={() => setTab(t.id)}
            className={`px-4 py-1.5 text-sm border transition-colors ${
              tab === t.id
                ? "bg-[var(--color-inverse)] text-[var(--color-inverse-foreground)] border-[var(--color-inverse)]"
                : "border-[var(--color-border)] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`shop-panel-${tab}`} aria-labelledby={`shop-tab-${tab}`} className="space-y-10">
        {tab === "habitat" ? (
          <DecorShop />
        ) : (
          CATEGORIES.map(({ category, blurb }) => (
            <section key={category} aria-labelledby={`shop-${category}`}>
              <div className="flex items-baseline justify-between gap-4 mb-4">
                <h2 id={`shop-${category}`} style={SERIF} className="text-2xl">
                  {category}
                </h2>
                <p className="text-xs font-mono uppercase tracking-widest text-[var(--color-muted-foreground)]">{blurb}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {SHOP_PRODUCTS.filter((p) => p.category === category).map((product) => {
                  const count = owned[product.id] ?? 0;
                  const canAfford = balance >= product.price;
                  return (
                    <article key={product.id} className={`${CARD} p-5 flex gap-5`}>
                      <div className="w-24 h-24 flex-shrink-0 bg-[var(--color-muted)] text-[var(--color-primary)] flex items-center justify-center">
                        <ProductIcon category={product.category} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-semibold text-[var(--color-foreground)]">{product.name}</h3>
                            <p className="text-xs text-[var(--color-muted-foreground)] leading-relaxed mt-1">{product.description}</p>
                          </div>
                          {count > 0 && <span className="text-xs font-mono text-[var(--color-accent)] whitespace-nowrap">Owned ×{count}</span>}
                        </div>
                        <button
                          type="button"
                          onClick={() => s.purchase(product.id)}
                          disabled={!canAfford}
                          className="mt-4 w-full px-3 py-2 text-xs font-mono uppercase tracking-widest bg-[var(--color-primary)] text-[var(--color-primary-foreground)] hover:bg-[var(--color-primary-hover)] disabled:bg-[var(--color-muted)] disabled:text-[var(--color-muted-foreground)] disabled:cursor-not-allowed transition-colors"
                        >
                          {canAfford ? `Buy · ${product.price} tokens` : `Need ${product.price - balance} more`}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>

      <div className="border-t border-[var(--color-border)] pt-4 flex justify-between text-xs font-mono uppercase tracking-widest text-[var(--color-muted-foreground)]">
        <span>Inventory</span>
        <span>{ownedCount} items owned</span>
      </div>
    </div>
  );
}

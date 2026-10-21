import { useState, type ReactElement } from "react";
import { inventory } from "../planner/history";
import { projectHealth } from "../planner/mood";
import { MEDICINE_PRODUCT_ID } from "../planner/tuning";
import type { DecorSlot } from "../planner/types";
import { ALL_DECOR, DECOR_GROUPS, freeCopies, ownedDecor, placements, type DecorItem } from "../store/decor";
import { SHOP_PRODUCTS, type ShopCategory } from "../store/products";
import { useStudiumContext } from "../store/useStudium";
import { SLOT_NAMES, type SpotSlot } from "../ui/decorLayout";
import { copiesLabel } from "../ui/format";
import { BUTTON_PRIMARY, BUTTON_SMALL, CARD, LABEL, SERIF } from "../ui/styles";
import DecorArt from "./DecorArt";
import type { Placing } from "./HabitatDecor";

type Props = {
  projectId: string;
  placing: Placing;
  onPlace: (placing: NonNullable<Placing>) => void;
  onCancel: () => void;
  onOpenShop: () => void;
};

type Tab = "items" | "furniture";
const SUPPLY_GROUPS: ShopCategory[] = ["Care", "Food", "Clothes", "Toys"];
const isSurface = (item: DecorItem) => item.type === "wallpaper" || item.type === "flooring";
const SURFACE_NAMES: Record<string, string> = { wallpaper: "wallpaper", flooring: "flooring" };

/** Everything the user owns, under a project's habitat: Items (supplies) and Furniture (decor). */
export default function Inventory({ projectId, placing, onPlace, onCancel, onOpenShop }: Props) {
  const s = useStudiumContext();
  const [tab, setTab] = useState<Tab>("items");
  const owned = inventory(s.data.events);
  const ownedFurniture = ownedDecor(s.data);
  const color = s.data.projects.find((p) => p.id === projectId)?.color ?? "currentColor";
  const habitat = s.data.decor?.[projectId] ?? {};
  const shortName = (id: string) => s.data.projects.find((p) => p.id === id)?.shortName ?? id;
  const placingItem = placing ? ALL_DECOR.find((i) => i.id === placing.itemId) : undefined;

  const supplies = SUPPLY_GROUPS.map((category) => ({
    label: category,
    products: SHOP_PRODUCTS.filter((p) => p.category === category && (owned[p.id] ?? 0) > 0),
  })).filter((g) => g.products.length > 0);
  const decor = DECOR_GROUPS.map((g) => ({
    ...g,
    items: ALL_DECOR.filter((i) => i.type === g.type && (ownedFurniture[i.id] ?? 0) > 0),
  })).filter((g) => g.items.length > 0);

  const medicine = owned[MEDICINE_PRODUCT_ID] ?? 0;
  const sick = projectHealth(projectId, s.data, s.now).sick;

  function empty(what: string) {
    return (
      <p className="text-sm text-[var(--color-muted-foreground)]">
        No {what} yet.{" "}
        <button type="button" onClick={onOpenShop} className="underline hover:text-[var(--color-foreground)]">
          Visit the Shop
        </button>
      </p>
    );
  }

  function decorRow(item: DecorItem) {
    const copies = placements(s.data, item.id);
    const here = copies.filter((c) => c.projectId === projectId);
    const elsewhere = copies.filter((c) => c.projectId !== projectId);
    const free = freeCopies(s.data, item.id);
    const byProject = new Map<string, number>();
    for (const c of elsewhere) byProject.set(c.projectId, (byProject.get(c.projectId) ?? 0) + 1);
    const label = copiesLabel(
      here.length,
      [...byProject].map(([id, count]) => ({ shortName: shortName(id), count })),
      free,
    );
    const total = ownedFurniture[item.id] ?? 0;

    const actions: ReactElement[] = [];
    if (isSurface(item)) {
      const slot = item.type as DecorSlot;
      if (habitat[slot] !== item.id) {
        if (free > 0) {
          actions.push(
            <button key="use" type="button" aria-label={`Use ${item.name} here`} onClick={() => s.placeDecor(projectId, slot, item.id)} className={BUTTON_SMALL}>
              Use here
            </button>,
          );
        } else if (elsewhere[0]) {
          actions.push(
            <button key="move" type="button" aria-label={`Move ${item.name} here`} onClick={() => s.moveDecor(elsewhere[0], { projectId, slot })} className={BUTTON_SMALL}>
              Move here
            </button>,
          );
        }
      }
    } else {
      if (free > 0) {
        actions.push(
          <button key="place" type="button" aria-label={`Place ${item.name}`} onClick={() => onPlace({ itemId: item.id })} className={BUTTON_SMALL}>
            Place
          </button>,
        );
      } else if (elsewhere[0]) {
        actions.push(
          <button key="move" type="button" aria-label={`Move ${item.name} here`} onClick={() => onPlace({ itemId: item.id, from: elsewhere[0] })} className={BUTTON_SMALL}>
            Move here
          </button>,
        );
      }
      for (const c of here) {
        actions.push(
          <button
            key={`remove-${c.slot}`}
            type="button"
            aria-label={`Remove ${item.name} from ${SLOT_NAMES[c.slot as SpotSlot]}`}
            onClick={() => s.removeDecor(projectId, c.slot)}
            className={BUTTON_SMALL}
          >
            Remove
          </button>,
        );
      }
    }

    return (
      <li key={item.id} className="flex items-center gap-3 border border-[var(--color-border)] px-3 py-2">
        <DecorArt item={item} color={color} alt="" className="w-10 h-10 object-contain flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{`${item.name} ×${total}`}</p>
          <p className="text-xs text-[var(--color-muted-foreground)]">{label}</p>
        </div>
        <div className="flex flex-wrap gap-1 justify-end">{actions}</div>
      </li>
    );
  }

  return (
    <section aria-label="Inventory" data-tour="inventory" className={`${CARD} p-5 space-y-4`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className={LABEL}>Your things</p>
          <h2 style={SERIF} className="text-xl">
            Inventory
          </h2>
        </div>
        <div role="tablist" aria-label="Inventory sections" className="flex gap-1">
          {(["items", "furniture"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`px-3 py-1 text-xs border transition-colors ${
                tab === t
                  ? "bg-[var(--color-inverse)] text-[var(--color-inverse-foreground)] border-[var(--color-inverse)]"
                  : "border-[var(--color-border)] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
              }`}
            >
              {t === "items" ? "Items" : "Furniture"}
            </button>
          ))}
        </div>
      </div>

      {placingItem && (
        <div className="flex flex-wrap items-center justify-between gap-2 border border-[var(--color-accent)] bg-[var(--color-muted)] px-3 py-2 text-sm">
          <p>{`Placing ${placingItem.name}: pick a free spot in the habitat.`}</p>
          <button type="button" onClick={onCancel} className={BUTTON_SMALL}>
            Cancel
          </button>
        </div>
      )}

      <div role="tabpanel" className="space-y-4">
        {tab === "items"
          ? supplies.length === 0
            ? empty("items")
            : supplies.map((g) => (
                <section key={g.label} aria-labelledby={`inv-${g.label}`}>
                  <h3 id={`inv-${g.label}`} className="text-sm font-semibold mb-2">
                    {g.label}
                  </h3>
                  <ul className="space-y-2">
                    {g.products.map((p) => (
                      <li key={p.id} className="flex items-center gap-3 border border-[var(--color-border)] px-3 py-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{p.name}</p>
                          <p className="text-xs text-[var(--color-muted-foreground)]">Owned ×{owned[p.id]}</p>
                        </div>
                        {p.id === MEDICINE_PRODUCT_ID && sick && (
                          <button type="button" onClick={() => s.giveMedicine(projectId)} className={BUTTON_PRIMARY}>
                            Give medicine ({medicine} left)
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              ))
          : decor.length === 0
            ? empty("furniture")
            : decor.map((g) => (
                <section key={g.type} aria-labelledby={`inv-${g.type}`}>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <h3 id={`inv-${g.type}`} className="text-sm font-semibold">
                      {g.label}
                    </h3>
                    {(g.type === "wallpaper" || g.type === "flooring") && habitat[g.type] && (
                      <button
                        type="button"
                        aria-label={`Plain ${SURFACE_NAMES[g.type]}`}
                        onClick={() => s.removeDecor(projectId, g.type as DecorSlot)}
                        className={BUTTON_SMALL}
                      >
                        Plain
                      </button>
                    )}
                  </div>
                  <ul className="space-y-2">{g.items.map(decorRow)}</ul>
                </section>
              ))}
      </div>
    </section>
  );
}

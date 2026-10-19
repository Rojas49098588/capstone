import { useState } from "react";
import type { DecorSlot } from "../planner/types";
import { allowedIn, findDecor } from "../store/decor";
import { useStudiumContext } from "../store/useStudium";
import { SLOT_LAYOUT, SLOT_NAMES, SPOT_SLOTS, type SlotBox } from "../ui/decorLayout";

/** What the user is placing from the inventory. `from` is set for "Move here" (a copy in another slot). */
export type Placing = { itemId: string; from?: { projectId: string; slot: DecorSlot } } | null;

type Props = { projectId: string; placing?: Placing; onPickSlot?: (slot: DecorSlot) => void };

const url = (image: string) => `${import.meta.env.BASE_URL}${image}`;
const place = (b: SlotBox) => ({
  left: `${(b.x - b.w / 2) * 100}%`,
  bottom: `${b.y * 100}%`,
  width: `${b.w * 100}%`,
  height: `${b.h * 100}%`,
});

/** The habitat's decor, drawn inside the habitat box: wallpaper, flooring, items, and spot outlines. */
export default function HabitatDecor({ projectId, placing = null, onPickSlot }: Props) {
  const s = useStudiumContext();
  const [broken, setBroken] = useState<Set<string>>(() => new Set());
  const habitat = s.data.decor?.[projectId] ?? {};
  const wallpaper = habitat.wallpaper ? findDecor(habitat.wallpaper) : undefined;
  const flooring = habitat.flooring ? findDecor(habitat.flooring) : undefined;
  const placingItem = placing ? findDecor(placing.itemId) : undefined;
  // While moving a copy within this habitat, its own slot counts as free for the bed rule.
  const rulesHabitat =
    placing?.from?.projectId === projectId ? { ...habitat, [placing.from.slot]: undefined } : habitat;

  return (
    <div className="absolute inset-0">
      {wallpaper && (
        <div
          data-decor-layer="wallpaper"
          className="absolute inset-x-0 top-0 bottom-10"
          style={{ backgroundImage: `url(${url(wallpaper.image)})`, backgroundRepeat: "repeat" }}
        />
      )}
      {flooring && (
        <div
          data-decor-layer="flooring"
          className="absolute inset-x-0 bottom-0 h-10"
          style={{ backgroundImage: `url(${url(flooring.image)})`, backgroundRepeat: "repeat" }}
        />
      )}
      {SPOT_SLOTS.map((slot) => {
        const item = habitat[slot] ? findDecor(habitat[slot] as string) : undefined;
        if (!item || broken.has(item.id)) return null;
        return (
          <img
            key={slot}
            src={url(item.image)}
            alt={item.name}
            onError={() => setBroken((b) => new Set(b).add(item.id))}
            className="absolute object-contain object-bottom"
            style={place(SLOT_LAYOUT[slot])}
          />
        );
      })}
      {placingItem &&
        SPOT_SLOTS.filter((slot) => !habitat[slot] && allowedIn(rulesHabitat, slot, placingItem.id)).map((slot) => (
          <button
            key={slot}
            type="button"
            aria-label={`Put ${placingItem.name} in ${SLOT_NAMES[slot]}`}
            onClick={() => onPickSlot?.(slot)}
            className="absolute border-2 border-dashed border-[var(--color-accent)] bg-[var(--color-accent)]/10 hover:bg-[var(--color-accent)]/20"
            style={place(SLOT_LAYOUT[slot])}
          />
        ))}
    </div>
  );
}

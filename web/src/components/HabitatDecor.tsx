import { useState, type CSSProperties } from "react";
import { findPet } from "../planner/pets";
import { ROOM_TINT, WINDOW_ID, dayPeriod, hasPlacedWindow, season, snowDepth, weather, type Season } from "../planner/timeOfDay";
import type { DecorSlot } from "../planner/types";
import { allowedIn, findDecor } from "../store/decor";
import { useStudiumContext } from "../store/useStudium";
import { SLOT_NAMES, SPOT_SLOTS, itemBox, type SlotBox } from "../ui/decorLayout";
import DecorArt from "./DecorArt";

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

// How much bigger a window is than the wall spot's other items (it grows around the spot's centre).
const WINDOW_SCALE = 1.25;
const windowBox = (b: SlotBox): SlotBox => {
  const w = b.w * WINDOW_SCALE;
  const h = b.h * WINDOW_SCALE;
  return { x: b.x, y: b.y - (h - b.h) / 2, w, h };
};

// What drifts past the window in each season, and the rain. Placeholder shapes (index.css), stable
// positions so nothing jumps between renders.
const PARTICLES: Record<Season, { className: string; count: number } | null> = {
  winter: { className: "window-snow", count: 14 },
  spring: { className: "window-petal", count: 8 },
  summer: null,
  fall: { className: "window-leaf", count: 7 },
};
const RAIN = { className: "window-rain", count: 18 };

function Particles({ className, count }: { className: string; count: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={`window-particle ${className}`}
          style={{ left: `${(i * 37) % 100}%`, animationDelay: `${-((i * 1.3) % 9)}s`, animationDuration: `${6 + (i % 4)}s` }}
        />
      ))}
    </>
  );
}

/** A window: the sky for the time of day, the season's weather, snow on the sill in winter, and the frame. */
function WindowView({ now, style }: { now: Date; style: CSSProperties }) {
  const period = dayPeriod(now);
  const time = season(now);
  const sky = weather(now);
  const drift = PARTICLES[time];
  const snow = snowDepth(now);
  return (
    <div
      data-window
      data-period={period}
      data-season={time}
      data-weather={sky}
      role="img"
      aria-label={`Window (${period}, ${time}${sky === "clear" ? "" : `, ${sky}`})`}
      className="absolute"
      style={style}
    >
      <div className="absolute left-[6%] top-[9%] w-[88%] h-[72%] overflow-hidden">
        <img src={url(`decor/window-sky-${period}.svg`)} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className={`absolute inset-0 window-motion window-motion-${period}`} aria-hidden="true">
          {drift && <Particles {...drift} />}
          {sky === "rain" && <Particles {...RAIN} />}
        </div>
        {snow > 0 && <div data-snow-pile aria-hidden="true" className="window-snow-pile" style={{ height: `${snow * 100}%` }} />}
      </div>
      <img src={url("decor/window-frame.svg")} alt="" className="absolute inset-0 w-full h-full" />
    </div>
  );
}

/** The habitat's decor, drawn inside the habitat box: wallpaper, flooring, items, and spot outlines. */
export default function HabitatDecor({ projectId, placing = null, onPickSlot }: Props) {
  const s = useStudiumContext();
  const [broken, setBroken] = useState<Set<string>>(() => new Set());
  const habitat = s.data.decor?.[projectId] ?? {};
  // projectId is the habitat id: a bought pet's habitat takes its project's color.
  const owner = findPet(s.data, projectId)?.projectId;
  const color = s.data.projects.find((p) => p.id === owner)?.color ?? "currentColor";
  const wallpaper = habitat.wallpaper ? findDecor(habitat.wallpaper) : undefined;
  const flooring = habitat.flooring ? findDecor(habitat.flooring) : undefined;
  const placingItem = placing ? findDecor(placing.itemId) : undefined;
  const period = dayPeriod(s.now);
  const tint = hasPlacedWindow(habitat) ? ROOM_TINT[period] : null;
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
        if (item.id === WINDOW_ID) return <WindowView key={slot} now={s.now} style={place(windowBox(itemBox(slot, item.type)))} />;
        return (
          <DecorArt
            key={slot}
            item={item}
            color={color}
            alt={item.name}
            onError={() => setBroken((b) => new Set(b).add(item.id))}
            className="absolute object-contain object-bottom"
            style={place(itemBox(slot, item.type))}
          />
        );
      })}
      {tint && (
        <div data-testid="room-tint" aria-hidden="true" className="absolute inset-0 pointer-events-none transition-colors duration-1000" style={{ backgroundColor: tint }} />
      )}
      {placingItem &&
        SPOT_SLOTS.filter((slot) => !habitat[slot] && allowedIn(rulesHabitat, slot, placingItem.id)).map((slot) => (
          <button
            key={slot}
            type="button"
            aria-label={`Put ${placingItem.name} in ${SLOT_NAMES[slot]}`}
            onClick={() => onPickSlot?.(slot)}
            className="absolute border-2 border-dashed border-[var(--color-accent)] bg-[var(--color-accent)]/10 hover:bg-[var(--color-accent)]/20"
            style={place(itemBox(slot, placingItem.type))}
          />
        ))}
    </div>
  );
}

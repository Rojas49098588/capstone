// The mystery eggs drawn as SVG (pets/eggs.ts holds their colors and patterns).
import { useId, type ReactElement } from "react";
import type { EggLook, EggPattern } from "../pets/eggs";

const EGG_PATH = "M30 3C15 3 4 27 4 45c0 16 12 28 26 28s26-12 26-28C56 27 45 3 30 3Z";

const PATTERNS: Record<EggPattern, ReactElement> = {
  dots: (
    <>
      {[[18, 24], [38, 20], [28, 40], [14, 52], [42, 50], [30, 62]].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="3" />
      ))}
    </>
  ),
  stripes: (
    <>
      {[30, 44, 58].map((y) => (
        <rect key={y} x="0" y={y} width="60" height="5" />
      ))}
    </>
  ),
  zigzag: <path d="M0 42l8-8 8 8 8-8 8 8 8-8 8 8 8-8" fill="none" strokeWidth="4" />,
  spots: (
    <>
      {[[20, 30, 6], [40, 44, 8], [24, 58, 5]].map(([x, y, r]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={r} />
      ))}
    </>
  ),
  stars: (
    <>
      {[[20, 28], [40, 40], [26, 56]].map(([x, y]) => (
        <path key={`${x}-${y}`} d={`M${x} ${y - 5}l1.5 3.5 3.5 1.5-3.5 1.5-1.5 3.5-1.5-3.5-3.5-1.5 3.5-1.5z`} />
      ))}
    </>
  ),
};

/** A drawn egg: its shell color and pattern. */
export default function EggArt({ egg, className = "w-12 h-16" }: { egg: EggLook; className?: string }) {
  const clipId = useId();
  return (
    <svg viewBox="0 0 60 76" className={className} aria-hidden="true">
      <defs>
        <clipPath id={clipId}>
          <path d={EGG_PATH} />
        </clipPath>
      </defs>
      <path d={EGG_PATH} fill={egg.shell} />
      <g clipPath={`url(#${clipId})`} fill={egg.speckle} stroke={egg.speckle}>
        {PATTERNS[egg.pattern]}
      </g>
      <path d={EGG_PATH} fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.5" />
    </svg>
  );
}

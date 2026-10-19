import type { CSSProperties } from "react";
import type { DecorItem } from "../store/decor";

type Props = { item: DecorItem; color: string; alt: string; className?: string; style?: CSSProperties; onError?: () => void };

/** A decor item's art. The built-in bed is drawn here in the project's color; the rest are images. */
export default function DecorArt({ item, color, alt, className, style, onError }: Props) {
  if (item.builtIn) {
    return (
      <svg
        viewBox="0 0 100 60"
        role={alt ? "img" : undefined}
        aria-label={alt || undefined}
        aria-hidden={alt ? undefined : true}
        preserveAspectRatio="xMidYMax meet"
        className={className}
        style={style}
      >
        <ellipse cx="50" cy="44" rx="46" ry="14" fill={color} />
        <ellipse cx="50" cy="40" rx="36" ry="9" fill="#fff" fillOpacity="0.55" />
      </svg>
    );
  }
  return <img src={`${import.meta.env.BASE_URL}${item.image}`} alt={alt} onError={onError} className={className} style={style} />;
}

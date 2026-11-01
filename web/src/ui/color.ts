// Keeping text readable on and in a project's color, now that any color can be picked.
// The pet code has the same textOn (PetLogic.textOn in extension/content/logic.js).

const DARK_TEXT = "#1a1816";
const LIGHT_TEXT = "#ffffff";

/** WCAG relative luminance of a #rgb / #rrggbb color (alpha ignored), or null if it isn't one. */
function luminance(hex: string): number | null {
  const m = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(hex);
  if (!m) return null;
  const h = m[1].length <= 4 ? [...m[1].slice(0, 3)].map((c) => c + c).join("") : m[1].slice(0, 6);
  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Text drawn on the color: whichever of white or near-black contrasts more. */
export function textOn(hex: string): typeof LIGHT_TEXT | typeof DARK_TEXT {
  const l = luminance(hex) ?? 0;
  return 1.05 / (l + 0.05) >= (l + 0.05) / (0.0098 + 0.05) ? LIGHT_TEXT : DARK_TEXT;
}

/** Light enough that text on it should be dark. */
export function isLightColor(hex: string): boolean {
  return textOn(hex) === DARK_TEXT;
}

/** Text drawn in the color: the color itself, or the normal text color when it's too light or too dark to read on a card. */
export function textIn(hex: string): string {
  const l = luminance(hex);
  return l === null || l > 0.6 || l < 0.01 ? "var(--color-foreground)" : hex;
}

import { SUBLABEL_MAX } from "./tuning";

/** A requirement's sublabel as it's saved: trimmed text of at most SUBLABEL_MAX characters, or undefined for none. */
export function cleanSublabel(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.trim().slice(0, SUBLABEL_MAX).trim();
  return text === "" ? undefined : text;
}

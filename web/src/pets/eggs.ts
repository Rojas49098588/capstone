// Placeholder eggs for the New Project form. Tints and patterns are chosen so they
// don't hint at the animal; descriptions are deliberately vague. Edit freely.
import type { PetKind } from "../planner/types";

export type EggPattern = "dots" | "stripes" | "zigzag" | "spots" | "stars";

export type EggLook = {
  kind: PetKind;
  shell: string;
  speckle: string;
  pattern: EggPattern;
  description: string;
};

export const EGGS: EggLook[] = [
  { kind: "cat", shell: "#e8defa", speckle: "#8b6fc0", pattern: "dots", description: "Something in here likes warm spots and long naps." },
  { kind: "dog", shell: "#d8ebf7", speckle: "#3f7ab0", pattern: "zigzag", description: "It's already wiggling. It can't wait to meet you." },
  { kind: "turtle", shell: "#fbe1cf", speckle: "#c46a3a", pattern: "spots", description: "Heavy and calm. In no hurry at all." },
  { kind: "frog", shell: "#f7efc4", speckle: "#b08a1e", pattern: "stripes", description: "Cool and a little damp. It twitched when you blinked." },
  {
    kind: "pigeon",
    shell: "#f6d6de",
    speckle: "#b0476a",
    pattern: "stars",
    description: "It keeps leaning toward the window, as if it wants to be up high.",
  },
];

/** A shuffled copy (Fisher–Yates), so an egg's position doesn't give it away. */
export function shuffledEggs(random: () => number = Math.random): EggLook[] {
  const eggs = [...EGGS];
  for (let i = eggs.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [eggs[i], eggs[j]] = [eggs[j], eggs[i]];
  }
  return eggs;
}

// The extension walks pets to their furniture using its own copy of the habitat's spot positions.
// This keeps it identical to Studium's layout (src/ui/decorLayout.ts).
import { describe, expect, it } from "vitest";
import "../../../extension/content/logic.js";
import { SLOT_LAYOUT } from "../ui/decorLayout";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const L = (globalThis as unknown as { PetLogic: any }).PetLogic;

describe("habitat spot positions", () => {
  it("match Studium's layout", () => {
    expect(L.SLOT_POSITIONS).toEqual(SLOT_LAYOUT);
  });
});

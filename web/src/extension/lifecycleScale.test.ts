// The extension draws juveniles with its own copy of the juvenile size. This keeps it identical to
// Studium's (src/planner/tuning.ts), which sizes the habitat's still picture.
import { describe, expect, it } from "vitest";
import "../../../extension/content/logic.js";
import { JUVENILE_SCALE } from "../planner/tuning";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const L = (globalThis as unknown as { PetLogic: any }).PetLogic;

describe("juvenile size", () => {
  it("matches Studium's", () => {
    expect(L.JUVENILE_SCALE).toBe(JUVENILE_SCALE);
  });
});

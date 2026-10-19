// @vitest-environment jsdom
// Runs the extension's content script (extension/content/pet.js) in jsdom for situations the
// browser check can't easily create.
import { describe, expect, it } from "vitest";
import "../../../extension/content/logic.js";

describe("pet.js content script", () => {
  it("stops quietly when injected without the extension's storage (a tab open during a reload)", async () => {
    // Pets left by the copy that ran before the extension was reloaded.
    const old = document.createElement("div");
    old.id = "capstone-pet-host";
    document.documentElement.appendChild(old);
    // What Chrome 155 gives a copy injected into an already-open tab after a reload: no storage, no id.
    (globalThis as unknown as { chrome: unknown }).chrome = { runtime: {} };

    // @ts-expect-error pet.js is a plain browser script with no type declarations.
    await import("../../../extension/content/pet.js");

    expect(document.getElementById("capstone-pet-host")).toBeNull();
  });
});

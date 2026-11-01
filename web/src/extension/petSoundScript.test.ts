// @vitest-environment jsdom
// @vitest-environment-options {"url":"http://overlay.test/"}
// Real sounds in the desktop app's overlay: Moderate only, at most one every 30 seconds across all
// pets, and never with Pet sounds turned off.
import { afterAll, expect, it, vi } from "vitest";
import "../../../extension/content/logic.js";

type Listener = (changes: Record<string, { newValue: unknown }>, area: string) => void;

const cat = (projectId: string) => ({
  projectId, shortName: projectId, name: projectId, color: "#2d3a8c", petKind: "cat", mood: "Happy",
  recovering: false, idleRequirement: null, suggestion: null, celebration: null, furniture: [], deadline: null, stage: "adult",
});

afterAll(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it("plays a pet's sound when it talks, at most every 30 seconds, and not when muted or on Mild", async () => {
  vi.useFakeTimers({ now: new Date("2026-11-02T12:00:00"), toFake: ["Date", "setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
  vi.spyOn(Math, "random").mockReturnValue(0.99);
  const play = vi.fn();
  const g = globalThis as unknown as { chrome: unknown; PetSurface: string; PetSound: unknown };
  g.PetSound = { play };
  const store: Record<string, unknown> = {
    petStatuses: { updatedAt: new Date().toISOString(), pets: [cat("a"), cat("b")] },
    petPrefs: { involvement: "moderate", nickname: "", sounds: true },
  };
  const listeners: Listener[] = [];
  const set = async (v: Record<string, unknown>) => {
    Object.assign(store, v);
    const changes = Object.fromEntries(Object.entries(v).map(([k, newValue]) => [k, { newValue }]));
    listeners.forEach((f) => f(changes, "local"));
  };
  g.chrome = {
    runtime: { id: "test", getURL: (path: string) => path, sendMessage: () => Promise.resolve() },
    storage: { local: { get: async () => ({ ...store }), set }, onChanged: { addListener: (f: Listener) => listeners.push(f) } },
  };
  g.PetSurface = "overlay";
  globalThis.requestAnimationFrame = () => 0;
  HTMLElement.prototype.setPointerCapture = () => {}; // missing in jsdom

  // @ts-expect-error pet.js is a plain browser script with no type declarations.
  await import("../../../extension/content/pet.js");
  await vi.advanceTimersByTimeAsync(0);
  const pets = [...(document.getElementById("capstone-pet-host")?.shadowRoot?.querySelectorAll<HTMLElement>(".pet") ?? [])];
  // A click: it hops and says "Meow!".
  const click = (el: HTMLElement) => {
    el.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0 }));
    el.dispatchEvent(new MouseEvent("pointerup", { bubbles: true, button: 0 }));
  };

  click(pets[0]);
  click(pets[1]);
  expect(play.mock.calls).toEqual([["meow"]]); // one sound for both: 30 seconds apart at least

  await vi.advanceTimersByTimeAsync(30_000);
  click(pets[1]);
  expect(play).toHaveBeenCalledTimes(2);

  // Pet sounds off: silent.
  await set({ petPrefs: { involvement: "moderate", nickname: "", sounds: false } });
  await vi.advanceTimersByTimeAsync(30_000);
  click(pets[0]);
  expect(play).toHaveBeenCalledTimes(2);

  // Mild: silent too.
  await set({ petPrefs: { involvement: "mild", nickname: "", sounds: true } });
  await vi.advanceTimersByTimeAsync(30_000);
  click(pets[0]);
  expect(play).toHaveBeenCalledTimes(2);
});

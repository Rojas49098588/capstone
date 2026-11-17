// @vitest-environment jsdom
// @vitest-environment-options {"url":"http://overlay.test/"}
// A pet that just ate its favorite food shows a heart (shop, toys and window spec).
import { afterAll, expect, it, vi } from "vitest";
import "../../../extension/content/logic.js";

type Listener = (changes: Record<string, { newValue: unknown }>, area: string) => void;

const status = (favoriteFedAt: string | null) => ({
  projectId: "a", shortName: "a", name: "A", color: "#2d3a8c", petKind: "frog", mood: "Happy",
  recovering: false, idleRequirement: null, suggestion: null, celebration: null, furniture: [], deadline: null, stage: "adult",
  favoriteFedAt,
});

afterAll(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it("shows a heart for a new favorite feeding, once, and not for an old one", async () => {
  vi.useFakeTimers({ now: new Date("2026-11-17T12:00:00"), toFake: ["Date", "setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
  vi.spyOn(Math, "random").mockReturnValue(0.99); // plain walks, no naps or hops
  const g = globalThis as unknown as { chrome: unknown; PetSurface: string };
  const old = new Date(Date.now() - 5 * 60_000).toISOString();
  const store: Record<string, unknown> = {
    petStatuses: { updatedAt: new Date().toISOString(), pets: [status(old)] },
    petPrefs: { involvement: "moderate", nickname: "" },
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
  globalThis.requestAnimationFrame = () => 1;

  // @ts-expect-error pet.js is a plain browser script with no type declarations.
  await import("../../../extension/content/pet.js");
  await vi.advanceTimersByTimeAsync(0);
  const bubble = () => document.getElementById("capstone-pet-host")?.shadowRoot?.querySelector<HTMLElement>(".bubble") as HTMLElement;
  const shows = () => bubble().classList.contains("show") && bubble().textContent === "♥";

  // The feeding from 5 minutes ago, already there when the pet started: no heart.
  expect(shows()).toBe(false);

  const fresh = new Date().toISOString();
  await set({ petStatuses: { updatedAt: fresh, pets: [status(fresh)] } });
  expect(shows()).toBe(true);

  await vi.advanceTimersByTimeAsync(3000);
  expect(shows()).toBe(false);
  await set({ petStatuses: { updatedAt: new Date().toISOString(), pets: [status(fresh)] } });
  expect(shows()).toBe(false);
});

// @vitest-environment jsdom
// @vitest-environment-options {"url":"http://overlay.test/"}
// Sticky notes in the desktop app's overlay (PetSurface "overlay"): there are no tabs to leave, so a
// note stays until it's closed, its pet naps, or 15 minutes pass. The dev override shortens the wait.
import { afterAll, expect, it, vi } from "vitest";
import "../../../extension/content/logic.js";

type Listener = (changes: Record<string, { newValue: unknown }>, area: string) => void;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const L = (globalThis as unknown as { PetLogic: any }).PetLogic;

const status = {
  projectId: "portraits", shortName: "portraits", name: "Portraits", color: "#2d3a8c", petKind: "cat", mood: "Worried",
  recovering: false, idleRequirement: { title: "Base colors", days: 5 }, suggestion: null, celebration: null, furniture: [],
  deadline: null, stage: "adult",
};

afterAll(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it("a desktop note stays when nothing is 'left', goes after 15 minutes, and the override shortens the wait", async () => {
  vi.useFakeTimers({ now: new Date("2026-11-02T12:00:00") });
  vi.spyOn(Math, "random").mockReturnValue(0.99); // never carried in, for a still picture
  const store: Record<string, unknown> = {
    petStatuses: { updatedAt: new Date().toISOString(), pets: [status] },
    petPrefs: { involvement: "moderate", nickname: "Abby" },
  };
  const listeners: Listener[] = [];
  const set = async (v: Record<string, unknown>) => {
    Object.assign(store, v);
    const changes = Object.fromEntries(Object.entries(v).map(([k, newValue]) => [k, { newValue }]));
    listeners.forEach((f) => f(changes, "local"));
  };
  const g = globalThis as unknown as { chrome: unknown; PetSurface: string };
  g.chrome = {
    runtime: { id: "test", getURL: (path: string) => path, sendMessage: () => Promise.resolve() },
    storage: { local: { get: async () => ({ ...store }), set }, onChanged: { addListener: (f: Listener) => listeners.push(f) } },
  };
  g.PetSurface = "overlay";
  globalThis.requestAnimationFrame = () => 0;

  // @ts-expect-error pet.js is a plain browser script with no type declarations.
  await import("../../../extension/content/pet.js");
  const note = () => document.getElementById("capstone-pet-host")?.shadowRoot?.querySelector<HTMLElement>(".note") ?? null;

  await vi.advanceTimersByTimeAsync(L.NOTE_CHECK_MS + 1000);
  expect(note()).not.toBeNull();

  // The overlay is never "left" the way a tab is.
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
  document.dispatchEvent(new Event("visibilitychange"));
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
  expect(note()).not.toBeNull();

  // Gone after 15 minutes.
  await vi.advanceTimersByTimeAsync(L.MISCHIEF.NOTE_STAY_MS);
  expect(note()).toBeNull();

  // Worried waits 30 minutes between notes; the override makes it 3 seconds.
  await set({ petTimingOverride: { mischiefMinutes: 0.05 } });
  await vi.advanceTimersByTimeAsync(L.NOTE_CHECK_MS);
  expect(note()).not.toBeNull();

  // Carried in: first a small note above the pet, then the note itself (dropped within 8 s).
  note()?.querySelector<HTMLButtonElement>('button[aria-label="Close note"]')?.click();
  vi.spyOn(Math, "random").mockReturnValue(0.1);
  const carried = () => document.getElementById("capstone-pet-host")?.shadowRoot?.querySelector<HTMLElement>(".carried");
  await vi.advanceTimersByTimeAsync(L.NOTE_CHECK_MS);
  expect(note()).toBeNull();
  expect(carried()?.hidden).toBe(false);
  await vi.advanceTimersByTimeAsync(8000);
  expect(carried()?.hidden).toBe(true);
  expect(note()).not.toBeNull();

  // Another pet's nap is focus time: the note goes too (nothing during a nap).
  const until = new Date(Date.now() + 15 * 60000).toISOString();
  await set({ petAway: { other: { kind: "nap", id: "n", startedAt: new Date().toISOString(), until, taskId: null, taskTitle: null } } });
  expect(note()).toBeNull();
});

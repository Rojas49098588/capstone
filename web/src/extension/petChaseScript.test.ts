// @vitest-environment jsdom
// @vitest-environment-options {"url":"http://overlay.test/"}
// Chasing the mouse in the desktop app's overlay (Moderate only): a pet runs after the cursor for a
// few seconds, stops when the cursor leaves the overlay, and stops at once when a nap starts.
import { afterAll, expect, it, vi } from "vitest";
import "../../../extension/content/logic.js";

type Listener = (changes: Record<string, { newValue: unknown }>, area: string) => void;

const status = {
  projectId: "a", shortName: "a", name: "A", color: "#2d3a8c", petKind: "cat", mood: "Happy",
  recovering: false, idleRequirement: null, suggestion: null, celebration: null, furniture: [], deadline: null, stage: "adult",
};

afterAll(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it("chases the cursor, stops when it leaves the overlay, and stops at once for a nap", async () => {
  vi.useFakeTimers({ now: new Date("2026-11-02T12:00:00"), toFake: ["Date", "setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
  vi.spyOn(Math, "random").mockReturnValue(0.99); // plain walks, no naps or hops
  let cursor: { x: number; y: number } | null = { x: 700, y: 500 };
  const g = globalThis as unknown as { chrome: unknown; PetSurface: string; petBridge: unknown };
  g.petBridge = { cursor: async () => cursor };
  const store: Record<string, unknown> = {
    petStatuses: { updatedAt: new Date().toISOString(), pets: [status] },
    petPrefs: { involvement: "moderate", nickname: "" },
    petTimingOverride: { mischiefMinutes: 0.05 }, // a chase every 3 seconds
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
  // Drive the animation loop by hand.
  let next: FrameRequestCallback | null = null;
  globalThis.requestAnimationFrame = (cb) => {
    next = cb;
    return 1;
  };
  let t = performance.now();
  const frames = (n: number) => {
    for (let i = 0; i < n; i++) {
      t += 16;
      next?.(t);
    }
  };

  // @ts-expect-error pet.js is a plain browser script with no type declarations.
  await import("../../../extension/content/pet.js");
  await vi.advanceTimersByTimeAsync(0);
  const petEl = () => document.getElementById("capstone-pet-host")?.shadowRoot?.querySelector<HTMLElement>(".pet") as HTMLElement;
  const x = () => Number(/translate\((-?[\d.]+)px/.exec(petEl().style.transform)?.[1]);
  const chasing = () => petEl().classList.contains("chasing");

  frames(2);
  expect(chasing()).toBe(false);
  await vi.advanceTimersByTimeAsync(4000);
  frames(1);
  expect(chasing()).toBe(true);

  // It runs toward the cursor.
  await vi.advanceTimersByTimeAsync(200);
  const before = x();
  frames(30);
  expect(Math.abs(700 - x())).toBeLessThan(Math.abs(700 - before));

  // The cursor leaves the overlay (taskbar, another screen): the chase ends.
  cursor = null;
  await vi.advanceTimersByTimeAsync(200);
  frames(1);
  expect(chasing()).toBe(false);

  // The next chase stops the moment a nap starts.
  cursor = { x: 100, y: 500 };
  await vi.advanceTimersByTimeAsync(4000);
  frames(1);
  expect(chasing()).toBe(true);
  const until = new Date(Date.now() + 15 * 60000).toISOString();
  await set({ petAway: { other: { kind: "nap", id: "n", startedAt: new Date().toISOString(), until, taskId: null, taskTitle: null } } });
  frames(1);
  expect(chasing()).toBe(false);
});

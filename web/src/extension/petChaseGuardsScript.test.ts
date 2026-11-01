// @vitest-environment jsdom
// @vitest-environment-options {"url":"http://overlay.test/"}
// Chasing the mouse, the cases that must not go wrong (desktop overlay, Moderate): a frog (which hops
// rather than walks) chases without breaking; no chase while its menu is open; and a chase stops for
// good, cursor polling included, when its own pet naps or the pets are hidden.
import { afterAll, expect, it, vi } from "vitest";
import "../../../extension/content/logic.js";

type Listener = (changes: Record<string, { newValue: unknown }>, area: string) => void;

const frog = {
  projectId: "a", shortName: "a", name: "A", color: "#2d3a8c", petKind: "frog", mood: "Happy",
  recovering: false, idleRequirement: null, suggestion: null, celebration: null, furniture: [], deadline: null, stage: "adult",
};

afterAll(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it("a frog chases without breaking, never while its menu is open, and stops polling when it naps or pets hide", async () => {
  vi.useFakeTimers({ now: new Date("2026-11-02T12:00:00"), toFake: ["Date", "setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
  vi.spyOn(Math, "random").mockReturnValue(0.99);
  let menuOpen = true;
  const cursorCalls = { n: 0 };
  const g = globalThis as unknown as { chrome: unknown; PetSurface: string; petBridge: unknown; PetMenu: unknown };
  g.PetMenu = { STYLE: "", isOpen: () => menuOpen, close: () => {}, open: () => {} };
  g.petBridge = {
    cursor: async () => {
      cursorCalls.n++;
      return { x: 700, y: 500 };
    },
  };
  const store: Record<string, unknown> = {
    petStatuses: { updatedAt: new Date().toISOString(), pets: [frog] },
    petPrefs: { involvement: "moderate", nickname: "" },
    petTimingOverride: { mischiefMinutes: 0.05 },
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
  const x = () => Number(/translate\((-?[\d.]+|NaN)px/.exec(petEl().style.transform)?.[1]);
  const chasing = () => petEl().classList.contains("chasing");
  const nextChase = async () => {
    await vi.advanceTimersByTimeAsync(4000);
    frames(1);
  };

  // The menu is open: no chase, even when one is due.
  frames(1);
  await nextChase();
  expect(chasing()).toBe(false);

  // Menu closed: the frog chases, and its position stays a real number.
  menuOpen = false;
  await nextChase();
  expect(chasing()).toBe(true);
  await vi.advanceTimersByTimeAsync(200);
  const start = x();
  frames(30);
  // (A broken position is dropped by the page, so check that the frog really moved toward the cursor.)
  expect(Math.abs(700 - x())).toBeLessThan(Math.abs(700 - start));

  // The chasing pet itself is sent to nap: the chase ends and the cursor isn't asked for anymore.
  const until = new Date(Date.now() + 15 * 60000).toISOString();
  await set({ petAway: { a: { kind: "nap", id: "n", startedAt: new Date().toISOString(), until, taskId: null, taskTitle: null } } });
  frames(1);
  expect(chasing()).toBe(false);
  const asked = cursorCalls.n;
  await vi.advanceTimersByTimeAsync(2000);
  expect(cursorCalls.n).toBe(asked);

  // Back from the nap; the next chase stops for good when the pets are hidden from the tray.
  await set({ petAway: {}, petCheckIn: null });
  frames(1);
  await nextChase();
  expect(chasing()).toBe(true);
  await set({ petHidden: true });
  frames(1);
  const before = cursorCalls.n;
  await vi.advanceTimersByTimeAsync(2000);
  expect(cursorCalls.n).toBe(before);
  expect(chasing()).toBe(false);
});

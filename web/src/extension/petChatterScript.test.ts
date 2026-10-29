// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://example.com/article"}
// Runs the extension's content script on an ordinary web page: on Moderate, a pet's own chatter (its
// "Haven't seen …" reminders go into sticky notes instead of bubbles, but its sounds stay bubbles.
// On Mild, both are bubbles.
import { afterAll, expect, it, vi } from "vitest";
import "../../../extension/content/logic.js";

type Listener = (changes: Record<string, { newValue: unknown }>, area: string) => void;

const status = {
  projectId: "portraits", shortName: "portraits", name: "Portraits", color: "#2d3a8c", petKind: "cat", mood: "Sick",
  recovering: false, idleRequirement: { title: "Base colors", days: 5 }, suggestion: null, celebration: null, furniture: [],
  deadline: null, stage: "adult",
};

afterAll(() => vi.useRealTimers());

it("a Moderate pet on a web page keeps its sounds in bubbles and puts reminders in notes; a Mild one says both", async () => {
  vi.useFakeTimers({ now: new Date("2026-10-28T12:00:00") });
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
  (globalThis as unknown as { chrome: unknown }).chrome = {
    runtime: { id: "test", getURL: (path: string) => path, sendMessage: () => Promise.resolve(), onMessage: { addListener: () => {} } },
    storage: { local: { get: async () => ({ ...store }), set }, onChanged: { addListener: (f: Listener) => listeners.push(f) } },
  };
  // Animation frames on the fake clock, so the pet's timers run.
  globalThis.requestAnimationFrame = (f: FrameRequestCallback) => setTimeout(() => f(performance.now()), 50) as unknown as number;

  // @ts-expect-error pet.js is a plain browser script with no type declarations.
  await import("../../../extension/content/pet.js");
  const root = () => document.getElementById("capstone-pet-host")?.shadowRoot;
  const said = new Set<string>();
  const watch = async (ms: number) => {
    for (let t = 0; t < ms; t += 500) {
      await vi.advanceTimersByTimeAsync(500);
      const bubble = root()?.querySelector<HTMLElement>(".bubble.show");
      if (bubble?.textContent) said.add(bubble.textContent);
    }
  };

  await watch(6 * 60_000);
  expect(root()?.querySelector(".pet")).not.toBeNull();
  expect([...said].some((s) => s.startsWith("Haven't seen"))).toBe(false);
  expect([...said].some((s) => ["Achoo!", "*sniffle*", "*cough*"].includes(s))).toBe(true);
  expect(root()?.querySelector(".note .sign")?.textContent).toBe("- portraits"); // it wrote a note instead

  said.clear();
  await set({ petPrefs: { involvement: "mild", nickname: "Abby" } });
  await watch(6 * 60_000);
  expect([...said].some((s) => s.startsWith("Haven't seen Base colors"))).toBe(true);
  expect([...said].some((s) => ["Achoo!", "*sniffle*", "*cough*"].includes(s))).toBe(true);
});

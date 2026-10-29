// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://example.com/article"}
// Runs the extension's content script on an ordinary web page with "How much pets interact" set to
// Moderate: a pet leaves a sticky note, at most once every 30 minutes across tabs, never during a nap.
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

afterAll(() => vi.useRealTimers());

it("a Moderate pet leaves a note that can be closed, waits 30 minutes across tabs, and never during a nap", async () => {
  vi.useFakeTimers({ now: new Date("2026-10-28T12:00:00") });
  const store: Record<string, unknown> = {
    petStatuses: { updatedAt: new Date().toISOString(), pets: [status] },
    petPrefs: { involvement: "moderate", nickname: "Abby" },
  };
  const listeners: Listener[] = [];
  // Like chrome.storage: save, then tell every listener what changed (another tab's write looks the same).
  const set = async (v: Record<string, unknown>) => {
    Object.assign(store, v);
    const changes = Object.fromEntries(Object.entries(v).map(([k, newValue]) => [k, { newValue }]));
    listeners.forEach((f) => f(changes, "local"));
  };
  (globalThis as unknown as { chrome: unknown }).chrome = {
    runtime: { id: "test", getURL: (path: string) => path, sendMessage: () => Promise.resolve(), onMessage: { addListener: () => {} } },
    storage: { local: { get: async () => ({ ...store }), set }, onChanged: { addListener: (f: Listener) => listeners.push(f) } },
  };
  globalThis.requestAnimationFrame = () => 0;

  // @ts-expect-error pet.js is a plain browser script with no type declarations.
  await import("../../../extension/content/pet.js");
  const root = () => document.getElementById("capstone-pet-host")?.shadowRoot;
  const note = () => root()?.querySelector<HTMLElement>(".note") ?? null;

  await vi.advanceTimersByTimeAsync(L.NOTE_CHECK_MS + 1000);
  expect(note()?.textContent).toContain("Abby, portraits misses you: 5 days since you worked on it.");
  expect(store.petNoteAt).toBe(Date.now() - 1000);

  // Closing it removes it; no new note before 30 minutes have passed.
  note()?.querySelector<HTMLButtonElement>('button[aria-label="Close note"]')?.click();
  expect(note()).toBeNull();
  await vi.advanceTimersByTimeAsync(20 * 60_000);
  expect(note()).toBeNull();

  // Another tab left a note just now: this one waits too.
  await vi.advanceTimersByTimeAsync(8 * 60_000);
  await set({ petNoteAt: Date.now() });
  await vi.advanceTimersByTimeAsync(2 * 60_000);
  expect(note()).toBeNull();

  // Past the 30 minutes (from the other tab's note), but the pet is napping: no note.
  await vi.advanceTimersByTimeAsync(27 * 60_000);
  const now = Date.now();
  await set({ petAway: { portraits: { kind: "nap", id: "s1", startedAt: new Date(now).toISOString(), until: new Date(now + 15 * 60_000).toISOString(), taskId: null, taskTitle: null } } });
  await vi.advanceTimersByTimeAsync(4 * 60_000);
  expect(note()).toBeNull();

  // Nap over: the note comes.
  await set({ petAway: {} });
  await vi.advanceTimersByTimeAsync(L.NOTE_CHECK_MS + 1000);
  expect(note()).not.toBeNull();
});

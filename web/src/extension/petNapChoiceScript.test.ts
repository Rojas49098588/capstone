// @vitest-environment jsdom
// @vitest-environment-options {"url":"http://example.test/"}
// Runs the pet code (extension/content/pet.js, with its menu) and sends a pet to nap: it asks what
// you'll work on, lists its project's Today tasks then suggestions, and naps for the one you pick.
import { afterAll, expect, it, vi } from "vitest";
import "../../../extension/content/logic.js";

type Listener = (changes: Record<string, { newValue: unknown }>, area: string) => void;

const pet = (projectId: string, napTasks: unknown[]) => ({
  projectId, shortName: projectId, name: projectId, color: "#2d3a8c", petKind: "cat", mood: "Happy",
  recovering: false, idleRequirement: null, suggestion: null, celebration: null, furniture: [], napTasks,
});

const choices = [
  { taskId: "t1", title: "Pet nap logic", estimateMin: 45, group: "today" },
  { taskId: "t2", title: "Apple developer license", estimateMin: 20, group: "today" },
  { taskId: "t3", title: "Mac build workflow", estimateMin: 90, group: "suggested" },
];

afterAll(() => vi.useRealTimers());

it("asks what you'll work on, naps for the task you pick, and offers Just nap", async () => {
  const statuses = { updatedAt: new Date().toISOString(), pets: [pet("a", choices), pet("b", [])] };
  const store: Record<string, unknown> = { petStatuses: statuses };
  const messages: unknown[] = [];
  const listeners: Listener[] = [];
  (globalThis as unknown as { chrome: unknown }).chrome = {
    runtime: {
      id: "test",
      getURL: (path: string) => path,
      sendMessage: (m: unknown) => {
        messages.push(m);
        return Promise.resolve();
      },
    },
    storage: {
      local: {
        get: async () => ({ ...store }),
        set: async (v: Record<string, unknown>) => {
          Object.assign(store, v);
          const changes = Object.fromEntries(Object.entries(v).map(([k, newValue]) => [k, { newValue }]));
          listeners.forEach((f) => f(changes, "local"));
        },
      },
      onChanged: { addListener: (f: Listener) => listeners.push(f) },
    },
  };
  globalThis.requestAnimationFrame = () => 0;

  // @ts-expect-error plain browser scripts with no type declarations.
  await import("../../../extension/content/menu.js");
  // @ts-expect-error plain browser scripts with no type declarations.
  await import("../../../extension/content/pet.js");
  await new Promise((r) => setTimeout(r, 0));
  const root = document.getElementById("capstone-pet-host")?.shadowRoot as ShadowRoot;
  const petEls = [...root.querySelectorAll<HTMLElement>(".pet")];
  const talk = (i: number) => petEls[i].querySelector<HTMLElement>(".talk") as HTMLElement;
  const buttons = (el: HTMLElement) => [...el.querySelectorAll("button")].map((b) => b.textContent);
  const napFromMenu = (i: number) => {
    petEls[i].dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, composed: true }));
    const nap = [...root.querySelectorAll<HTMLButtonElement>(".pet-menu button")].find((b) => b.textContent?.startsWith("Nap"));
    nap?.click();
  };
  const click = (el: HTMLElement, label: string) =>
    [...el.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent?.startsWith(label))?.click();

  // Nap asks first: Today's tasks, then the suggestion, then Just nap. Nothing is sent yet.
  napFromMenu(0);
  expect(talk(0).classList.contains("show")).toBe(true);
  expect(talk(0).textContent).toContain("What are you going to work on while I nap?");
  expect(talk(0).textContent).toContain("Today");
  expect(talk(0).textContent).toContain("Suggested");
  expect(buttons(talk(0))).toEqual(["Pet nap logic45 min", "Apple developer license20 min", "Mac build workflow1 h 30 min", "Just nap"]);
  expect(messages).toEqual([]);

  // Picking the second Today task naps for that one.
  click(talk(0), "Apple developer license");
  expect(messages).toEqual([{ type: "nap", petId: "a", taskId: "t2" }]);
  expect(talk(0).classList.contains("show")).toBe(false);

  // Just nap: no task.
  napFromMenu(0);
  click(talk(0), "Just nap");
  expect(messages[messages.length - 1]).toEqual({ type: "nap", petId: "a", taskId: null });

  // Nothing to offer: it just naps.
  napFromMenu(1);
  expect(talk(1).classList.contains("show")).toBe(false);
  expect(messages[messages.length - 1]).toEqual({ type: "nap", petId: "b", taskId: null });

  // Left unanswered, the question goes away after a minute and no nap starts.
  vi.useFakeTimers();
  const before = messages.length;
  napFromMenu(0);
  expect(talk(0).classList.contains("show")).toBe(true);
  vi.advanceTimersByTime(60_000);
  expect(talk(0).classList.contains("show")).toBe(false);
  expect(messages.length).toBe(before);
});

// @vitest-environment jsdom
// @vitest-environment-options {"url":"http://overlay.test/"}
// Toys on the desktop app's pets (shop, toys and window spec): the pet menu's Toys item summons a toy
// next to its pet, swaps it, and Put away removes it. A toy also goes when its pet sleeps or leaves.
import { afterAll, expect, it, vi } from "vitest";
import "../../../extension/content/logic.js";

type Listener = (changes: Record<string, { newValue: unknown }>, area: string) => void;

const status = (projectId: string) => ({
  projectId, shortName: projectId, name: projectId, color: "#2d3a8c", petKind: "dog", mood: "Happy",
  recovering: false, idleRequirement: null, suggestion: null, celebration: null, furniture: [], napTasks: [], deadline: null, stage: "adult",
});

afterAll(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it("summons, swaps and puts away toys, one per pet, and clears a toy when its pet sleeps or leaves", async () => {
  vi.spyOn(Math, "random").mockReturnValue(0.99);
  const store: Record<string, unknown> = {
    petStatuses: { updatedAt: new Date().toISOString(), pets: [status("a"), status("b")], toys: ["focus-ball", "robo-mouse"] },
    petPrefs: { involvement: "moderate", nickname: "" },
  };
  const messages: { type: string }[] = [];
  const listeners: Listener[] = [];
  const set = async (v: Record<string, unknown>) => {
    Object.assign(store, v);
    const changes = Object.fromEntries(Object.entries(v).map(([k, newValue]) => [k, { newValue }]));
    listeners.forEach((f) => f(changes, "local"));
  };
  const g = globalThis as unknown as { chrome: unknown; PetSurface: string };
  g.chrome = {
    runtime: {
      id: "test",
      getURL: (path: string) => path,
      sendMessage: (m: { type: string }) => {
        messages.push(m);
        return Promise.resolve();
      },
    },
    storage: { local: { get: async () => ({ ...store }), set }, onChanged: { addListener: (f: Listener) => listeners.push(f) } },
  };
  g.PetSurface = "overlay";
  globalThis.requestAnimationFrame = () => 0;

  // @ts-expect-error plain browser scripts with no type declarations.
  await import("../../../extension/content/menu.js");
  // @ts-expect-error plain browser scripts with no type declarations.
  await import("../../../extension/content/pet.js");
  await new Promise((r) => setTimeout(r, 0));
  const root = document.getElementById("capstone-pet-host")?.shadowRoot as ShadowRoot;
  const petEls = () => [...root.querySelectorAll<HTMLElement>(".pet")];
  const toys = () => [...root.querySelectorAll<HTMLElement>(".pet-toy")];
  const menuButtons = () => [...root.querySelectorAll<HTMLButtonElement>(".pet-menu button")];
  const openMenu = (i: number) => petEls()[i].dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, composed: true }));
  const pick = (i: number, ...labels: string[]) => {
    openMenu(i);
    for (const label of labels) menuButtons().find((b) => b.textContent?.startsWith(label))?.click();
  };

  pick(0, "Toys", "Focus Ball");
  expect(toys().map((t) => [t.dataset.toy, t.dataset.pet])).toEqual([["focus-ball", "a"]]);
  expect(toys()[0].getAttribute("src")).toBe("assets/toys/focus-ball.svg");

  pick(0, "Toys", "Robo Mouse");
  expect(toys().map((t) => [t.dataset.toy, t.dataset.pet])).toEqual([["robo-mouse", "a"]]);

  pick(1, "Toys", "Focus Ball");
  expect(toys().map((t) => t.dataset.pet).sort()).toEqual(["a", "b"]);

  pick(0, "Put away");
  expect(toys().map((t) => t.dataset.pet)).toEqual(["b"]);

  // After a toy was put away, the pet's menu still opens.
  openMenu(0);
  expect(menuButtons().length).toBeGreaterThan(0);
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

  // Sleep from the menu takes the toy away.
  pick(1, "Sleep", "1 hour");
  expect(messages.some((m) => m.type === "sleep")).toBe(true);
  expect(toys()).toEqual([]);

  // A pet that leaves the statuses (its project deleted) takes its toy with it.
  pick(0, "Toys", "Focus Ball");
  expect(toys()).toHaveLength(1);
  await set({ petStatuses: { updatedAt: new Date().toISOString(), pets: [status("b")], toys: ["focus-ball"] } });
  expect(toys()).toEqual([]);

  // A pet hidden by "Pets on screen at once" takes its toy away too.
  await set({ petStatuses: { updatedAt: new Date().toISOString(), pets: [status("a"), status("b")], toys: ["focus-ball"] } });
  pick(1, "Toys", "Focus Ball");
  expect(toys().map((t) => t.dataset.pet)).toEqual(["b"]);
  await set({ petScreen: { limit: 1, order: "project" } });
  expect(petEls()[1].style.display).toBe("none");
  expect(toys()).toEqual([]);
});

it("has no Toys item on a web page", async () => {
  vi.resetModules();
  document.getElementById("capstone-pet-host")?.remove();
  const store: Record<string, unknown> = {
    petStatuses: { updatedAt: new Date().toISOString(), pets: [status("a")], toys: ["focus-ball"] },
  };
  const g = globalThis as unknown as { chrome: unknown; PetSurface: string };
  g.chrome = {
    runtime: { id: "test2", getURL: (path: string) => path, sendMessage: () => Promise.resolve() },
    storage: { local: { get: async () => ({ ...store }), set: async () => {} }, onChanged: { addListener: () => {} } },
  };
  g.PetSurface = "page";
  // @ts-expect-error plain browser scripts with no type declarations.
  await import("../../../extension/content/menu.js");
  // @ts-expect-error plain browser scripts with no type declarations.
  await import("../../../extension/content/pet.js");
  await new Promise((r) => setTimeout(r, 0));
  const root = document.getElementById("capstone-pet-host")?.shadowRoot as ShadowRoot;
  root.querySelector<HTMLElement>(".pet")!.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, composed: true }));
  const labels = [...root.querySelectorAll<HTMLButtonElement>(".pet-menu button")].map((b) => b.textContent);
  expect(labels.length).toBeGreaterThan(0);
  expect(labels.some((l) => l?.startsWith("Toys"))).toBe(false);
});

// @vitest-environment jsdom
// @vitest-environment-options {"url":"http://localhost:5173/"}
// Runs the pet code (extension/content/pet.js) in the desktop app's Studium window (PetSurface
// "habitat"): only the pet whose habitat box is on the page shows, the main process is told which
// box that is, and nothing is saved (the overlay owns positions; the preload copies Studium's data).
import { expect, it } from "vitest";
import "../../../extension/content/logic.js";

type Listener = (changes: Record<string, { newValue: unknown }>, area: string) => void;

const pet = (projectId: string) => ({
  projectId, shortName: projectId, name: projectId, color: "#2d3a8c", petKind: "cat", mood: "Happy",
  recovering: false, idleRequirement: null, suggestion: null, celebration: null, furniture: [],
});

it("shows only the pet whose habitat box is on the page, reports the box, and saves nothing", async () => {
  const statuses = { updatedAt: new Date().toISOString(), pets: [pet("a"), pet("b")] };
  // a is back from a nap and asks how it went; it's on the desktop, not in this page's habitat.
  const checkIn = { projectId: "a", taskId: null, taskTitle: null, minutes: 15, at: new Date().toISOString() };
  const store: Record<string, unknown> = { petStatuses: statuses, petCheckIn: checkIn };
  const sets: Record<string, unknown>[] = [];
  const messages: unknown[] = [];
  const listeners: Listener[] = [];
  const g = globalThis as unknown as { chrome: unknown; PetSurface: string };
  g.chrome = {
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
          sets.push(v);
          Object.assign(store, v);
          const changes = Object.fromEntries(Object.entries(v).map(([k, newValue]) => [k, { newValue }]));
          listeners.forEach((f) => f(changes, "local"));
        },
      },
      onChanged: { addListener: (f: Listener) => listeners.push(f) },
    },
  };
  // On a page this would be copied to petStatuses; in the habitat it must not be.
  localStorage.setItem("studium-pets-v1", JSON.stringify(statuses));
  g.PetSurface = "habitat";
  globalThis.requestAnimationFrame = () => 0;

  // @ts-expect-error pet.js is a plain browser script with no type declarations.
  await import("../../../extension/content/pet.js");
  await new Promise((r) => setTimeout(r, 0));
  const shownPets = () =>
    [...(document.getElementById("capstone-pet-host")?.shadowRoot?.querySelectorAll<HTMLElement>(".pet") ?? [])]
      .map((el, i) => (el.style.display !== "none" ? i : -1))
      .filter((i) => i >= 0);
  expect(shownPets()).toEqual([]);

  const box = document.createElement("div");
  box.dataset.petHabitat = "b";
  document.body.appendChild(box);
  await new Promise((r) => setTimeout(r, 0));
  expect(shownPets()).toEqual([1]);
  expect(messages[messages.length - 1]).toEqual({ type: "habitat", ids: ["b"] });
  expect(box.hasAttribute("data-pet-attached")).toBe(true);
  // b, in the habitat, doesn't ask about a's nap (a asks on the desktop).
  expect(document.getElementById("capstone-pet-host")?.shadowRoot?.querySelector(".talk.show")).toBeNull();

  box.remove();
  await new Promise((r) => setTimeout(r, 0));
  expect(shownPets()).toEqual([]);
  expect(messages[messages.length - 1]).toEqual({ type: "habitat", ids: [] });

  // A tab saves positions when it's hidden or left; the habitat never does.
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
  document.dispatchEvent(new Event("visibilitychange"));
  window.dispatchEvent(new Event("pagehide"));
  await new Promise((r) => setTimeout(r, 0));
  expect(sets).toEqual([]);
});

// @vitest-environment jsdom
// @vitest-environment-options {"url":"http://overlay.test/"}
// Runs the pet code (extension/content/pet.js) as the desktop app's overlay (PetSurface "overlay"):
// every pet roams except the one whose habitat shows in the Studium window, and it never copies
// Studium's data (the Studium window's preload does that).
import { expect, it } from "vitest";
import "../../../extension/content/logic.js";

type Listener = (changes: Record<string, { newValue: unknown }>, area: string) => void;

const pet = (projectId: string) => ({
  projectId, shortName: projectId, name: projectId, color: "#2d3a8c", petKind: "cat", mood: "Happy",
  recovering: false, idleRequirement: null, suggestion: null, celebration: null, furniture: [],
});

it("shows every pet except the one in the Studium habitat, and never copies Studium's data", async () => {
  const statuses = { updatedAt: new Date().toISOString(), pets: [pet("a"), pet("b")] };
  // a is back from a nap and asks how it went, but it's in its Studium habitat right now.
  const checkIn = { projectId: "a", taskId: null, taskTitle: null, minutes: 15, at: new Date().toISOString() };
  const store: Record<string, unknown> = { petStatuses: statuses, petHabitat: "a", petCheckIn: checkIn };
  const sets: Record<string, unknown>[] = [];
  const listeners: Listener[] = [];
  const g = globalThis as unknown as { chrome: unknown; PetSurface: string };
  g.chrome = {
    runtime: { id: "test", getURL: (path: string) => path, sendMessage: () => Promise.resolve() },
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
  // Studium's own data in this page's storage must be ignored here.
  localStorage.setItem("studium-pets-v1", JSON.stringify({ updatedAt: "", pets: [pet("z")] }));
  localStorage.setItem("studium-settings-v1", JSON.stringify({ petCount: 1 }));
  g.PetSurface = "overlay";
  globalThis.requestAnimationFrame = () => 0;

  // @ts-expect-error pet.js is a plain browser script with no type declarations.
  await import("../../../extension/content/pet.js");
  await new Promise((r) => setTimeout(r, 0));
  const shownPets = () =>
    [...(document.getElementById("capstone-pet-host")?.shadowRoot?.querySelectorAll<HTMLElement>(".pet") ?? [])]
      .map((el, i) => (el.style.display !== "none" ? i : -1))
      .filter((i) => i >= 0);
  expect(shownPets()).toEqual([1]);
  // The habitat asks; b on the desktop doesn't ask about a too.
  const asking = () =>
    [...(document.getElementById("capstone-pet-host")?.shadowRoot?.querySelectorAll<HTMLElement>(".pet") ?? [])]
      .map((el, i) => (el.querySelector(".talk.show") ? i : -1))
      .filter((i) => i >= 0);
  expect(asking()).toEqual([]);

  // The Studium window closed: its pet comes back to the desktop.
  await (g.chrome as { storage: { local: { set: (v: unknown) => Promise<void> } } }).storage.local.set({ petHabitat: null });
  await new Promise((r) => setTimeout(r, 0));
  expect(shownPets()).toEqual([0, 1]);
  expect(asking()).toEqual([0]); // back on the desktop, a asks itself

  for (const s of sets) {
    expect(Object.keys(s)).not.toContain("petStatuses");
    expect(Object.keys(s)).not.toContain("petScreen");
    expect(Object.keys(s)).not.toContain("petPrefs");
  }
});

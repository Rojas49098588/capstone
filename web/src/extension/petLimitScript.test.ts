// @vitest-environment jsdom
// @vitest-environment-options {"url":"http://localhost:5173/"}
// Runs the extension's content script (extension/content/pet.js) on the Studium page: it copies the
// "Pets on screen at once" setting and shows only that many pets.
import { expect, it } from "vitest";
import "../../../extension/content/logic.js";
import { DEFAULT_SETTINGS, saveSettings } from "../store/settings";

type Listener = (changes: Record<string, { newValue: unknown }>, area: string) => void;

const pet = (projectId: string) => ({
  projectId, shortName: projectId, name: projectId, color: "#2d3a8c", petKind: "cat", mood: "Happy",
  recovering: false, idleRequirement: null, suggestion: null, celebration: null, furniture: [],
});

it("shows at most the chosen number of pets, and all of them again for All pets", async () => {
  const statuses = { updatedAt: new Date().toISOString(), pets: [pet("a"), pet("b"), pet("c")] };
  const store: Record<string, unknown> = { petStatuses: statuses };
  const listeners: Listener[] = [];
  (globalThis as unknown as { chrome: unknown }).chrome = {
    runtime: { id: "test", getURL: (path: string) => path, sendMessage: () => Promise.resolve() },
    storage: {
      local: {
        get: async () => ({ ...store }),
        // Like chrome.storage: save, then tell every listener what changed.
        set: async (v: Record<string, unknown>) => {
          Object.assign(store, v);
          const changes = Object.fromEntries(Object.entries(v).map(([k, newValue]) => [k, { newValue }]));
          listeners.forEach((f) => f(changes, "local"));
        },
      },
      onChanged: { addListener: (f: Listener) => listeners.push(f) },
    },
  };
  localStorage.setItem("studium-pets-v1", JSON.stringify(statuses));
  saveSettings(localStorage, { ...DEFAULT_SETTINGS, petCount: 1 });
  globalThis.requestAnimationFrame = () => 0;

  // @ts-expect-error pet.js is a plain browser script with no type declarations.
  await import("../../../extension/content/pet.js");
  await new Promise((r) => setTimeout(r, 0));
  const shown = () =>
    [...(document.getElementById("capstone-pet-host")?.shadowRoot?.querySelectorAll<HTMLElement>(".pet") ?? [])].filter(
      (el) => el.style.display !== "none",
    ).length;
  expect(shown()).toBe(1);

  // Changing the setting in Studium updates the pets right away.
  saveSettings(localStorage, { ...DEFAULT_SETTINGS, petCount: 2 });
  await new Promise((r) => setTimeout(r, 0));
  expect(shown()).toBe(2);
  saveSettings(localStorage, DEFAULT_SETTINGS);
  await new Promise((r) => setTimeout(r, 0));
  expect(shown()).toBe(3);
});

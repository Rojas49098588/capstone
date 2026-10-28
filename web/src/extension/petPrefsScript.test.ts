// @vitest-environment jsdom
// @vitest-environment-options {"url":"http://localhost:5173/"}
// Runs the extension's content script on the Studium page: it copies "How much pets interact" and
// the nickname to the extension's storage, and follows changes.
import { expect, it } from "vitest";
import "../../../extension/content/logic.js";
import { DEFAULT_SETTINGS, saveSettings } from "../store/settings";

type Listener = (changes: Record<string, { newValue: unknown }>, area: string) => void;

it("copies the interaction level and nickname from Studium's settings", async () => {
  const store: Record<string, unknown> = {};
  const listeners: Listener[] = [];
  (globalThis as unknown as { chrome: unknown }).chrome = {
    runtime: { id: "test", getURL: (path: string) => path, sendMessage: () => Promise.resolve() },
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
  saveSettings(localStorage, { ...DEFAULT_SETTINGS, petInvolvement: "minimal", nickname: "Abby" });
  globalThis.requestAnimationFrame = () => 0;

  // @ts-expect-error pet.js is a plain browser script with no type declarations.
  await import("../../../extension/content/pet.js");
  await new Promise((r) => setTimeout(r, 0));
  expect(store.petPrefs).toEqual({ involvement: "minimal", nickname: "Abby" });

  saveSettings(localStorage, { ...DEFAULT_SETTINGS, petInvolvement: "moderate" });
  await new Promise((r) => setTimeout(r, 0));
  expect(store.petPrefs).toEqual({ involvement: "moderate", nickname: "" });
});

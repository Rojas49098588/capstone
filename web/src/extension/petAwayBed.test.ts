// @vitest-environment jsdom
// @vitest-environment-options {"url":"http://localhost:5173/"}
// Runs the extension's content script (extension/content/pet.js) on a Studium habitat page: an
// away pet sleeps in its bed even when the habitat box is laid out after the nap starts.
import { expect, it } from "vitest";
import "../../../extension/content/logic.js";

type Listener = (changes: Record<string, { newValue: unknown }>, area: string) => void;

it("an away pet stays in its bed when the habitat box is laid out (or resized) later", async () => {
  const now = Date.now();
  const statuses = {
    updatedAt: new Date(now).toISOString(),
    pets: [
      {
        projectId: "webDev", shortName: "webDev", name: "Web", color: "#2d3a8c", petKind: "cat", mood: "Happy",
        recovering: false, idleRequirement: null, suggestion: null, celebration: null,
        furniture: [{ use: "bed", slot: "floorLeft" }],
      },
    ],
  };
  const store: Record<string, unknown> = { petStatuses: statuses };
  const listeners: Listener[] = [];
  (globalThis as unknown as { chrome: unknown }).chrome = {
    runtime: { id: "test", getURL: (path: string) => path, sendMessage: () => Promise.resolve() },
    storage: {
      local: { get: async () => ({ ...store }), set: async (v: Record<string, unknown>) => void Object.assign(store, v) },
      onChanged: { addListener: (f: Listener) => listeners.push(f) },
    },
  };
  localStorage.setItem("studium-pets-v1", JSON.stringify(statuses));
  let frames: FrameRequestCallback[] = [];
  globalThis.requestAnimationFrame = (f: FrameRequestCallback) => frames.push(f);
  const tick = (n: number) => {
    for (let i = 0; i < n; i++) {
      const due = frames;
      frames = [];
      due.forEach((f) => f(performance.now()));
    }
  };

  // The habitat box, not laid out yet.
  let rect = { left: 100, top: 300, right: 100, bottom: 300, width: 0, height: 0 };
  const box = document.createElement("div");
  box.setAttribute("data-pet-habitat", "webDev");
  box.getBoundingClientRect = () => ({ ...rect, x: rect.left, y: rect.top, toJSON: () => ({}) }) as DOMRect;
  document.body.appendChild(box);

  // @ts-expect-error pet.js is a plain browser script with no type declarations.
  await import("../../../extension/content/pet.js");
  await new Promise((r) => setTimeout(r, 0));
  tick(2);

  // The worker sends the pet to nap, then the box gets its size.
  const away = {
    webDev: { kind: "nap", id: "n1", startedAt: new Date(now).toISOString(), until: new Date(now + 15 * 60_000).toISOString(), taskId: null, taskTitle: null },
  };
  store.petAway = away;
  listeners.forEach((f) => f({ petAway: { newValue: away } }, "local"));
  tick(2);
  rect = { left: 100, top: 300, right: 600, bottom: 524, width: 500, height: 224 };
  tick(2);

  const pet = document.getElementById("capstone-pet-host")?.shadowRoot?.querySelector(".pet") as HTMLElement;
  expect(pet.classList.contains("sleeping")).toBe(true);
  // The bed's spot (logic.js furnitureSpot): x = 0.18 * 500 - 46 / 2 = 67, y = 0.06 * 224 = 13.44,
  // drawn from the box's left (100) and above its bottom (768 - 524 = 244).
  expect(pet.style.transform).toBe(`translate(${100 + 67}px, ${-(window.innerHeight - 524 + 13.44)}px)`);
});

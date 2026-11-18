// @vitest-environment jsdom
// @vitest-environment-options {"url":"http://overlay.test/"}
// The Robo Mouse on the desktop app's pets (shop, toys and window spec): it scoots back and forth near
// its pet; now and then the pet pounces and catches it ("Got it!"), the mouse stops for a moment, then
// scoots on. Putting it away stops everything.
import { afterAll, expect, it, vi } from "vitest";
import "../../../extension/content/logic.js";

type Listener = (changes: Record<string, { newValue: unknown }>, area: string) => void;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const L = (globalThis as unknown as { PetLogic: any }).PetLogic;

const status = {
  projectId: "a", shortName: "a", name: "A", color: "#2d3a8c", petKind: "cat", mood: "Happy",
  recovering: false, idleRequirement: null, suggestion: null, celebration: null, furniture: [], napTasks: [], deadline: null, stage: "adult",
};

afterAll(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it("scoots near its pet, gets pounced on and caught, pauses, and stops when put away", async () => {
  vi.useFakeTimers({ now: new Date("2026-11-17T12:00:00"), toFake: ["Date", "setTimeout", "clearTimeout", "setInterval", "clearInterval", "performance"] });
  vi.spyOn(Math, "random").mockReturnValue(0.99);
  Object.defineProperty(window, "innerWidth", { value: 1200, configurable: true });
  Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
  const store: Record<string, unknown> = {
    petStatuses: { updatedAt: new Date().toISOString(), pets: [status], toys: ["robo-mouse"] },
    pets: { a: { xRatio: 0.5 } },
    petPrefs: { involvement: "moderate", nickname: "" },
  };
  const g = globalThis as unknown as { chrome: unknown; PetSurface: string };
  g.chrome = {
    runtime: { id: "test", getURL: (path: string) => path, sendMessage: () => Promise.resolve() },
    storage: { local: { get: async () => ({ ...store }), set: async () => {} }, onChanged: { addListener: (_f: Listener) => {} } },
  };
  g.PetSurface = "overlay";
  HTMLElement.prototype.setPointerCapture = () => {}; // missing in jsdom
  let next: FrameRequestCallback | null = null;
  globalThis.requestAnimationFrame = (cb) => {
    next = cb;
    return 1;
  };
  const frames = (n: number) => {
    for (let i = 0; i < n; i++) {
      vi.advanceTimersByTime(16);
      next?.(performance.now());
    }
  };

  // @ts-expect-error plain browser scripts with no type declarations.
  await import("../../../extension/content/menu.js");
  // @ts-expect-error plain browser scripts with no type declarations.
  await import("../../../extension/content/pet.js");
  await vi.advanceTimersByTimeAsync(0);
  const root = document.getElementById("capstone-pet-host")?.shadowRoot as ShadowRoot;
  const petEl = () => root.querySelector<HTMLElement>(".pet") as HTMLElement;
  const mouse = () => root.querySelector<HTMLElement>('.pet-toy[data-toy="robo-mouse"]');
  const xOf = (el: HTMLElement) => Number(/translate\((-?[\d.]+)px/.exec(el.style.transform)?.[1]);
  const bubble = () => petEl().querySelector<HTMLElement>(".bubble") as HTMLElement;

  frames(2);
  const petX = xOf(petEl());
  petEl().dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, composed: true }));
  for (const label of ["Toys", "Robo Mouse"]) [...root.querySelectorAll<HTMLButtonElement>(".pet-menu button")].find((b) => b.textContent?.startsWith(label))?.click();
  expect(mouse()).toBeTruthy();
  // It never takes clicks: the apps underneath get them.
  expect(mouse()!.style.pointerEvents).toBe("none");

  // It scoots on its own, staying near its pet and on screen.
  const start = xOf(mouse()!);
  const seen: number[] = [];
  for (let i = 0; i < 60; i++) {
    frames(1);
    seen.push(xOf(mouse()!));
  }
  expect(seen.some((x) => x !== start)).toBe(true);
  for (const x of seen) {
    expect(x).toBeGreaterThanOrEqual(0);
    expect(x).toBeLessThanOrEqual(1200 - 28);
    expect(Math.abs(x - petX)).toBeLessThan(L.ROBO_MOUSE.rangePx + 200);
  }

  // Not while the pet's menu is open: the menu would run off with the pet.
  petEl().dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, composed: true }));
  frames(Math.ceil((L.ROBO_MOUSE.pounceEveryMs[1] + 3000) / 16));
  expect(petEl().classList.contains("walking")).toBe(false);
  expect(bubble().textContent === L.toyCatchText && bubble().classList.contains("show")).toBe(false);
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  root.querySelector(".pet-menu")?.remove();
  document.body.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));

  // Within the longest wait (plus time to run over), the pet pounces and catches it.
  let caught = false;
  const limit = Math.ceil((L.ROBO_MOUSE.pounceEveryMs[1] + 6000) / 16);
  for (let i = 0; i < limit && !caught; i++) {
    frames(1);
    caught = bubble().classList.contains("show") && bubble().textContent === L.toyCatchText;
  }
  expect(caught).toBe(true);
  expect(L.toyCatchText).toBe("Got it!");

  // Caught: the mouse stands still for a moment, then scoots on.
  const held = xOf(mouse()!);
  frames(Math.floor(L.ROBO_MOUSE.pauseMs / 16) - 5);
  expect(xOf(mouse()!)).toBe(held);
  frames(40);
  expect(xOf(mouse()!)).not.toBe(held);

  // Clicked mid-pounce, it gives up that pounce but pounces again later.
  let running = false;
  for (let i = 0; i < limit && !running; i++) {
    frames(1);
    running = petEl().classList.contains("walking");
  }
  expect(running).toBe(true);
  petEl().dispatchEvent(new MouseEvent("pointerdown", { clientX: xOf(petEl()) + 10, clientY: 780, button: 0, bubbles: true, composed: true }));
  petEl().dispatchEvent(new MouseEvent("pointerup", { clientX: xOf(petEl()) + 10, clientY: 780, button: 0, bubbles: true, composed: true }));
  caught = false;
  for (let i = 0; i < limit && !caught; i++) {
    frames(1);
    caught = bubble().classList.contains("show") && bubble().textContent === L.toyCatchText;
  }
  expect(caught).toBe(true);

  // Put away: gone, and nothing more happens.
  petEl().dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, composed: true }));
  [...root.querySelectorAll<HTMLButtonElement>(".pet-menu button")].find((b) => b.textContent?.startsWith("Put away"))?.click();
  expect(mouse()).toBeNull();
  frames(Math.ceil((L.ROBO_MOUSE.pounceEveryMs[1] + 2000) / 16));
  expect(bubble().textContent === L.toyCatchText && bubble().classList.contains("show")).toBe(false);
});

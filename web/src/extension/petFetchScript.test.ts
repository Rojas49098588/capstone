// @vitest-environment jsdom
// @vitest-environment-options {"url":"http://overlay.test/"}
// The Focus Ball on the desktop app's pets (shop, toys and window spec): drag it and let go to throw;
// the pet runs to it, carries it back to where it was thrown from, and drops it. A click doesn't throw.
import { afterAll, expect, it, vi } from "vitest";
import "../../../extension/content/logic.js";

type Listener = (changes: Record<string, { newValue: unknown }>, area: string) => void;

const status = {
  projectId: "a", shortName: "a", name: "A", color: "#2d3a8c", petKind: "dog", mood: "Happy",
  recovering: false, idleRequirement: null, suggestion: null, celebration: null, furniture: [], napTasks: [], deadline: null, stage: "adult",
};

afterAll(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it("throws the ball, and the pet fetches it back; a click doesn't throw; dragging the pet drops the ball", async () => {
  vi.useFakeTimers({ now: new Date("2026-11-17T12:00:00"), toFake: ["Date", "setTimeout", "clearTimeout", "setInterval", "clearInterval", "performance"] });
  vi.spyOn(Math, "random").mockReturnValue(0.99);
  Object.defineProperty(window, "innerWidth", { value: 1200, configurable: true });
  Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
  const store: Record<string, unknown> = {
    petStatuses: { updatedAt: new Date().toISOString(), pets: [status], toys: ["focus-ball"] },
    pets: { a: { xRatio: 0.1 } },
    petPrefs: { involvement: "moderate", nickname: "" },
  };
  const listeners: Listener[] = [];
  const set = async (v: Record<string, unknown>) => {
    Object.assign(store, v);
    const changes = Object.fromEntries(Object.entries(v).map(([k, newValue]) => [k, { newValue }]));
    listeners.forEach((f) => f(changes, "local"));
  };
  const g = globalThis as unknown as { chrome: unknown; PetSurface: string };
  g.chrome = {
    runtime: { id: "test", getURL: (path: string) => path, sendMessage: () => Promise.resolve() },
    storage: { local: { get: async () => ({ ...store }), set }, onChanged: { addListener: (f: Listener) => listeners.push(f) } },
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
  const ball = () => root.querySelector<HTMLElement>('.pet-toy[data-toy="focus-ball"]') as HTMLElement;
  const xOf = (el: HTMLElement) => Number(/translate\((-?[\d.]+)px/.exec(el.style.transform)?.[1]);
  const pointer = (el: HTMLElement, type: string, x: number, y: number) =>
    el.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, button: 0, bubbles: true, composed: true }));

  petEl().dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, composed: true }));
  for (const label of ["Toys", "Focus Ball"]) [...root.querySelectorAll<HTMLButtonElement>(".pet-menu button")].find((b) => b.textContent?.startsWith(label))?.click();
  frames(2);
  expect(ball()).toBeTruthy();

  // A click without dragging doesn't throw.
  const before = xOf(ball());
  pointer(ball(), "pointerdown", before + 14, 786);
  pointer(ball(), "pointerup", before + 14, 786);
  frames(60);
  expect(xOf(ball())).toBe(before);

  // A cancelled drag (the system took the pointer) doesn't throw, and the ball stops following the cursor.
  pointer(ball(), "pointerdown", xOf(ball()) + 14, 786);
  pointer(window as unknown as HTMLElement, "pointermove", 500, 786);
  const dropped = xOf(ball());
  pointer(window as unknown as HTMLElement, "pointercancel", 500, 786);
  pointer(window as unknown as HTMLElement, "pointermove", 700, 786);
  frames(60);
  expect(xOf(ball())).toBe(dropped);

  // Drag from (300, floor) to (400, floor - 50) and let go: a throw to the right.
  pointer(ball(), "pointerdown", xOf(ball()) + 14, 786);
  vi.advanceTimersByTime(16);
  pointer(window as unknown as HTMLElement, "pointermove", 300, 786);
  vi.advanceTimersByTime(30);
  pointer(window as unknown as HTMLElement, "pointermove", 350, 760);
  vi.advanceTimersByTime(30);
  pointer(window as unknown as HTMLElement, "pointermove", 400, 736);
  pointer(window as unknown as HTMLElement, "pointerup", 400, 736);

  // It flies and lands to the right of where it was let go from.
  frames(120);
  const landed = xOf(ball());
  expect(landed).toBeGreaterThan(300);

  // The pet runs to it and picks it up: the ball then moves with the pet.
  let carried = false;
  for (let i = 0; i < 600 && !carried; i++) {
    frames(1);
    carried = ball().classList.contains("held");
  }
  expect(carried).toBe(true);
  // A held ball isn't drawn as the pet's carried sticky note (a yellow square in the middle of the screen).
  expect(ball().matches(".carried")).toBe(false);
  frames(5);
  const whileCarried = xOf(ball());
  frames(20);
  expect(xOf(ball())).not.toBe(whileCarried);

  // It brings it back near where it was let go (the ball's left edge about x = 386) and drops it.
  for (let i = 0; i < 900 && ball().classList.contains("held"); i++) frames(1);
  expect(ball().classList.contains("held")).toBe(false);
  expect(Math.abs(xOf(ball()) - 386)).toBeLessThan(80);

  // A second throw works the same.
  pointer(ball(), "pointerdown", xOf(ball()) + 14, 786);
  vi.advanceTimersByTime(16);
  pointer(window as unknown as HTMLElement, "pointermove", xOf(ball()) + 40, 770);
  vi.advanceTimersByTime(30);
  pointer(window as unknown as HTMLElement, "pointermove", xOf(ball()) + 120, 740);
  pointer(window as unknown as HTMLElement, "pointerup", xOf(ball()) + 120, 740);
  frames(120);
  carried = false;
  for (let i = 0; i < 600 && !carried; i++) {
    frames(1);
    carried = ball().classList.contains("held");
  }
  expect(carried).toBe(true);

  // Its mood changes while it carries the ball (the pets are rebuilt): the ball is dropped, and can be thrown again.
  await set({ petStatuses: { updatedAt: new Date().toISOString(), pets: [{ ...status, mood: "Worried" }], toys: ["focus-ball"] } });
  frames(2);
  expect(ball().classList.contains("held")).toBe(false);
  // Thrown left from where it was dropped (near the right edge), so the fetch is a long one.
  const from = xOf(ball());
  pointer(ball(), "pointerdown", from + 14, 786);
  vi.advanceTimersByTime(16);
  pointer(window as unknown as HTMLElement, "pointermove", from - 40, 770);
  vi.advanceTimersByTime(30);
  pointer(window as unknown as HTMLElement, "pointermove", from - 160, 740);
  pointer(window as unknown as HTMLElement, "pointerup", from - 160, 740);
  frames(20);
  carried = false;
  for (let i = 0; i < 600 && !carried; i++) {
    frames(1);
    carried = ball().classList.contains("held");
  }
  expect(carried).toBe(true);

  // Dragging the pet while it carries the ball drops the ball where the pet was; the pet stays draggable.
  const petX = xOf(petEl());
  pointer(petEl(), "pointerdown", petX + 20, 770);
  pointer(petEl(), "pointermove", petX + 80, 600);
  frames(2);
  expect(ball().classList.contains("held")).toBe(false);
  expect(Math.abs(xOf(ball()) - petX)).toBeLessThan(120);
  expect(petEl().classList.contains("dragging")).toBe(true);
  pointer(petEl(), "pointerup", petX + 80, 600);
});

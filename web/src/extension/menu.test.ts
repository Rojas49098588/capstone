// @vitest-environment jsdom
// Tests for the pet's right-click menu (extension/content/menu.js).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../../../extension/content/logic.js";
import "../../../extension/content/menu.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const G = globalThis as unknown as { PetLogic: any; PetMenu: any };
const M = G.PetMenu;

let host: HTMLElement;
let root: ShadowRoot;

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = host.attachShadow({ mode: "open" });
});

afterEach(() => {
  M.close();
  host.remove();
});

const items = (napHint?: string) =>
  G.PetLogic.petMenuItems("appDev", napHint ? { webDev: { kind: "nap", taskTitle: napHint } } : {}, null);
const menuItems = () => [...root.querySelectorAll('[role="menuitem"]')] as HTMLButtonElement[];
const byLabel = (label: string) => menuItems().find((b) => b.textContent?.includes(label)) as HTMLButtonElement;

describe("PetMenu", () => {
  it("renders the items as a menu and focuses the first", () => {
    M.open(root, { x: 10, y: 10 }, items(), vi.fn());
    expect(root.querySelector('[role="menu"]')).not.toBeNull();
    expect(menuItems().map((b) => b.textContent)).toEqual(["What should I work on?", "Nap (15 min)", "Sleep ▸", "Open project"]);
    expect(root.activeElement).toBe(menuItems()[0]);
    expect(M.isOpen()).toBe(true);
  });

  it("a disabled item shows its hint and can't be picked", () => {
    const onPick = vi.fn();
    M.open(root, { x: 10, y: 10 }, items("Push"), onPick);
    const nap = byLabel("Nap");
    expect(nap.getAttribute("aria-disabled")).toBe("true");
    expect(nap.textContent).toContain("Already focusing on Push");
    nap.click();
    expect(onPick).not.toHaveBeenCalled();
    expect(M.isOpen()).toBe(true);
  });

  it("Sleep opens its choices", () => {
    const onPick = vi.fn();
    M.open(root, { x: 10, y: 10 }, items(), onPick);
    const sleep = byLabel("Sleep");
    expect(sleep.getAttribute("aria-expanded")).toBe("false");
    expect(byLabel("2 hours")).toBeUndefined();
    sleep.click();
    expect(sleep.getAttribute("aria-expanded")).toBe("true");
    byLabel("1 hour");
    byLabel("2 hours").click();
    expect(onPick).toHaveBeenCalledWith("sleep2");
    expect(M.isOpen()).toBe(false);
  });

  it("picking an item calls back and closes", () => {
    const onPick = vi.fn();
    M.open(root, { x: 10, y: 10 }, items(), onPick);
    byLabel("Open project").click();
    expect(onPick).toHaveBeenCalledWith("open");
    expect(M.isOpen()).toBe(false);
    expect(root.querySelector('[role="menu"]')).toBeNull();
  });

  it("closes on Escape, on a click outside and on scroll, but not on a click inside", () => {
    const outside: Array<() => void> = [
      () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })),
      () => document.body.dispatchEvent(new Event("pointerdown", { bubbles: true, composed: true })),
      () => window.dispatchEvent(new Event("scroll")),
    ];
    for (const act of outside) {
      M.open(root, { x: 10, y: 10 }, items(), vi.fn());
      byLabel("Sleep").dispatchEvent(new Event("pointerdown", { bubbles: true, composed: true }));
      expect(M.isOpen()).toBe(true);
      act();
      expect(M.isOpen()).toBe(false);
    }
  });

  it("opening again replaces the open menu", () => {
    M.open(root, { x: 10, y: 10 }, items(), vi.fn());
    M.open(root, { x: 20, y: 20 }, items(), vi.fn());
    expect(root.querySelectorAll('[role="menu"]')).toHaveLength(1);
  });

  it("brings STYLE for the shadow root", () => {
    expect(M.STYLE).toContain(".pet-menu");
  });
});

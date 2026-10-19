// @vitest-environment jsdom
// @vitest-environment-options {"url": "http://localhost:5173/"}
// Tests for the Studium page bridge (extension/content/bridge.js): it delivers finished naps from
// chrome.storage to Studium and forwards Studium's answers and Wake button to the worker.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../../../extension/content/logic.js";

type Listener = (changes: Record<string, unknown>, area: string) => void;

const session = (id: string, o: Record<string, unknown> = {}) => ({
  id,
  projectId: "webDev",
  taskId: "webDev-t5",
  startedAt: "2026-10-19T12:00:00.000Z",
  at: "2026-10-19T12:15:00.000Z",
  minutes: 15,
  ...o,
});

let outbox: Record<string, unknown>;
let storageListeners: Listener[];
let sendMessage: ReturnType<typeof vi.fn>;
let delivered: unknown[][];
const onSessions = (e: Event) => delivered.push(JSON.parse((e as CustomEvent).detail));

function fakeChrome() {
  sendMessage = vi.fn(() => Promise.resolve());
  (globalThis as unknown as { chrome: unknown }).chrome = {
    runtime: { id: "test", sendMessage },
    storage: {
      local: { get: async () => ({ focusOutbox: outbox }) },
      onChanged: { addListener: (fn: Listener) => storageListeners.push(fn) },
    },
  };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

async function loadBridge() {
  vi.resetModules();
  // @ts-expect-error bridge.js is a plain browser script with no type declarations.
  await import("../../../extension/content/bridge.js");
  await flush();
}

beforeEach(() => {
  outbox = {};
  storageListeners = [];
  delivered = [];
  fakeChrome();
  window.addEventListener("studium:focus-sessions", onSessions);
});

afterEach(() => {
  window.removeEventListener("studium:focus-sessions", onSessions);
  (globalThis as unknown as { CapstoneBridge?: AbortController }).CapstoneBridge?.abort();
});

describe("bridge.js on the Studium page", () => {
  it("sends the outbox to the page when it loads, leaving out damaged entries", async () => {
    outbox = { s1: session("s1"), bad: session("bad", { minutes: -4 }) };
    await loadBridge();
    expect(delivered).toEqual([[session("s1")]]);
  });

  it("sends nothing when the outbox is empty", async () => {
    await loadBridge();
    expect(delivered).toEqual([]);
  });

  it("sends again when the page is ready and when the outbox changes", async () => {
    outbox = { s1: session("s1") };
    await loadBridge();
    window.dispatchEvent(new Event("studium:ready"));
    await flush();
    outbox = { s1: session("s1"), s2: session("s2") };
    for (const fn of storageListeners) fn({ focusOutbox: { newValue: outbox } }, "local");
    await flush();
    expect(delivered.map((d) => d.length)).toEqual([1, 1, 2]);
  });

  it("confirms what the page saved", async () => {
    await loadBridge();
    window.dispatchEvent(new CustomEvent("studium:focus-received", { detail: '["s1"]' }));
    expect(sendMessage).toHaveBeenCalledWith({ type: "delivered", ids: ["s1"] });
    sendMessage.mockClear();
    window.dispatchEvent(new CustomEvent("studium:focus-received", { detail: "{broken" }));
    window.dispatchEvent(new CustomEvent("studium:focus-received", { detail: "[1]" }));
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("forwards Wake from the habitat", async () => {
    await loadBridge();
    window.dispatchEvent(new CustomEvent("studium:wake-pet", { detail: "webDev" }));
    expect(sendMessage).toHaveBeenCalledWith({ type: "wake", projectId: "webDev" });
  });

  it("a newer copy replaces the old one", async () => {
    outbox = { s1: session("s1") };
    await loadBridge();
    await loadBridge();
    delivered = [];
    window.dispatchEvent(new Event("studium:ready"));
    await flush();
    expect(delivered).toHaveLength(1);
  });

  it("stops quietly without the extension's APIs", async () => {
    (globalThis as unknown as { chrome: unknown }).chrome = { runtime: {} };
    await loadBridge();
    window.dispatchEvent(new Event("studium:ready"));
    await flush();
    expect(delivered).toEqual([]);
  });
});

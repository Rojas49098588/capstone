import { describe, expect, it } from 'vitest';
import { makeChrome } from '../src/overlay/chromeShim.js';

function fakeBridge() {
  const calls = [];
  let listener = null;
  return {
    calls,
    fire: (changes) => listener?.(changes),
    get: (keys) => {
      calls.push(['get', keys]);
      return Promise.resolve({ pets: { a: { xRatio: 0.2 } } });
    },
    set: (patch) => calls.push(['set', patch]),
    send: (msg) => calls.push(['send', msg]),
    onChanged: (fn) => {
      listener = fn;
    },
  };
}

describe('makeChrome', () => {
  it('has a runtime id (pet.js stops without one)', () => {
    expect(makeChrome(fakeBridge()).runtime.id).toBeTruthy();
  });

  it('points pet art at studium://pets/', () => {
    const chrome = makeChrome(fakeBridge());
    expect(chrome.runtime.getURL('assets/pets/cat.png')).toBe('studium://pets/assets/pets/cat.png');
    expect(chrome.runtime.getURL('/assets/pets/cat.png')).toBe('studium://pets/assets/pets/cat.png');
  });

  it('storage.local.get answers from the main process', async () => {
    const bridge = fakeBridge();
    await expect(makeChrome(bridge).storage.local.get(['pets'])).resolves.toEqual({ pets: { a: { xRatio: 0.2 } } });
    expect(bridge.calls).toEqual([['get', ['pets']]]);
  });

  it('set and sendMessage pass their argument on and resolve undefined', async () => {
    const bridge = fakeBridge();
    const chrome = makeChrome(bridge);
    await expect(chrome.storage.local.set({ petNoteAt: 1 })).resolves.toBeUndefined();
    await expect(chrome.runtime.sendMessage({ type: 'wake', projectId: 'a' })).resolves.toBeUndefined();
    expect(bridge.calls).toEqual([
      ['set', { petNoteAt: 1 }],
      ['send', { type: 'wake', projectId: 'a' }],
    ]);
  });

  it("onChanged listeners are called like chrome.storage's, with the area 'local'", () => {
    const bridge = fakeBridge();
    const got = [];
    makeChrome(bridge).storage.onChanged.addListener((changes, area) => got.push([changes, area]));
    bridge.fire({ petAway: { newValue: {} } });
    expect(got).toEqual([[{ petAway: { newValue: {} } }, 'local']]);
  });
});

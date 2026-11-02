import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createStore, STATE_KEYS } from '../src/main/store.js';

let file;
beforeEach(() => {
  file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'studium-store-')), 'pet-state.json');
});

describe('createStore', () => {
  it('starts empty when there is no file', () => {
    expect(createStore({ file }).get()).toEqual({});
  });

  it('keeps what was set across a restart', () => {
    createStore({ file }).set({ petHidden: true });
    expect(createStore({ file }).get().petHidden).toBe(true);
  });

  it('knows the keys the extension kept in chrome.storage.local', () => {
    expect(STATE_KEYS).toEqual(['petStatuses', 'petPrefs', 'petScreen', 'petAway', 'petCheckIn', 'focusOutbox', 'petNoteAt', 'pets', 'petHidden', 'petTimingOverride', 'petOpenAt', 'loginQuiet']);
  });

  it('ignores unknown keys', () => {
    const store = createStore({ file });
    const listener = vi.fn();
    store.onChange(listener);
    store.set({ bogus: 1 });
    expect(store.get()).toEqual({});
    expect(fs.existsSync(file)).toBe(false);
    expect(listener).not.toHaveBeenCalled();
  });

  it('tells listeners which keys changed, and only when something changed', () => {
    const store = createStore({ file });
    const listener = vi.fn();
    store.onChange(listener);
    store.set({ petAway: { webDev: { kind: 'nap', until: 1 } } });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0]).toEqual(['petAway']);
    expect(listener.mock.calls[0][1].petAway).toEqual({ webDev: { kind: 'nap', until: 1 } });
    store.set({ petAway: { webDev: { kind: 'nap', until: 1 } } });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('stops calling a listener after it unsubscribes', () => {
    const store = createStore({ file });
    const listener = vi.fn();
    const off = store.onChange(listener);
    off();
    store.set({ petHidden: true });
    expect(listener).not.toHaveBeenCalled();
  });

  it('returns a copy, so callers cannot change the state by accident', () => {
    const store = createStore({ file });
    store.get().petHidden = true;
    expect(store.get().petHidden).toBeUndefined();
  });

  it('sets a damaged file aside and starts empty', () => {
    fs.writeFileSync(file, '{"petHidden": tru');
    const store = createStore({ file });
    expect(store.get()).toEqual({});
    expect(fs.readFileSync(file + '.damaged', 'utf8')).toBe('{"petHidden": tru');
    store.set({ petHidden: false });
    expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toEqual({ petHidden: false });
  });

  it('treats JSON that is not an object as damaged', () => {
    for (const text of ['[1,2]', '"text"', 'null']) {
      fs.writeFileSync(file, text);
      expect(createStore({ file }).get()).toEqual({});
      expect(fs.readFileSync(file + '.damaged', 'utf8')).toBe(text);
    }
  });

  it('drops unknown keys found in the file', () => {
    fs.writeFileSync(file, JSON.stringify({ petHidden: true, bogus: 1 }));
    expect(createStore({ file }).get()).toEqual({ petHidden: true });
  });

  it('keeps the old file if a save fails, and still applies the change in memory', () => {
    createStore({ file }).set({ petHidden: true });
    const failing = { ...fs, renameSync: () => { throw new Error('disk full'); } };
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const store = createStore({ file, fs: failing });
    store.set({ petHidden: false });
    expect(store.get().petHidden).toBe(false);
    expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toEqual({ petHidden: true });
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});

describe('loginQuiet', () => {
  it('is kept across a reload (a Mac login start reads it)', () => {
    createStore({ file }).set({ loginQuiet: true });
    expect(createStore({ file }).get().loginQuiet).toBe(true);
  });
});

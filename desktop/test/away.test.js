import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../extension/content/logic.js';
import { createStore } from '../src/main/store.js';
import { createAwayRunner } from '../src/main/away.js';

// logic.js is a plain script that sets globalThis.PetLogic.
const L = globalThis.PetLogic;
const T0 = Date.parse('2026-10-30T12:00:00Z');
const MIN = 60000;

const statuses = {
  pets: [{ projectId: 'webDev', shortName: 'webDev', name: 'Web Development Portfolio', color: '#2d3a8c', petKind: 'pigeon', mood: 'Happy', recovering: false, idleRequirement: null }],
};

let store;
let open;
let runner;
let ids;
// Requests run one at a time, so an ignored request resolves after everything queued before it.
const settle = () => runner.request({ type: 'none' });

function awayEntry(untilMs, kind = 'nap') {
  return { kind, id: 'nap-1', startedAt: new Date(T0 - 10 * MIN).toISOString(), until: new Date(untilMs).toISOString(), taskId: null, taskTitle: null };
}

beforeEach(() => {
  vi.useFakeTimers({ now: T0 });
  store = createStore({ file: path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'studium-away-')), 'pet-state.json') });
  store.set({ petStatuses: statuses });
  open = vi.fn();
  ids = 0;
  runner = createAwayRunner({ store, L, open, newId: () => `id-${++ids}` });
});

afterEach(() => {
  runner.dispose();
  vi.useRealTimers();
});

describe('createAwayRunner', () => {
  it('ends a nap after 15 minutes and leaves its session for Studium', async () => {
    await runner.request({ type: 'nap', projectId: 'webDev' });
    expect(store.get().petAway.webDev.kind).toBe('nap');
    await vi.advanceTimersByTimeAsync(15 * MIN);
    await settle();
    expect(store.get().petAway).toEqual({});
    const sessions = Object.values(store.get().focusOutbox);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({ projectId: 'webDev', minutes: 15 });
  });

  it('uses the shortened nap from petTimingOverride', async () => {
    store.set({ petTimingOverride: { napMinutes: 1 } });
    await runner.request({ type: 'nap', projectId: 'webDev' });
    await vi.advanceTimersByTimeAsync(MIN);
    await settle();
    expect(store.get().petAway).toEqual({});
  });

  it('wakes a pet early and cancels its timer', async () => {
    await runner.request({ type: 'nap', projectId: 'webDev' });
    await vi.advanceTimersByTimeAsync(5 * MIN);
    await runner.request({ type: 'wake', projectId: 'webDev' });
    expect(store.get().petAway).toEqual({});
    await vi.advanceTimersByTimeAsync(15 * MIN);
    await settle();
    expect(Object.values(store.get().focusOutbox)).toHaveLength(1);
    expect(Object.values(store.get().focusOutbox)[0].minutes).toBe(5);
  });

  it('ends a nap that finished while the app was closed', async () => {
    store.set({ petAway: { webDev: awayEntry(T0 - MIN) } });
    await runner.request({ type: 'endOverdue' });
    expect(store.get().petAway).toEqual({});
    expect(Object.keys(store.get().focusOutbox)).toEqual(['nap-1']);
  });

  it('re-arms a nap that is still running when the app starts', async () => {
    store.set({ petAway: { webDev: awayEntry(T0 + 5 * MIN) } });
    await runner.request({ type: 'endOverdue' });
    expect(store.get().petAway.webDev).toBeDefined();
    await vi.advanceTimersByTimeAsync(5 * MIN - 1);
    await settle();
    expect(store.get().petAway.webDev).toBeDefined();
    await vi.advanceTimersByTimeAsync(1);
    await settle();
    expect(store.get().petAway).toEqual({});
  });

  it('removes sessions Studium has saved', async () => {
    store.set({ petAway: { webDev: awayEntry(T0 - MIN) } });
    await runner.request({ type: 'endOverdue' });
    await runner.request({ type: 'delivered', ids: ['nap-1'] });
    expect(store.get().focusOutbox).toEqual({});
  });

  it('opens the project when a check-in is answered "done"', async () => {
    store.set({ petCheckIn: { projectId: 'webDev', taskId: null, taskTitle: null, minutes: 15, at: new Date(T0).toISOString() } });
    await runner.request({ type: 'checkIn', answer: 'done' });
    expect(open).toHaveBeenCalledWith('project=webDev');
    expect(store.get().petCheckIn).toBe(null);
  });

  it('runs requests in order, each seeing the one before', async () => {
    const first = runner.request({ type: 'nap', projectId: 'webDev' });
    const second = runner.request({ type: 'wake', projectId: 'webDev' });
    await Promise.all([first, second]);
    expect(store.get().petAway).toEqual({});
    expect(Object.values(store.get().focusOutbox)).toHaveLength(1);
  });

  it('stops its timers when disposed', async () => {
    await runner.request({ type: 'nap', projectId: 'webDev' });
    runner.dispose();
    await vi.advanceTimersByTimeAsync(15 * MIN);
    expect(store.get().petAway.webDev).toBeDefined();
  });
});

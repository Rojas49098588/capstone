import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '../../extension/content/logic.js';
import { createStore } from '../src/main/store.js';
import { handleStudium } from '../src/main/bridge.js';

const L = globalThis.PetLogic;
const pet = { projectId: 'webDev', shortName: 'webDev', name: 'Web Development Portfolio', color: '#2d3a8c', petKind: 'pigeon', mood: 'Happy', recovering: false, idleRequirement: null };
const session = (id) => ({ id, projectId: 'webDev', taskId: null, startedAt: '2026-10-30T12:00:00.000Z', at: '2026-10-30T12:15:00.000Z', minutes: 15 });

let store;
let requests;
let sendSessions;
let deps;
let applyLoginItem;

beforeEach(() => {
  store = createStore({ file: path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'studium-bridge-')), 'pet-state.json') });
  requests = [];
  sendSessions = vi.fn();
  applyLoginItem = vi.fn();
  deps = { store, L, sendSessions, applyLoginItem, runner: { request: (r) => requests.push(r) } };
});

describe('handleStudium', () => {
  it('keeps the old statuses when Studium sends damaged ones', () => {
    store.set({ petStatuses: { pets: [] } });
    handleStudium('studium:statuses', '{oops', deps);
    handleStudium('studium:statuses', null, deps);
    expect(store.get().petStatuses).toEqual({ pets: [] });
  });

  it('saves usable statuses', () => {
    handleStudium('studium:statuses', JSON.stringify({ pets: [pet] }), deps);
    expect(store.get().petStatuses.pets[0].projectId).toBe('webDev');
  });

  it('turns settings into the pet prefs and screen settings', () => {
    handleStudium('studium:settings', JSON.stringify({ petInvolvement: 'moderate', petCount: 2 }), deps);
    expect(store.get().petPrefs.involvement).toBe('moderate');
    expect(store.get().petScreen).toEqual(L.screenFromSettings(JSON.stringify({ petInvolvement: 'moderate', petCount: 2 })));
  });

  it('turns starting with the computer on or off from the settings', () => {
    handleStudium('studium:settings', JSON.stringify({ startWithComputer: false }), deps);
    handleStudium('studium:settings', null, deps);
    expect(applyLoginItem.mock.calls).toEqual([[false, false], [true, false]]);
  });

  it('passes on a quiet start from the settings', () => {
    handleStudium('studium:settings', JSON.stringify({ startQuietly: true }), deps);
    expect(applyLoginItem.mock.calls).toEqual([[true, true]]);
  });

  it('sends every waiting session when Studium is ready', () => {
    store.set({ focusOutbox: { a: session('a'), b: session('b') } });
    handleStudium('studium:ready', undefined, deps);
    expect(sendSessions).toHaveBeenCalledWith([session('a'), session('b')]);
  });

  it('passes saved ids and Wake to the nap runner', () => {
    handleStudium('studium:delivered', ['a'], deps);
    handleStudium('studium:wake', 'webDev', deps);
    expect(requests).toEqual([{ type: 'delivered', ids: ['a'] }, { type: 'wake', projectId: 'webDev' }]);
  });

  it('passes a checked-off task to the nap runner', () => {
    handleStudium('studium:task-done', 't1', deps);
    handleStudium('studium:task-done', '', deps);
    expect(requests).toEqual([{ type: 'taskDone', taskId: 't1' }]);
  });

  it('ignores bad requests and unknown channels', () => {
    handleStudium('studium:delivered', [1], deps);
    handleStudium('studium:wake', '', deps);
    handleStudium('studium:nope', 'x', deps);
    expect(requests).toEqual([]);
  });
});

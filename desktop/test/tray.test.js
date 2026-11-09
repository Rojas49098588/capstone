import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import '../../extension/content/logic.js';
import { createStore } from '../src/main/store.js';
import { handleTrayClick, trayItems, trayOpensOnClick, trayTooltip } from '../src/main/tray.js';

const L = globalThis.PetLogic;
const pet = { projectId: 'webDev', shortName: 'webDev', name: 'Web Development Portfolio', color: '#2d3a8c', petKind: 'pigeon', mood: 'Happy', recovering: false, idleRequirement: null };
const statuses = L.parseStatuses({ pets: [pet] });
const napping = { webDev: { kind: 'nap', id: 'n1', startedAt: '2026-10-30T12:00:00.000Z', until: '2026-10-30T12:15:00.000Z', taskId: null, taskTitle: null } };

describe('trayItems', () => {
  it('has Open, Hide pets, Reload pets and Quit when no pet is away', () => {
    expect(trayItems(L, { statuses: null, away: {}, hidden: false })).toEqual([
      { id: 'open', label: 'Open Studium' },
      { id: 'toggle-pets', label: 'Hide pets' },
      { id: 'reload-pets', label: 'Reload pets' },
      { type: 'separator' },
      { id: 'quit', label: 'Quit Studium' },
    ]);
  });

  it('offers Show pets while they are hidden', () => {
    expect(trayItems(L, { statuses: null, away: {}, hidden: true })[1]).toEqual({ id: 'toggle-pets', label: 'Show pets' });
  });

  it('lists a Wake item for each away pet', () => {
    const items = trayItems(L, { statuses, away: napping, hidden: false });
    expect(items[3]).toEqual({ id: 'wake:webDev', label: 'Wake webDev' });
    expect(items[4]).toEqual({ type: 'separator' });
  });
});

describe('trayTooltip', () => {
  it('says how to get a pet when there are none', () => {
    expect(trayTooltip(null)).toBe('Studium: no pets yet. Create a project to get one.');
    expect(trayTooltip({ pets: [] })).toBe('Studium: no pets yet. Create a project to get one.');
  });

  it('is just the name once there are pets', () => {
    expect(trayTooltip(statuses)).toBe('Studium');
  });
});

describe('handleTrayClick', () => {
  const setup = () => {
    const store = createStore({ file: path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'studium-tray-')), 'pet-state.json') });
    const deps = { store, runner: { request: vi.fn() }, open: vi.fn(), quit: vi.fn(), reloadPets: vi.fn() };
    return deps;
  };

  it('toggles the pets', () => {
    const deps = setup();
    handleTrayClick('toggle-pets', deps);
    expect(deps.store.get().petHidden).toBe(true);
    handleTrayClick('toggle-pets', deps);
    expect(deps.store.get().petHidden).toBe(false);
  });

  it('wakes a pet', () => {
    const deps = setup();
    handleTrayClick('wake:webDev', deps);
    expect(deps.runner.request).toHaveBeenCalledWith({ type: 'wake', petId: 'webDev' });
  });

  it('opens Studium and quits', () => {
    const deps = setup();
    handleTrayClick('open', deps);
    handleTrayClick('quit', deps);
    expect(deps.open).toHaveBeenCalledTimes(1);
    expect(deps.quit).toHaveBeenCalledTimes(1);
  });

  it('reloads the pets', () => {
    const deps = setup();
    handleTrayClick('reload-pets', deps);
    expect(deps.reloadPets).toHaveBeenCalledTimes(1);
  });
});

describe('trayOpensOnClick', () => {
  it('a Mac menu bar click opens the menu, not the window', () => {
    expect(trayOpensOnClick('darwin')).toBe(false);
  });

  it('a Windows tray click opens Studium', () => {
    expect(trayOpensOnClick('win32')).toBe(true);
  });
});

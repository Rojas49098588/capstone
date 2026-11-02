import { describe, expect, it, vi } from 'vitest';
import '../../extension/content/logic.js';
import { createOpenProjectTimer } from '../src/main/mischief.js';

// logic.js is a plain script that sets globalThis.PetLogic.
const L = globalThis.PetLogic;
const T0 = Date.parse('2026-11-02T09:00:00Z');
const MIN = 60000;

function fakeStore(extra = {}) {
  let state = {
    petStatuses: { updatedAt: '', pets: [{ projectId: 'p1', shortName: 'p1', name: 'P1', petKind: 'cat', mood: 'Sick' }] },
    petPrefs: { involvement: 'moderate', nickname: '' },
    ...extra,
  };
  return { get: () => ({ ...state }), set: (patch) => (state = { ...state, ...patch }) };
}

function setup({ store = fakeStore(), showing = () => false, opens = true, startedAt = T0 } = {}) {
  let now = startedAt;
  const openQuietly = vi.fn(async () => opens);
  const timer = createOpenProjectTimer({
    store, L, isStudiumShowing: showing, openQuietly,
    now: () => now, setTimer: () => 0, clearTimer: () => {}, startedAt,
  });
  return { store, openQuietly, timer, at: (min) => (now = startedAt + min * MIN) };
}

describe('createOpenProjectTimer', () => {
  it('waits 30 minutes after starting, then opens the sick pet\'s project once', async () => {
    const { store, openQuietly, timer, at } = setup();
    at(29);
    await timer.tick();
    expect(openQuietly).not.toHaveBeenCalled();
    at(31);
    await timer.tick();
    expect(openQuietly).toHaveBeenCalledWith('project=p1');
    expect(store.get().petOpenAt).toBe(T0 + 31 * MIN);
  });

  it('at most once every 2 hours, even across a restart', async () => {
    const { store, openQuietly, timer, at } = setup();
    at(31);
    await timer.tick();
    at(100);
    await timer.tick();
    expect(openQuietly).toHaveBeenCalledTimes(1);

    // Restarted at minute 100 with the same saved state: still waits for the 2 hours.
    const again = setup({ store, startedAt: T0 + 60 * MIN });
    again.at(90); // T0 + 150 min
    await again.timer.tick();
    expect(again.openQuietly).not.toHaveBeenCalled();
    again.at(92); // T0 + 152 min: 2 h 1 min after the last open
    await again.timer.tick();
    expect(again.openQuietly).toHaveBeenCalledTimes(1);
  });

  it('Studium showing pushes the next open 30 minutes later', async () => {
    let showing = false;
    const { openQuietly, timer, at } = setup({ showing: () => showing });
    showing = true;
    at(40);
    await timer.tick();
    showing = false;
    at(69);
    await timer.tick();
    expect(openQuietly).not.toHaveBeenCalled();
    at(71);
    await timer.tick();
    expect(openQuietly).toHaveBeenCalledTimes(1);
  });

  it('saves nothing when Studium could not be shown quietly (minimized)', async () => {
    const { store, timer, at } = setup({ opens: false });
    at(31);
    await timer.tick();
    expect(store.get().petOpenAt).toBeUndefined();
  });

  it('nothing on Mild', async () => {
    const { openQuietly, timer, at } = setup({ store: fakeStore({ petPrefs: { involvement: 'mild', nickname: '' } }) });
    at(31);
    await timer.tick();
    expect(openQuietly).not.toHaveBeenCalled();
  });

  it("opens a sick bought pet's project at its habitat", async () => {
    const store = fakeStore({
      petStatuses: { updatedAt: '', pets: [
        { projectId: 'p1', shortName: 'p1', name: 'P1', petKind: 'cat', mood: 'Happy' },
        { projectId: 'p1', petId: 'x1', shortName: 'Frog', name: 'P1', petKind: 'frog', mood: 'Sick' },
      ] },
    });
    const { openQuietly, timer, at } = setup({ store });
    at(31);
    await timer.tick();
    expect(openQuietly).toHaveBeenCalledWith('project=p1&pet=x1');
  });
});

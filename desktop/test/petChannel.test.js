import { describe, expect, it, vi } from 'vitest';
import '../../extension/content/logic.js';
import { READABLE_KEYS, changesFor, cleanPetWrite, handlePetMessage, readPetState } from '../src/main/petChannel.js';

// logic.js is a plain script that sets globalThis.PetLogic.
const L = globalThis.PetLogic;

describe('readPetState', () => {
  const state = { pets: { a: { xRatio: 0.5 } }, petStatuses: { updatedAt: '', pets: [] }, petHidden: true, secret: 1 };

  it('gives only the asked-for readable keys', () => {
    expect(readPetState(state, ['pets', 'secret'], 'p1')).toEqual({ pets: { a: { xRatio: 0.5 } } });
  });

  it('gives every readable key that has a value when no keys are asked for, plus the live habitat', () => {
    expect(readPetState(state, null, 'p1')).toEqual({
      pets: { a: { xRatio: 0.5 } },
      petStatuses: { updatedAt: '', pets: [] },
      petHidden: true,
      petHabitat: 'p1',
    });
    expect(readPetState(state, undefined, null)).not.toHaveProperty('secret');
  });

  it('reads petHabitat from the tracker, never from the saved state', () => {
    expect(readPetState({ petHabitat: 'old' }, 'petHabitat', 'p1')).toEqual({ petHabitat: 'p1' });
    expect(readPetState({ petHabitat: 'old' }, 'petHabitat', null)).toEqual({ petHabitat: null });
  });

  it('lists petHabitat as readable', () => {
    expect(READABLE_KEYS).toContain('petHabitat');
  });
});

describe('cleanPetWrite', () => {
  it('keeps positions and the note time, and drops everything else', () => {
    expect(cleanPetWrite({ pets: { a: { xRatio: 0.5 } }, petNoteAt: 5, petStatuses: {}, petAway: {}, petCheckIn: {} }, L)).toEqual({
      pets: { a: { xRatio: 0.5 } },
      petNoteAt: 5,
    });
  });

  it('drops a damaged note time and non-objects', () => {
    expect(cleanPetWrite({ petNoteAt: NaN }, L)).toEqual({});
    expect(cleanPetWrite({ petNoteAt: -1 }, L)).toEqual({});
    expect(cleanPetWrite('x', L)).toEqual({});
    expect(cleanPetWrite(null, L)).toEqual({});
  });
});

describe('changesFor', () => {
  it('gives storage-style changes for readable keys only', () => {
    expect(changesFor(['petAway', 'focusOutbox'], { petAway: { a: 1 }, focusOutbox: {} })).toEqual({ petAway: { newValue: { a: 1 } } });
  });
});

describe('handlePetMessage', () => {
  const setup = () => {
    const deps = { L, runner: { request: vi.fn() }, open: vi.fn(), reportHabitat: vi.fn() };
    const quiet = () => {
      expect(deps.runner.request).not.toHaveBeenCalled();
      expect(deps.open).not.toHaveBeenCalled();
      expect(deps.reportHabitat).not.toHaveBeenCalled();
    };
    return { deps, quiet };
  };

  it('runs nap, sleep, wake and check-in requests from either window', () => {
    for (const from of ['overlay', 'studium']) {
      const { deps } = setup();
      handlePetMessage({ type: 'nap', projectId: 'a' }, from, deps);
      handlePetMessage({ type: 'sleep', projectId: 'a', hours: 2 }, from, deps);
      handlePetMessage({ type: 'wake', projectId: 'a' }, from, deps);
      handlePetMessage({ type: 'checkIn', answer: 'done' }, from, deps);
      expect(deps.runner.request.mock.calls.map((c) => c[0])).toEqual([
        { type: 'nap', projectId: 'a' },
        { type: 'sleep', projectId: 'a', hours: 2 },
        { type: 'wake', projectId: 'a' },
        { type: 'checkIn', answer: 'done' },
      ]);
    }
  });

  it('opens a project page instead of asking the runner', () => {
    const { deps } = setup();
    handlePetMessage({ type: 'openProject', projectId: 'a b' }, 'overlay', deps);
    expect(deps.open).toHaveBeenCalledWith('project=a%20b');
    expect(deps.runner.request).not.toHaveBeenCalled();
  });

  it('never takes delivered from a pet window (only Studium itself delivers sessions)', () => {
    for (const from of ['overlay', 'studium']) {
      const { deps, quiet } = setup();
      handlePetMessage({ type: 'delivered', ids: ['x'] }, from, deps);
      quiet();
    }
  });

  it('takes habitat reports only from the Studium window', () => {
    const { deps } = setup();
    handlePetMessage({ type: 'habitat', projectId: 'a' }, 'studium', deps);
    handlePetMessage({ type: 'habitat' }, 'studium', deps);
    handlePetMessage({ type: 'habitat', projectId: '' }, 'studium', deps);
    expect(deps.reportHabitat.mock.calls.map((c) => c[0])).toEqual(['a', null, null]);

    const other = setup();
    handlePetMessage({ type: 'habitat', projectId: 'a' }, 'overlay', other.deps);
    other.quiet();
  });

  it('ignores garbage', () => {
    const { deps, quiet } = setup();
    for (const msg of [null, 'nap', { type: 'sleep', projectId: 'a', hours: 3 }, { type: 'explode' }]) handlePetMessage(msg, 'overlay', deps);
    quiet();
  });
});

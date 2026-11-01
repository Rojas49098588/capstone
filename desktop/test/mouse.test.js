import { describe, expect, it } from 'vitest';
import { MOUSE_RECHECK_MS, createMouseGate, wantsMouse } from '../src/overlay/mouse.js';

describe('wantsMouse', () => {
  it('takes the mouse over a pet, while its menu is open, or during a drag', () => {
    expect(wantsMouse({ overPet: true, menuOpen: false, pressing: false })).toBe(true);
    expect(wantsMouse({ overPet: false, menuOpen: true, pressing: false })).toBe(true);
    expect(wantsMouse({ overPet: false, menuOpen: false, pressing: true })).toBe(true);
    expect(wantsMouse({ overPet: false, menuOpen: false, pressing: false })).toBe(false);
  });
});

describe('createMouseGate', () => {
  it('starts letting clicks through and tells the main process only about changes', () => {
    const sent = [];
    const gate = createMouseGate((v) => sent.push(v));
    gate.update(false);
    expect(sent).toEqual([]);
    gate.update(true);
    gate.update(true);
    expect(sent).toEqual([true]);
    gate.update(false);
    expect(sent).toEqual([true, false]);
  });
});

it('re-checks often enough that a vanished pet frees the mouse quickly', () => {
  expect(MOUSE_RECHECK_MS).toBe(250);
});

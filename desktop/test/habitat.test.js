import { describe, expect, it, vi } from 'vitest';
import { createHabitatTracker } from '../src/main/habitat.js';

const shown = { visible: true, minimized: false };

describe('createHabitatTracker', () => {
  it('ignores a reported habitat while the Studium window is hidden', () => {
    const onChange = vi.fn();
    const t = createHabitatTracker(onChange);
    t.report('a');
    expect(t.get()).toBe(null);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('gives the reported habitat once the window shows', () => {
    const onChange = vi.fn();
    const t = createHabitatTracker(onChange);
    t.report('a');
    t.setWindow(shown);
    expect(t.get()).toBe('a');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith('a');
  });

  it('minimizing or hiding the window sends the pet back; restoring brings it in', () => {
    const onChange = vi.fn();
    const t = createHabitatTracker(onChange);
    t.setWindow(shown);
    t.report('a');
    t.setWindow({ visible: true, minimized: true });
    expect(t.get()).toBe(null);
    t.setWindow(shown);
    expect(t.get()).toBe('a');
    t.setWindow({ visible: false, minimized: false });
    expect(t.get()).toBe(null);
    expect(onChange.mock.calls.map((c) => c[0])).toEqual(['a', null, 'a', null]);
  });

  it('reset forgets the report until the page reports again', () => {
    const onChange = vi.fn();
    const t = createHabitatTracker(onChange);
    t.setWindow(shown);
    t.report('a');
    t.reset();
    expect(t.get()).toBe(null);
    t.setWindow(shown);
    expect(t.get()).toBe(null);
    t.report('b');
    expect(t.get()).toBe('b');
    expect(onChange.mock.calls.map((c) => c[0])).toEqual(['a', null, 'b']);
  });

  it('repeating the same report changes nothing', () => {
    const onChange = vi.fn();
    const t = createHabitatTracker(onChange);
    t.setWindow(shown);
    t.report('a');
    t.report('a');
    t.setWindow(shown);
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

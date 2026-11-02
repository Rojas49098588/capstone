import { describe, expect, it, vi } from 'vitest';
import { createHabitatTracker } from '../src/main/habitat.js';

const shown = { visible: true, minimized: false };

describe('createHabitatTracker', () => {
  it('ignores reported habitats while the Studium window is hidden', () => {
    const onChange = vi.fn();
    const t = createHabitatTracker(onChange);
    t.report(['a']);
    expect(t.get()).toEqual([]);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('gives every reported habitat once the window shows', () => {
    const onChange = vi.fn();
    const t = createHabitatTracker(onChange);
    t.report(['p1', 'x1']);
    t.setWindow(shown);
    expect(t.get()).toEqual(['p1', 'x1']);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(['p1', 'x1']);
  });

  it('minimizing or hiding the window sends the pets back; restoring brings them in', () => {
    const onChange = vi.fn();
    const t = createHabitatTracker(onChange);
    t.setWindow(shown);
    t.report(['a']);
    t.setWindow({ visible: true, minimized: true });
    expect(t.get()).toEqual([]);
    t.setWindow(shown);
    expect(t.get()).toEqual(['a']);
    t.setWindow({ visible: false, minimized: false });
    expect(t.get()).toEqual([]);
    expect(onChange.mock.calls.map((c) => c[0])).toEqual([['a'], [], ['a'], []]);
  });

  it('reset forgets the report until the page reports again', () => {
    const onChange = vi.fn();
    const t = createHabitatTracker(onChange);
    t.setWindow(shown);
    t.report(['a']);
    t.reset();
    expect(t.get()).toEqual([]);
    t.setWindow(shown);
    expect(t.get()).toEqual([]);
    t.report(['b']);
    expect(t.get()).toEqual(['b']);
    expect(onChange.mock.calls.map((c) => c[0])).toEqual([['a'], [], ['b']]);
  });

  it('repeating the same report changes nothing', () => {
    const onChange = vi.fn();
    const t = createHabitatTracker(onChange);
    t.setWindow(shown);
    t.report(['a', 'b']);
    t.report(['a', 'b']);
    t.setWindow(shown);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('takes a single id from an older page, and drops anything that is not an id', () => {
    const t = createHabitatTracker(vi.fn());
    t.setWindow(shown);
    t.report('a');
    expect(t.get()).toEqual(['a']);
    t.report(['b', '', 7, null]);
    expect(t.get()).toEqual(['b']);
    t.report(null);
    expect(t.get()).toEqual([]);
  });
});

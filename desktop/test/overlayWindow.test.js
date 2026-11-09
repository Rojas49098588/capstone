import { describe, expect, it, vi } from 'vitest';
import { REBUILD_AFTER_WAKE_MS, createRebuildTimer, overlayBounds, overlayOptions } from '../src/main/overlayWindow.js';

const workArea = { x: 0, y: 0, width: 1920, height: 1040 };

describe('overlayBounds', () => {
  it('is the work area (above the taskbar)', () => {
    expect(overlayBounds({ ...workArea, extra: 1 })).toEqual(workArea);
  });
});

describe('overlayOptions', () => {
  it('is a transparent, frameless, always-on-top window that never takes focus', () => {
    const o = overlayOptions(workArea);
    expect(o).toMatchObject({
      ...workArea,
      transparent: true,
      frame: false,
      focusable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      show: false,
      resizable: false,
    });
    expect(o.webPreferences).toMatchObject({ contextIsolation: true, sandbox: true, nodeIntegration: false, backgroundThrottling: false });
  });
});

describe('createRebuildTimer', () => {
  it('rebuilds once, a moment after the last request (wake and unlock both fire)', () => {
    vi.useFakeTimers();
    try {
      const rebuild = vi.fn();
      const timer = createRebuildTimer(rebuild, REBUILD_AFTER_WAKE_MS);
      timer.request();
      vi.advanceTimersByTime(REBUILD_AFTER_WAKE_MS - 1);
      timer.request();
      vi.advanceTimersByTime(REBUILD_AFTER_WAKE_MS - 1);
      expect(rebuild).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(rebuild).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does nothing once disposed', () => {
    vi.useFakeTimers();
    try {
      const rebuild = vi.fn();
      const timer = createRebuildTimer(rebuild, 10);
      timer.request();
      timer.dispose();
      vi.advanceTimersByTime(100);
      expect(rebuild).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});

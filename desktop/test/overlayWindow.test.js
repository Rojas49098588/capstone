import { describe, expect, it } from 'vitest';
import { overlayBounds, overlayOptions } from '../src/main/overlayWindow.js';

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

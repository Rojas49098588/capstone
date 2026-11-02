import { describe, expect, it } from 'vitest';
import { overlayBounds, overlayOptions, overlayPlatformSetup } from '../src/main/overlayWindow.js';

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

describe('overlayPlatformSetup', () => {
  const fakeWin = () => {
    const calls = [];
    return {
      calls,
      setVisibleOnAllWorkspaces: (...a) => calls.push(['setVisibleOnAllWorkspaces', ...a]),
      setAlwaysOnTop: (...a) => calls.push(['setAlwaysOnTop', ...a]),
    };
  };

  it('on a Mac, pets show on every desktop and over full-screen apps', () => {
    const win = fakeWin();
    overlayPlatformSetup(win, 'darwin');
    expect(win.calls).toEqual([
      ['setVisibleOnAllWorkspaces', true, { visibleOnFullScreen: true }],
      ['setAlwaysOnTop', true, 'floating'],
    ]);
  });

  it('on Windows, nothing changes', () => {
    const win = fakeWin();
    overlayPlatformSetup(win, 'win32');
    expect(win.calls).toEqual([]);
  });
});

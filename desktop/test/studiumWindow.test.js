import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ app: {}, BrowserWindow: class {}, shell: {} }));
const { showStudiumQuietly } = await import('../src/main/studiumWindow.js');

function fakeWindow({ minimized = false, destroyed = false } = {}) {
  const calls = [];
  const rec = (name) => (...args) => {
    calls.push(name);
    return args;
  };
  return {
    calls,
    isDestroyed: () => destroyed,
    isMinimized: () => minimized,
    webContents: {
      executeJavaScript: (code) => {
        calls.push(`js:${code}`);
        return Promise.resolve();
      },
    },
    showInactive: rec('showInactive'),
    moveTop: rec('moveTop'),
    show: rec('show'),
    focus: rec('focus'),
    restore: rec('restore'),
  };
}

describe('showStudiumQuietly', () => {
  it('shows Studium at the page without taking focus', async () => {
    const win = fakeWindow();
    expect(await showStudiumQuietly(win, 'project=p1')).toBe(true);
    expect(win.calls).toEqual(['js:location.hash = "#project=p1"', 'showInactive', 'moveTop']);
  });

  it('leaves a minimized window alone (restoring it would take focus)', async () => {
    const win = fakeWindow({ minimized: true });
    expect(await showStudiumQuietly(win, 'project=p1')).toBe(false);
    expect(win.calls).toEqual([]);
  });

  it('does nothing for a closed window', async () => {
    expect(await showStudiumQuietly(fakeWindow({ destroyed: true }), 'project=p1')).toBe(false);
    expect(await showStudiumQuietly(null, 'project=p1')).toBe(false);
  });
});

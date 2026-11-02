import { describe, expect, it } from 'vitest';
import { loginItemSettings, startHidden, startQuietlyFrom, startWithComputerFrom } from '../src/main/loginItem.js';

describe('loginItemSettings', () => {
  it('opens Studium at login, with its window showing (Windows)', () => {
    expect(loginItemSettings(true, 'C:\\S\\Studium.exe', false, 'win32')).toEqual({ openAtLogin: true, path: 'C:\\S\\Studium.exe', args: [] });
  });

  it('starts quietly in the tray when asked (Windows: --hidden)', () => {
    expect(loginItemSettings(true, 'Studium.exe', true, 'win32').args).toEqual(['--hidden']);
    expect(loginItemSettings(true, 'Studium.exe', false, 'win32').args).toEqual([]);
  });

  it('can be turned off', () => {
    expect(loginItemSettings(false, 'C:\S\Studium.exe').openAtLogin).toBe(false);
  });
});

describe('startWithComputerFrom', () => {
  it('is on unless the saved settings turn it off', () => {
    expect(startWithComputerFrom(null)).toBe(true);
    expect(startWithComputerFrom('{')).toBe(true);
    expect(startWithComputerFrom('{}')).toBe(true);
    expect(startWithComputerFrom('[]')).toBe(true);
    expect(startWithComputerFrom('{"startWithComputer":false}')).toBe(false);
  });
});

describe('startQuietlyFrom', () => {
  it('opens the window unless the saved settings ask for a quiet start', () => {
    expect(startQuietlyFrom(null)).toBe(false);
    expect(startQuietlyFrom('{')).toBe(false);
    expect(startQuietlyFrom('[]')).toBe(false);
    expect(startQuietlyFrom('{"startQuietly":"yes"}')).toBe(false);
    expect(startQuietlyFrom('{"startQuietly":true}')).toBe(true);
  });
});

describe('on a Mac', () => {
  it('a login item is only on or off (macOS ignores path and args)', () => {
    expect(loginItemSettings(true, '/Applications/Studium.app', true, 'darwin')).toEqual({ openAtLogin: true });
    expect(loginItemSettings(false, '/Applications/Studium.app', false, 'darwin')).toEqual({ openAtLogin: false });
  });

  it('Windows is unchanged when the platform is given', () => {
    expect(loginItemSettings(true, 'C:\S.exe', true, 'win32')).toEqual({ openAtLogin: true, path: 'C:\S.exe', args: ['--hidden'] });
  });
});

describe('startHidden', () => {
  it('on Windows, only --hidden hides the window', () => {
    expect(startHidden({ platform: 'win32', argvHidden: true, openedAtLogin: false, quietSaved: false })).toBe(true);
    expect(startHidden({ platform: 'win32', argvHidden: false, openedAtLogin: true, quietSaved: true })).toBe(false);
  });

  it('on a Mac, a login start with quiet start saved stays hidden', () => {
    expect(startHidden({ platform: 'darwin', argvHidden: false, openedAtLogin: true, quietSaved: true })).toBe(true);
  });

  it('on a Mac, a login start without quiet start opens the window', () => {
    expect(startHidden({ platform: 'darwin', argvHidden: false, openedAtLogin: true, quietSaved: false })).toBe(false);
  });

  it('on a Mac, opening it by hand always shows the window', () => {
    expect(startHidden({ platform: 'darwin', argvHidden: false, openedAtLogin: false, quietSaved: true })).toBe(false);
  });
});

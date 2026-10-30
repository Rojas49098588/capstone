import { describe, expect, it } from 'vitest';
import { loginItemSettings, startQuietlyFrom, startWithComputerFrom } from '../src/main/loginItem.js';

describe('loginItemSettings', () => {
  it('opens Studium at login, with its window showing', () => {
    expect(loginItemSettings(true, 'C:\\S\\Studium.exe')).toEqual({ openAtLogin: true, path: 'C:\\S\\Studium.exe', args: [] });
  });

  it('starts quietly in the tray when asked', () => {
    expect(loginItemSettings(true, 'Studium.exe', true).args).toEqual(['--hidden']);
    expect(loginItemSettings(true, 'Studium.exe', false).args).toEqual([]);
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

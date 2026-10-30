import { describe, expect, it } from 'vitest';
import { loginItemSettings, startWithComputerFrom } from '../src/main/loginItem.js';

describe('loginItemSettings', () => {
  it('starts the app hidden at login', () => {
    expect(loginItemSettings(true, 'C:\S\Studium.exe')).toEqual({ openAtLogin: true, path: 'C:\S\Studium.exe', args: ['--hidden'] });
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

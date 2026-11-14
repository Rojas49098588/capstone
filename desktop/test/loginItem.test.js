import { describe, expect, it } from 'vitest';
import { linuxAutostart, loginItemSettings, startHidden, startQuietlyFrom, startWithComputerFrom } from '../src/main/loginItem.js';

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

describe('linuxAutostart', () => {
  const env = { HOME: '/home/sam' };

  it('writes an autostart entry that opens Studium, or starts it quietly with --hidden', () => {
    const on = linuxAutostart(true, '/opt/Studium/studium', false, env);
    expect(on.file).toBe('/home/sam/.config/autostart/studium.desktop');
    expect(on.content).toContain('[Desktop Entry]');
    expect(on.content).toContain('Type=Application');
    expect(on.content).toContain('Name=Studium');
    expect(on.content).toContain('Exec="/opt/Studium/studium"\n');
    expect(linuxAutostart(true, '/opt/Studium/studium', true, env).content).toContain('Exec="/opt/Studium/studium" --hidden\n');
  });

  it('turning it off removes the entry', () => {
    expect(linuxAutostart(false, '/opt/Studium/studium', false, env)).toEqual({ file: '/home/sam/.config/autostart/studium.desktop', content: null });
  });

  it('an AppImage starts from the AppImage file, not from where it is unpacked while running', () => {
    const entry = linuxAutostart(true, '/tmp/.mount_Stu123/studium', false, { ...env, APPIMAGE: '/home/sam/Apps/Studium.AppImage' });
    expect(entry.content).toContain('Exec="/home/sam/Apps/Studium.AppImage"\n');
  });

  it('uses XDG_CONFIG_HOME when it is set', () => {
    expect(linuxAutostart(true, '/s', false, { ...env, XDG_CONFIG_HOME: '/home/sam/cfg' }).file).toBe('/home/sam/cfg/autostart/studium.desktop');
  });
});

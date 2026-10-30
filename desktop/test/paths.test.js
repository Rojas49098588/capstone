import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseArgs, resolvePaths, startUrl } from '../src/main/paths.js';

describe('resolvePaths', () => {
  it('resolves dev paths next to the repo', () => {
    const p = resolvePaths({ packaged: false, resourcesPath: 'X', desktopDir: '/r/desktop' });
    expect(p.webDist).toBe(path.resolve('/r/web/dist'));
    expect(p.logicJs).toBe(path.resolve('/r/extension/content/logic.js'));
    expect(p.trayIcon).toBe(path.resolve('/r/web/public/pets/egg.png'));
  });

  it('resolves packaged paths in resources', () => {
    const p = resolvePaths({ packaged: true, resourcesPath: '/app/res', desktopDir: 'ignored' });
    expect(p.webDist).toBe(path.resolve('/app/res/web'));
    expect(p.logicJs).toBe(path.resolve('/app/res/extension/logic.js'));
    expect(p.trayIcon).toBe(path.resolve('/app/res/web/pets/egg.png'));
  });
});

describe('parseArgs', () => {
  it('reads --hidden and --user-data', () => {
    expect(parseArgs(['electron.exe', '.', '--hidden', '--user-data=C:\\tmp\\u'])).toEqual({ dev: false, hidden: true, userData: 'C:\\tmp\\u' });
  });

  it('has defaults for a plain launch', () => {
    expect(parseArgs(['Studium.exe'])).toEqual({ dev: false, hidden: false, userData: null });
  });

  it('reads --dev', () => {
    expect(parseArgs(['electron.exe', '.', '--dev']).dev).toBe(true);
  });

  it('ignores an empty --user-data', () => {
    expect(parseArgs(['Studium.exe', '--user-data=']).userData).toBe(null);
  });
});

describe('startUrl', () => {
  it('is the Vite dev server in dev and the studium scheme otherwise', () => {
    expect(startUrl(true)).toBe('http://localhost:5173/');
    expect(startUrl(false)).toBe('studium://app/');
  });
});

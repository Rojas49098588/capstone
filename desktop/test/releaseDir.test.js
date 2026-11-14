import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { distArgs, releaseDir, unpackedExe } from '../scripts/releaseDir.js';

describe('releaseDir', () => {
  it('is outside the repo, in the home folder', () => {
    expect(releaseDir({})).toBe(path.join(os.homedir(), 'StudiumBuilds'));
  });

  it('can be overridden', () => {
    expect(releaseDir({ STUDIUM_RELEASE_DIR: 'D:\builds' })).toBe('D:\builds');
  });
});

describe('unpackedExe', () => {
  it('finds the Windows build', () => {
    expect(unpackedExe('r', 'win32')).toBe(path.join('r', 'win-unpacked', 'Studium.exe'));
  });

  it('finds the Linux build', () => {
    expect(unpackedExe('r', 'linux')).toBe(path.join('r', 'linux-unpacked', 'studium'));
  });

  it('finds the universal Mac build', () => {
    expect(unpackedExe('r', 'darwin')).toBe(path.join('r', 'mac-universal', 'Studium.app', 'Contents', 'MacOS', 'Studium'));
  });
});

describe('distArgs', () => {
  it('builds a universal Mac dmg and never publishes', () => {
    const args = distArgs('mac', '/o');
    expect(args).toEqual(['electron-builder', '--mac', 'dmg', '--universal', '--publish', 'never', '--config.directories.output=/o']);
  });

  it('builds the Windows installer, not a universal one', () => {
    const args = distArgs('win', 'C:\o');
    expect(args).toContain('nsis');
    expect(args).toContain('never');
    expect(args).not.toContain('--universal');
  });

  it('builds the Linux .deb', () => {
    expect(distArgs('linux', '/o')).toEqual(['electron-builder', '--linux', 'deb', '--publish', 'never', '--config.directories.output=/o']);
  });
});

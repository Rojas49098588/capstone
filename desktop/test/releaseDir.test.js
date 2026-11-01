import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { releaseDir } from '../scripts/releaseDir.js';

describe('releaseDir', () => {
  it('is outside the repo, in the home folder', () => {
    expect(releaseDir({})).toBe(path.join(os.homedir(), 'StudiumBuilds'));
  });

  it('can be overridden', () => {
    expect(releaseDir({ STUDIUM_RELEASE_DIR: 'D:\builds' })).toBe('D:\builds');
  });
});

import { describe, expect, it } from 'vitest';
import { releaseAction } from '../scripts/release.js';

const main = 'refs/heads/main';

describe('releaseAction', () => {
  it('creates a draft when there is no release for this version yet', () => {
    expect(releaseAction({ ref: main, existing: null, version: '0.8.0' }).action).toBe('create');
  });

  it('replaces the files on a draft that is still waiting to be published', () => {
    expect(releaseAction({ ref: main, existing: { isDraft: true }, version: '0.8.0' }).action).toBe('update');
  });

  it('refuses to change a release testers may already have installed', () => {
    const result = releaseAction({ ref: main, existing: { isDraft: false }, version: '0.8.0' });
    expect(result.action).toBe('refuse');
    expect(result.reason).toContain('v0.8.0 is already published');
    expect(result.reason).toContain('desktop/package.json');
  });

  it('refuses to release from any branch but main', () => {
    const result = releaseAction({ ref: 'refs/heads/feature/x', existing: null, version: '0.8.0' });
    expect(result.action).toBe('refuse');
    expect(result.reason).toContain('main');
  });
});

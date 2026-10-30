import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { fileForRequest } from '../src/main/protocol.js';

const dist = path.resolve('/r/web/dist');
const index = path.join(dist, 'index.html');

describe('fileForRequest', () => {
  it('serves index.html for the root', () => {
    expect(fileForRequest('studium://app/', dist)).toBe(index);
  });

  it('serves files inside the build', () => {
    expect(fileForRequest('studium://app/decor/clock.svg', dist)).toBe(path.join(dist, 'decor', 'clock.svg'));
  });

  it('ignores the query and hash', () => {
    expect(fileForRequest('studium://app/assets/index-abc.js?x=1#project=a', dist)).toBe(path.join(dist, 'assets', 'index-abc.js'));
  });

  it('never serves a file outside the build', () => {
    // The URL parser already drops plain and %2e dot segments, so these stay inside the build.
    for (const url of ['studium://app/../../secret.txt', 'studium://app/%2e%2e/%2e%2e/secret.txt']) {
      const rel = path.relative(dist, fileForRequest(url, dist));
      expect(rel.startsWith('..') || path.isAbsolute(rel)).toBe(false);
    }
    // Encoded separators survive the parser and are caught here.
    expect(fileForRequest('studium://app/..%5c..%5csecret.txt', dist)).toBe(index);
    expect(fileForRequest('studium://app/%2e%2e%2f%2e%2e%2fsecret.txt', dist)).toBe(index);
  });

  it('falls back to index.html for paths without a file extension', () => {
    expect(fileForRequest('studium://app/no-such-page', dist)).toBe(index);
  });

  it('falls back to index.html for a malformed address', () => {
    expect(fileForRequest('studium://app/%E0%A4%A', dist)).toBe(index);
  });
});

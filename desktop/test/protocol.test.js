import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { fileForRequest } from '../src/main/protocol.js';

const dist = path.resolve('/r/web/dist');
const index = path.join(dist, 'index.html');
const roots = { app: dist, pets: path.resolve('/r/extension'), overlay: path.resolve('/r/desktop/src/overlay') };

describe('fileForRequest', () => {
  it('serves index.html for the root', () => {
    expect(fileForRequest('studium://app/', roots)).toBe(index);
  });

  it('serves files inside the build', () => {
    expect(fileForRequest('studium://app/decor/clock.svg', roots)).toBe(path.join(dist, 'decor', 'clock.svg'));
  });

  it('ignores the query and hash', () => {
    expect(fileForRequest('studium://app/assets/index-abc.js?x=1#project=a', roots)).toBe(path.join(dist, 'assets', 'index-abc.js'));
  });

  it('never serves a file outside the build', () => {
    // The URL parser already drops plain and %2e dot segments, so these stay inside the build.
    for (const url of ['studium://app/../../secret.txt', 'studium://app/%2e%2e/%2e%2e/secret.txt']) {
      const rel = path.relative(dist, fileForRequest(url, roots));
      expect(rel.startsWith('..') || path.isAbsolute(rel)).toBe(false);
    }
    // Encoded separators survive the parser and are caught here.
    expect(fileForRequest('studium://app/..%5c..%5csecret.txt', roots)).toBe(index);
    expect(fileForRequest('studium://app/%2e%2e%2f%2e%2e%2fsecret.txt', roots)).toBe(index);
  });

  it('falls back to index.html for paths without a file extension', () => {
    expect(fileForRequest('studium://app/no-such-page', roots)).toBe(index);
  });

  it('falls back to index.html for a malformed address', () => {
    expect(fileForRequest('studium://app/%E0%A4%A', roots)).toBe(index);
  });
});

describe('fileForRequest: pets and overlay', () => {
  it('serves pet art and scripts from the pets root', () => {
    expect(fileForRequest('studium://pets/assets/pets/cat.png', roots)).toBe(path.join(roots.pets, 'assets', 'pets', 'cat.png'));
    expect(fileForRequest('studium://pets/content/pet.js', roots)).toBe(path.join(roots.pets, 'content', 'pet.js'));
  });

  it('serves the overlay page', () => {
    expect(fileForRequest('studium://overlay/index.html', roots)).toBe(path.join(roots.overlay, 'index.html'));
  });

  it('gives nothing outside pets/overlay, for folders, or for unknown hosts', () => {
    expect(fileForRequest('studium://pets/..%5c..%5csecret.txt', roots)).toBeNull();
    expect(fileForRequest('studium://pets/content', roots)).toBeNull();
    expect(fileForRequest('studium://overlay/', roots)).toBeNull();
    expect(fileForRequest('studium://other/x.js', roots)).toBeNull();
  });
});

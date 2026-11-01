import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { habitatFiles, habitatScript } from '../src/main/petScripts.js';

describe('habitatScript', () => {
  it('marks the surface first, then runs the files in order', () => {
    const script = habitatScript(['A()', 'B()']);
    expect(script.startsWith('globalThis.PetSurface = "habitat";')).toBe(true);
    expect(script.indexOf('A()')).toBeLessThan(script.indexOf('B()'));
  });

  it("separates files so one without a final semicolon can't run into the next", () => {
    expect(habitatScript(['a = 1', '(() => 2)()'])).toContain('a = 1\n;\n(() => 2)()');
  });
});

describe('habitatFiles', () => {
  it('is the chrome stand-in, then logic, menu and pet', () => {
    const R = path.resolve('/r/extension');
    const O = path.resolve('/r/desktop/src/overlay');
    expect(habitatFiles({ petsRoot: R, overlayDir: O })).toEqual([
      path.join(O, 'chromeShim.js'),
      path.join(R, 'content', 'logic.js'),
      path.join(R, 'content', 'menu.js'),
      path.join(R, 'content', 'pet.js'),
    ]);
  });
});

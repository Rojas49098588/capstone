import { describe, expect, it } from 'vitest';
import { quitTask } from '../src/main/taskbar.js';

describe('quitTask', () => {
  it('is a taskbar menu item that runs Studium with --quit', () => {
    expect(quitTask('C:\S\Studium.exe')).toEqual({
      program: 'C:\S\Studium.exe',
      arguments: '--quit',
      title: 'Quit Studium',
      description: 'Close Studium and stop it running in the background',
      iconPath: 'C:\S\Studium.exe',
      iconIndex: 0,
    });
  });
});

import { describe, expect, it } from 'vitest';
import { SAMPLE_RATE, SOUNDS, render, wavBytes } from '../scripts/makeSounds.js';

describe('wavBytes', () => {
  it('writes a 16-bit mono PCM WAV file', () => {
    const b = wavBytes(new Float32Array([0, 1, -1]), 22050);
    expect(b.toString('ascii', 0, 4)).toBe('RIFF');
    expect(b.toString('ascii', 8, 12)).toBe('WAVE');
    expect(b.readUInt16LE(22)).toBe(1); // mono
    expect(b.readUInt32LE(24)).toBe(22050);
    expect(b.readUInt16LE(34)).toBe(16); // bits per sample
    expect(b.toString('ascii', 36, 40)).toBe('data');
    expect(b.readUInt32LE(40)).toBe(6);
    expect([b.readInt16LE(44), b.readInt16LE(46), b.readInt16LE(48)]).toEqual([0, 32767, -32767]);
  });
});

describe('SOUNDS', () => {
  it('has every sound the pets make, each short and within range', () => {
    expect(Object.keys(SOUNDS).sort()).toEqual(['bark', 'coo', 'cough', 'meow', 'ribbit', 'sigh', 'sneeze', 'sniffle']);
    for (const key of Object.keys(SOUNDS)) {
      const samples = render(key);
      expect(samples.length / SAMPLE_RATE).toBeLessThan(0.6);
      expect(samples.length).toBeGreaterThan(0);
      expect(Math.max(...samples.map(Math.abs))).toBeLessThanOrEqual(1);
    }
  });
});

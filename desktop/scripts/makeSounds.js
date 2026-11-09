// Makes the pets' placeholder sounds: extension/assets/sounds/<key>.wav, short synthesized clips
// (no recordings, so no licences to track). Run it once: node scripts/makeSounds.js
// To use a real clip instead, replace the .wav with one of the same name, add its key to RECORDED
// (so this script leaves it alone), and list its source in README.md. The keys are
// PetLogic.soundKey's: one per animal, plus the sick and upset sounds.
const fs = require('node:fs');
const path = require('node:path');

const SAMPLE_RATE = 22050;

// A repeatable "random" for the noisy sounds, so the files are the same on every run.
function noise(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return (s / 4294967296) * 2 - 1;
  };
}

const env = (t, len, attack = 0.02) => Math.min(1, t / attack) * Math.max(0, 1 - t / len) ** 1.5;
const tone = (t, hz) => Math.sin(2 * Math.PI * hz * t);

// Each sound: its length in seconds, and its value at time t (seconds), in [-1, 1].
const SOUNDS = {
  meow: { seconds: 0.45, at: (t) => 0.6 * env(t, 0.45, 0.05) * tone(t, 520 + 380 * Math.sin(Math.PI * Math.min(1, t / 0.45))) },
  bark: (() => {
    const n = noise(1);
    return { seconds: 0.22, at: (t) => 0.7 * env(t, 0.22, 0.005) * (0.6 * tone(t, 260 - 200 * t) + 0.4 * n()) };
  })(),
  ribbit: { seconds: 0.32, at: (t) => 0.6 * (t < 0.12 || (t > 0.18 && t < 0.3) ? 1 : 0) * Math.sign(tone(t, 190)) * (0.5 + 0.5 * tone(t, 30)) * env(t, 0.32, 0.01) },
  coo: { seconds: 0.5, at: (t) => 0.55 * env(t, 0.5, 0.08) * tone(t, 340 + 15 * Math.sin(2 * Math.PI * 6 * t)) },
  sneeze: (() => {
    const n = noise(2);
    return { seconds: 0.5, at: (t) => (t < 0.3 ? 0.4 * env(t, 0.3, 0.1) * tone(t, 300 + 400 * t) : 0.8 * env(t - 0.3, 0.2, 0.005) * n()) };
  })(),
  sniffle: (() => {
    const n = noise(3);
    return { seconds: 0.35, at: (t) => 0.35 * ((t % 0.17) < 0.1 ? env(t % 0.17, 0.1, 0.01) : 0) * n() };
  })(),
  cough: (() => {
    const n = noise(4);
    return { seconds: 0.42, at: (t) => 0.7 * ((t % 0.21) < 0.12 ? env(t % 0.21, 0.12, 0.005) : 0) * (0.7 * n() + 0.3 * tone(t, 150)) };
  })(),
  sigh: (() => {
    const n = noise(5);
    return { seconds: 0.55, at: (t) => 0.3 * Math.sin(Math.PI * Math.min(1, t / 0.55)) * (0.7 * n() + 0.3 * tone(t, 180 - 60 * t)) };
  })(),
};

// Sounds that are real recordings now: this script doesn't write them.
const RECORDED = ['meow', 'bark', 'ribbit', 'coo'];

/** The sounds this script writes: every placeholder that hasn't been replaced by a recording. */
function placeholderKeys() {
  return Object.keys(SOUNDS).filter((key) => !RECORDED.includes(key));
}

/** The samples of one sound, clamped to [-1, 1]. */
function render(key) {
  const { seconds, at } = SOUNDS[key];
  const out = new Float32Array(Math.floor(seconds * SAMPLE_RATE));
  for (let i = 0; i < out.length; i++) out[i] = Math.max(-1, Math.min(1, at(i / SAMPLE_RATE)));
  return out;
}

/** A 16-bit mono PCM WAV file. */
function wavBytes(samples, sampleRate) {
  const data = samples.length * 2;
  const b = Buffer.alloc(44 + data);
  b.write('RIFF', 0, 'ascii');
  b.writeUInt32LE(36 + data, 4);
  b.write('WAVE', 8, 'ascii');
  b.write('fmt ', 12, 'ascii');
  b.writeUInt32LE(16, 16); // fmt chunk size
  b.writeUInt16LE(1, 20); // PCM
  b.writeUInt16LE(1, 22); // mono
  b.writeUInt32LE(sampleRate, 24);
  b.writeUInt32LE(sampleRate * 2, 28); // bytes per second
  b.writeUInt16LE(2, 32); // bytes per frame
  b.writeUInt16LE(16, 34); // bits per sample
  b.write('data', 36, 'ascii');
  b.writeUInt32LE(data, 40);
  samples.forEach((s, i) => b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s)) * 32767), 44 + i * 2));
  return b;
}

if (require.main === module) {
  const dir = path.join(__dirname, '..', '..', 'extension', 'assets', 'sounds');
  fs.mkdirSync(dir, { recursive: true });
  for (const key of placeholderKeys()) fs.writeFileSync(path.join(dir, `${key}.wav`), wavBytes(render(key), SAMPLE_RATE));
  console.log(`Wrote ${placeholderKeys().length} placeholder sounds to ${dir}`);
}

module.exports = { SAMPLE_RATE, SOUNDS, RECORDED, placeholderKeys, render, wavBytes };

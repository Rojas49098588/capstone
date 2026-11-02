// The pets' state, which the extension kept in chrome.storage.local, saved to one JSON file in the
// app's data folder. The main process is the only writer. Values are stored raw, as the extension
// stored them; readers clean them with the parsers in extension/content/logic.js.
// Kept behind this one small interface so it can later sync with a server (spec: "Leave room for sharing").
const realFs = require('node:fs');

const STATE_KEYS = ['petStatuses', 'petPrefs', 'petScreen', 'petAway', 'petCheckIn', 'focusOutbox', 'petNoteAt', 'pets', 'petHidden', 'petTimingOverride', 'petOpenAt', 'loginQuiet'];

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function pickKnown(obj) {
  const out = {};
  for (const key of STATE_KEYS) if (Object.hasOwn(obj, key)) out[key] = obj[key];
  return out;
}

function load(file, fs) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return {}; // no file yet
  }
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    value = undefined;
  }
  if (isPlainObject(value)) return pickKnown(value);
  // Damaged: keep a copy to look at, and start empty.
  try {
    fs.writeFileSync(file + '.damaged', text);
  } catch (e) {
    console.error('Could not keep the damaged pet state', e);
  }
  return {};
}

function createStore({ file, fs = realFs }) {
  let state = load(file, fs);
  const listeners = new Set();

  function save() {
    const tmp = file + '.tmp';
    try {
      // Write a temp file, then swap it in: a crash mid-save leaves the old file whole.
      fs.writeFileSync(tmp, JSON.stringify(state));
      fs.renameSync(tmp, file);
    } catch (e) {
      console.error('Could not save the pet state', e);
    }
  }

  return {
    get: () => ({ ...state }),
    set(patch) {
      const changed = Object.keys(pickKnown(patch)).filter((key) => JSON.stringify(state[key]) !== JSON.stringify(patch[key]));
      if (changed.length === 0) return;
      state = { ...state };
      for (const key of changed) state[key] = patch[key];
      save();
      for (const fn of [...listeners]) fn(changed, { ...state });
    },
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

module.exports = { STATE_KEYS, createStore };

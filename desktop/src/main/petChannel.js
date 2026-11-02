// What the pet windows (the overlay, and the habitat pet in the Studium window) may read, write and
// ask of the main process. They run the extension's pet code, whose chrome.* calls arrive here
// through src/preload/petBridge.js. Pure apart from the dependencies passed in.

// What pet.js reads. petHabitat is live (src/main/habitat.js), never saved.
const READABLE_KEYS = ['pets', 'petHidden', 'petStatuses', 'petAway', 'petCheckIn', 'petScreen', 'petPrefs', 'petNoteAt', 'petHabitat', 'petTimingOverride'];

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** chrome.storage.local.get for the pet code: keys may be a string, a list, or null for all. */
function readPetState(state, keys, petHabitat) {
  const wanted = keys == null ? READABLE_KEYS : (Array.isArray(keys) ? keys : [keys]).filter((k) => READABLE_KEYS.includes(k));
  const out = {};
  for (const key of wanted) {
    if (key === 'petHabitat') out.petHabitat = petHabitat;
    else if (state[key] !== undefined) out[key] = state[key];
  }
  return out;
}

/**
 * chrome.storage.local.set from the overlay: only its own positions and the time of the last
 * sticky note. Statuses, naps and check-ins are written by Studium's preload and the away runner.
 */
function cleanPetWrite(patch, L) {
  if (!isPlainObject(patch)) return {};
  const out = {};
  if (Object.hasOwn(patch, 'pets')) out.pets = L.parsePositions(patch.pets);
  if (Number.isFinite(patch.petNoteAt) && patch.petNoteAt >= 0) out.petNoteAt = patch.petNoteAt;
  return out;
}

/** Store changes in chrome.storage.onChanged's shape, for the readable keys only. */
function changesFor(keys, state) {
  const out = {};
  for (const key of keys) if (READABLE_KEYS.includes(key)) out[key] = { newValue: state[key] };
  return out;
}

/**
 * The windows to send pets:changed to. A window still loading is included: its pet code may
 * already have read the state (pets:get), and a change dropped now would leave it stale.
 */
function changeTargets(windows) {
  return windows.filter((w) => w && !w.isDestroyed());
}

/**
 * chrome.runtime.sendMessage from a pet window. from: 'overlay' or 'studium'. statuses(): the stored
 * pet statuses (parsed), to find a pet's project for Open project.
 */
function handlePetMessage(msg, from, { L, runner, open, reportHabitat, statuses }) {
  if (isPlainObject(msg) && msg.type === 'habitat') {
    // ids: every habitat box on the Studium page; an older page sent one projectId.
    if (from === 'studium') reportHabitat(Array.isArray(msg.ids) ? msg.ids.filter((id) => typeof id === 'string' && id) : typeof msg.projectId === 'string' && msg.projectId ? [msg.projectId] : []);
    return;
  }
  const request = L.parseRequest(msg);
  // Finished naps are delivered by Studium itself (src/preload/studium.js), never by a pet.
  if (!request || request.type === 'delivered') return;
  if (request.type === 'openProject') {
    // The pet's project page, scrolled to its habitat (a pet with no status: its id as the project).
    const status = statuses?.()?.pets.find((p) => p.petId === request.petId);
    open(L.projectLink(status?.projectId ?? request.petId, request.petId));
  }
  else runner.request(request);
}

module.exports = { READABLE_KEYS, readPetState, cleanPetWrite, changesFor, changeTargets, handlePetMessage };

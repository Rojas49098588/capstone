// Preload for the Studium window: the link between Studium and the main process. It replaces the
// extension's content/bridge.js and the Studium half of content/pet.js, using the same DOM events,
// so Studium itself doesn't know the difference.
//   - Pet statuses and settings: sent when the page loads and on Studium's "updated" events.
//   - Finished naps: the main process sends them (on studium:ready and when the outbox changes);
//     Studium answers with studium:focus-received.
//   - Wake: the habitat's Wake button dispatches studium:wake-pet.
// Only strings cross safely between this isolated world and the page, so `detail` is JSON text.

// Copied from extension/content/logic.js: a sandboxed preload can only require('electron').
// test/preload.test.js keeps them equal.
const EVENTS = {
  PET_STATUS_KEY: 'studium-pets-v1',
  PET_STATUS_EVENT: 'studium:pets-updated',
  SETTINGS_KEY: 'studium-settings-v1',
  SETTINGS_EVENT: 'studium:settings-updated',
  FOCUS_SESSIONS_EVENT: 'studium:focus-sessions',
  FOCUS_RECEIVED_EVENT: 'studium:focus-received',
  READY_EVENT: 'studium:ready',
  WAKE_PET_EVENT: 'studium:wake-pet',
};

function installBridge({ win, storage, ipc, signal }) {
  const read = (key) => {
    try {
      return storage.getItem(key);
    } catch {
      return null; // storage blocked
    }
  };
  const sendStatuses = () => ipc.send('studium:statuses', read(EVENTS.PET_STATUS_KEY));
  const sendSettings = () => ipc.send('studium:settings', read(EVENTS.SETTINGS_KEY));

  win.addEventListener(EVENTS.PET_STATUS_EVENT, sendStatuses, { signal });
  win.addEventListener(EVENTS.SETTINGS_EVENT, sendSettings, { signal });
  win.addEventListener(EVENTS.READY_EVENT, () => ipc.send('studium:ready'), { signal });

  win.addEventListener(
    EVENTS.FOCUS_RECEIVED_EVENT,
    (e) => {
      let ids;
      try {
        ids = JSON.parse(e.detail);
      } catch {
        return;
      }
      if (Array.isArray(ids) && ids.length > 0 && ids.every((id) => typeof id === 'string')) ipc.send('studium:delivered', ids);
    },
    { signal },
  );

  win.addEventListener(
    EVENTS.WAKE_PET_EVENT,
    (e) => {
      if (typeof e.detail === 'string' && e.detail) ipc.send('studium:wake', e.detail);
    },
    { signal },
  );

  ipc.on('studium:focus-sessions', (_event, sessions) => {
    if (!Array.isArray(sessions) || sessions.length === 0) return;
    win.dispatchEvent(new CustomEvent(EVENTS.FOCUS_SESSIONS_EVENT, { detail: JSON.stringify(sessions) }));
  });

  sendStatuses();
  sendSettings();
}

if (typeof process !== 'undefined' && process.type === 'renderer') {
  const { contextBridge, ipcRenderer } = require('electron');
  contextBridge.exposeInMainWorld('studiumDesktop', { desktop: true });
  installBridge({ win: window, storage: window.localStorage, ipc: ipcRenderer });
}

if (typeof module !== 'undefined') module.exports = { EVENTS, installBridge };

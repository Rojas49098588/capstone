// What the main process does with each message from the Studium window's preload
// (src/preload/studium.js). Pure apart from the dependencies passed in.
const { startQuietlyFrom, startWithComputerFrom } = require('./loginItem');

const CHANNELS = ['studium:statuses', 'studium:settings', 'studium:ready', 'studium:delivered', 'studium:wake'];

function handleStudium(channel, payload, { store, runner, L, sendSessions, applyLoginItem }) {
  switch (channel) {
    case 'studium:statuses': {
      // Damaged statuses don't replace usable ones.
      const parsed = L.parseStatuses(payload ?? null);
      if (parsed) store.set({ petStatuses: parsed });
      return;
    }
    case 'studium:settings': {
      const raw = typeof payload === 'string' ? payload : null;
      store.set({ petScreen: L.screenFromSettings(raw), petPrefs: L.prefsFromSettings(raw) });
      applyLoginItem(startWithComputerFrom(raw), startQuietlyFrom(raw));
      return;
    }
    case 'studium:ready':
      sendSessions(Object.values(L.parseOutbox(store.get().focusOutbox)));
      return;
    case 'studium:delivered': {
      const request = L.parseRequest({ type: 'delivered', ids: payload });
      if (request && request.ids.length > 0) runner.request(request);
      return;
    }
    case 'studium:wake': {
      const request = L.parseRequest({ type: 'wake', projectId: payload });
      if (request) runner.request(request);
      return;
    }
    default:
  }
}

module.exports = { CHANNELS, handleStudium };

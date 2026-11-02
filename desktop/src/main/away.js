// Naps and sleep, run in the main process. This is extension/background.js's run() with the store in
// place of chrome.storage and timers in place of chrome.alarms. The rules themselves are
// PetLogic.applyAwayRequest in extension/content/logic.js.
const crypto = require('node:crypto');

function createAwayRunner({ store, L, open, now = Date.now, newId = () => crypto.randomUUID(), setTimer = setTimeout, clearTimer = clearTimeout }) {
  const timers = new Map(); // alarm name -> timer
  let queue = Promise.resolve();
  let disposed = false;

  function clearAlarm(name) {
    if (!timers.has(name)) return;
    clearTimer(timers.get(name));
    timers.delete(name);
  }

  function setAlarm(name, when) {
    clearAlarm(name);
    if (disposed || !name.startsWith('away:')) return;
    const petId = name.slice('away:'.length);
    const timer = setTimer(() => {
      timers.delete(name);
      request({ type: 'end', petId });
    }, Math.max(0, when - now()));
    timers.set(name, timer);
  }

  async function run(req) {
    const stored = store.get();
    const t = now();
    const state = {
      petAway: L.parseAway(stored.petAway, t),
      focusOutbox: L.parseOutbox(stored.focusOutbox),
      petCheckIn: L.parseCheckIn(stored.petCheckIn),
    };
    const ctx = {
      now: t,
      statuses: L.parseStatuses(stored.petStatuses ?? null),
      napMinutes: L.napMinutesFrom(stored.petTimingOverride),
      newId,
    };
    const result = L.applyAwayRequest(state, req, ctx);
    if (result.changed) store.set(result.state);
    for (const effect of result.effects) {
      if (effect.type === 'setAlarm') setAlarm(effect.name, effect.when);
      else if (effect.type === 'clearAlarm') clearAlarm(effect.name);
      else if (effect.type === 'open') await open(effect.hash);
    }
  }

  /** Requests run one at a time, so a Wake and the nap's timer can't both end the same nap. */
  function request(req) {
    queue = queue.then(() => run(req)).catch((e) => console.error(e));
    return queue;
  }

  function dispose() {
    disposed = true;
    for (const name of [...timers.keys()]) clearAlarm(name);
  }

  return { request, dispose };
}

module.exports = { createAwayRunner };

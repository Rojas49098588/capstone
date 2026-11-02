// "Open its project": an upset or sick Moderate pet brings Studium up at its project page, without
// taking focus (spec: Mischief). The rule is PetLogic.chooseOpenProject; this runs it every minute
// in the main process, which owns the Studium window. The last open is saved (petOpenAt), so a
// restart doesn't reset the 2-hour gap. Pure apart from the dependencies passed in.

const TICK_MS = 60000;

function createOpenProjectTimer({ store, L, isStudiumShowing, openQuietly, now = Date.now, setTimer = setInterval, clearTimer = clearInterval, startedAt = now() }) {
  // Starting counts as Studium having just been seen, so nothing pops up right after login.
  let studiumSeenAt = startedAt;
  let busy = false;

  async function tick() {
    if (busy) return;
    busy = true;
    try {
      const t = now();
      if (isStudiumShowing()) studiumSeenAt = t;
      const s = store.get();
      const choice = L.chooseOpenProject({
        statuses: L.parseStatuses(s.petStatuses ?? null)?.pets ?? [],
        prefs: L.cleanPrefs(s.petPrefs),
        petAway: L.parseAway(s.petAway, t),
        checkIn: L.parseCheckIn(s.petCheckIn),
        hidden: s.petHidden === true,
        now: t,
        lastOpenAt: Number.isFinite(s.petOpenAt) ? s.petOpenAt : 0,
        studiumSeenAt,
        timing: L.mischiefTiming(s.petTimingOverride),
      });
      // The pet's project page, scrolled to its habitat.
      if (choice && (await openQuietly(L.projectLink(choice.projectId, choice.petId)))) {
        store.set({ petOpenAt: t });
        studiumSeenAt = t;
      }
    } finally {
      busy = false;
    }
  }

  const timer = setTimer(() => {
    tick().catch((e) => console.error(e));
  }, TICK_MS);
  return { tick, dispose: () => clearTimer(timer) };
}

module.exports = { createOpenProjectTimer };

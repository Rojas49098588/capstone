// Which pets' habitats are showing in the Studium window. The pet code there reports the habitat
// boxes on the page (one per pet: a project's first pet and the pets bought for it); they only count
// while the window is visible and not minimized (a hidden window isn't a project page showing, so its
// pets stay on the desktop). Pure: no Electron here.

/** A report as a list of habitat ids: an older page sent one id (or null). */
function cleanIds(ids) {
  const list = Array.isArray(ids) ? ids : [ids];
  return list.filter((id) => typeof id === 'string' && id);
}

function createHabitatTracker(onChange) {
  let reported = [];
  let visible = false;
  let minimized = false;
  let current = [];

  function update() {
    const next = visible && !minimized ? reported : [];
    if (next.join('\n') === current.join('\n')) return;
    current = next;
    onChange(current);
  }

  return {
    /** The habitat boxes now on the Studium page (pet ids, in page order). */
    report(ids) {
      reported = cleanIds(ids);
      update();
    },
    setWindow(state) {
      visible = Boolean(state.visible);
      minimized = Boolean(state.minimized);
      update();
    },
    /** The page reloaded or crashed: forget its boxes until it reports again. */
    reset() {
      reported = [];
      update();
    },
    get: () => current,
  };
}

module.exports = { createHabitatTracker };

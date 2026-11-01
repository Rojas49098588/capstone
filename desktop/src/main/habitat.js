// Which project's habitat is showing in the Studium window. The pet code there reports the habitat
// box on the page; it only counts while the window is visible and not minimized (a hidden window
// isn't a project page showing, so its pet stays on the desktop). Pure: no Electron here.

function createHabitatTracker(onChange) {
  let reported = null;
  let visible = false;
  let minimized = false;
  let current = null;

  function update() {
    const next = visible && !minimized ? reported : null;
    if (next === current) return;
    current = next;
    onChange(current);
  }

  return {
    /** The habitat box now on the Studium page (a project id), or null. */
    report(projectId) {
      reported = typeof projectId === 'string' && projectId ? projectId : null;
      update();
    },
    setWindow(state) {
      visible = Boolean(state.visible);
      minimized = Boolean(state.minimized);
      update();
    },
    /** The page reloaded or crashed: forget its box until it reports again. */
    reset() {
      reported = null;
      update();
    },
    get: () => current,
  };
}

module.exports = { createHabitatTracker };

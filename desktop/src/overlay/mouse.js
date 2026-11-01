// Click-through for the pet overlay. The window ignores the mouse (clicks reach the apps
// underneath, moves are still forwarded here) except while the pointer is over a pet or its
// bubble, menu or note, while a pet menu is open (so a click anywhere closes it), or during a drag.
// It re-checks every MOUSE_RECHECK_MS too, so a pet that vanishes under a still pointer (hidden,
// asleep, rebuilt) gives the mouse back without the user having to move it.

const MOUSE_RECHECK_MS = 250;

function wantsMouse({ overPet, menuOpen, pressing }) {
  return Boolean(overPet || menuOpen || pressing);
}

/** Calls send(wants) only when it changes. Starts letting clicks through. */
function createMouseGate(send) {
  let current = false;
  return {
    update(wants) {
      if (wants === current) return;
      current = wants;
      send(wants);
    },
  };
}

if (typeof window !== 'undefined' && globalThis.petBridge) {
  const gate = createMouseGate((wants) => globalThis.petBridge.setMouse(wants));
  let point = null; // the last pointer position, in window pixels
  let pressing = false;

  const overPet = () => {
    if (!point) return false;
    const host = document.getElementById('capstone-pet-host');
    const root = host?.shadowRoot;
    if (!root || host.style.display === 'none') return false;
    const hit = root.elementFromPoint(point.x, point.y);
    return Boolean(hit) && root.contains(hit);
  };

  const check = () => gate.update(wantsMouse({ overPet: overPet(), menuOpen: globalThis.PetMenu?.isOpen() === true, pressing }));

  const move = (e) => {
    point = { x: e.clientX, y: e.clientY };
    check();
  };
  window.addEventListener('mousemove', move, true);
  window.addEventListener('pointermove', move, true);
  window.addEventListener('pointerdown', (e) => {
    point = { x: e.clientX, y: e.clientY };
    pressing = overPet();
    check();
  }, true);
  const release = () => {
    pressing = false;
    check();
  };
  window.addEventListener('pointerup', release, true);
  window.addEventListener('pointercancel', release, true);
  document.addEventListener('mouseleave', () => {
    point = null;
    check();
  });
  setInterval(check, MOUSE_RECHECK_MS);
}

if (typeof module !== 'undefined') module.exports = { MOUSE_RECHECK_MS, wantsMouse, createMouseGate };

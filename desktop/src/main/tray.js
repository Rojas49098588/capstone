// The tray icon near the clock: the extension's toolbar-icon menu, plus Quit.
// trayItems, trayTooltip and handleTrayClick are pure; createTray wires them to Electron.

/** The menu: Open Studium, Show/Hide pets, Reload pets, Wake <pet> for each away pet, Quit. */
function trayItems(L, { statuses, away, hidden }) {
  return [
    { id: 'open', label: 'Open Studium' },
    { id: 'toggle-pets', label: hidden ? 'Show pets' : 'Hide pets' },
    // A fresh pet window, for when the pets stop taking clicks (see overlayWindow.js).
    { id: 'reload-pets', label: 'Reload pets' },
    ...L.wakeMenuEntries(away, statuses).map((e) => ({ id: e.id, label: e.title })),
    { type: 'separator' },
    { id: 'quit', label: 'Quit Studium' },
  ];
}

function trayTooltip(statuses) {
  return statuses?.pets?.length > 0 ? 'Studium' : 'Studium: no pets yet. Create a project to get one.';
}

function handleTrayClick(id, { store, runner, open, quit, reloadPets }) {
  if (id === 'open') open();
  else if (id === 'toggle-pets') store.set({ petHidden: !store.get().petHidden });
  else if (id === 'reload-pets') reloadPets();
  else if (id === 'quit') quit();
  else if (typeof id === 'string' && id.startsWith('wake:')) runner.request({ type: 'wake', petId: id.slice('wake:'.length) });
}

function createTray({ L, store, runner, open, quit, reloadPets, iconPath }) {
  const { Menu, Tray, nativeImage } = require('electron');
  const tray = new Tray(nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 }));
  const click = (id) => handleTrayClick(id, { store, runner, open, quit, reloadPets });

  function refresh() {
    const state = store.get();
    const statuses = L.parseStatuses(state.petStatuses ?? null);
    const items = trayItems(L, { statuses, away: L.parseAway(state.petAway, Date.now()), hidden: state.petHidden === true });
    tray.setContextMenu(Menu.buildFromTemplate(items.map((item) => (item.type ? item : { label: item.label, click: () => click(item.id) }))));
    tray.setToolTip(trayTooltip(statuses));
    // For the end-to-end tests, which can't click the tray.
    Object.assign(globalThis.studiumTest ?? {}, { trayItems: items, trayClick: click });
  }

  tray.on('click', () => open());
  store.onChange((keys) => {
    if (keys.some((k) => k === 'petAway' || k === 'petStatuses' || k === 'petHidden')) refresh();
  });
  refresh();
  return tray;
}

module.exports = { trayItems, trayTooltip, handleTrayClick, createTray };

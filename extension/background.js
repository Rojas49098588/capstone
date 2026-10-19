// Service worker: opens Studium when the toolbar icon is clicked, adds a right-click menu on the
// icon (show/hide the pets, wake an away pet), keeps the icon's tooltip up to date, and runs the
// pets' naps and sleep. It is the only writer of petAway, petCheckIn and new focusOutbox entries;
// the rules themselves are PetLogic.applyAwayRequest in content/logic.js.
importScripts('content/logic.js');

const L = globalThis.PetLogic;
// Studium's address lives in content/logic.js (HOMEPAGE_URL), shared with the content script.
const { HOMEPAGE_URL } = L;
const CONTENT_SCRIPTS = ['content/logic.js', 'content/menu.js', 'content/bridge.js', 'content/pet.js'];

/** Focuses the open Studium tab (or opens one), optionally at a link such as "project=<id>". */
async function openStudium(hash = '') {
  // Reuse an open Studium tab instead of opening a new one each click.
  const [existing] = await chrome.tabs.query({ url: HOMEPAGE_URL + '*' });
  if (existing) {
    // Changing only the hash doesn't reload the page; Studium follows it on hashchange.
    await chrome.tabs.update(existing.id, hash ? { url: L.studiumUrl(hash), active: true } : { active: true });
    await chrome.windows.update(existing.windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url: L.studiumUrl(hash) });
  }
}

chrome.action.onClicked.addListener(() => openStudium());

// Pets come from Studium, so before it has been opened there are none. Say how to get them.
async function updateTitle() {
  const { petStatuses } = await chrome.storage.local.get('petStatuses');
  // Damaged data doesn't count as having opened Studium.
  const usable = L.parseStatuses(petStatuses ?? null);
  await chrome.action.setTitle({ title: usable ? 'Open Studium' : 'Open Studium once to meet your pets' });
}

chrome.runtime.onStartup.addListener(updateTitle);

// ---- Naps and sleep ----
// Requests run one at a time, so a Wake and the nap's alarm can't both end the same nap.
let queue = Promise.resolve();

function update(request) {
  queue = queue.then(() => run(request)).catch((e) => console.error(e));
  return queue;
}

async function run(request) {
  const stored = await chrome.storage.local.get(['petAway', 'focusOutbox', 'petCheckIn', 'petStatuses', 'petTimingOverride']);
  const now = Date.now();
  const state = {
    petAway: L.parseAway(stored.petAway, now),
    focusOutbox: L.parseOutbox(stored.focusOutbox),
    petCheckIn: L.parseCheckIn(stored.petCheckIn),
  };
  const ctx = {
    now,
    statuses: L.parseStatuses(stored.petStatuses ?? null),
    napMinutes: L.napMinutesFrom(stored.petTimingOverride),
    newId: () => crypto.randomUUID(),
  };
  const result = L.applyAwayRequest(state, request, ctx);
  if (result.changed) await chrome.storage.local.set(result.state);
  for (const effect of result.effects) {
    if (effect.type === 'setAlarm') await chrome.alarms.create(effect.name, { when: effect.when });
    else if (effect.type === 'clearAlarm') await chrome.alarms.clear(effect.name);
    else if (effect.type === 'open') await openStudium(effect.hash);
  }
}

chrome.runtime.onMessage.addListener((msg) => {
  const request = L.parseRequest(msg);
  if (!request) return;
  if (request.type === 'openProject') openStudium(`project=${encodeURIComponent(request.projectId)}`).catch(console.error);
  else update(request);
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name.startsWith('away:')) update({ type: 'end', projectId: alarm.name.slice('away:'.length) });
});

// The worker starts often (and after Chrome was closed): end naps that are overdue and re-arm the
// alarms of the others.
update({ type: 'endOverdue' });
chrome.runtime.onStartup.addListener(() => update({ type: 'endOverdue' }));

// ---- The toolbar icon's right-click menu ----
// Rebuilt whenever a pet leaves or comes back. Rebuilds run one at a time: two overlapping
// removeAll + create runs fail with a duplicate id.
let menuQueue = Promise.resolve();
globalThis.menuIds = []; // the items created last time (read by the browser check)

function createItem(item) {
  return new Promise((resolve, reject) => {
    chrome.contextMenus.create({ ...item, contexts: ['action'] }, () => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve();
    });
  });
}

function rebuildMenu() {
  menuQueue = menuQueue
    .then(async () => {
      // Chrome keeps menu items across extension updates and reloads, so remove the old ones first.
      await chrome.contextMenus.removeAll();
      const stored = await chrome.storage.local.get(['petAway', 'petStatuses']);
      const items = [
        { id: 'toggle-pet', title: 'Show / hide pet' },
        ...L.wakeMenuEntries(L.parseAway(stored.petAway, Date.now()), L.parseStatuses(stored.petStatuses ?? null)),
      ];
      for (const item of items) await createItem(item);
      globalThis.menuIds = items.map((i) => i.id);
    })
    .catch((e) => console.error(e));
  return menuQueue;
}

async function handleMenuClick(info) {
  if (info.menuItemId === 'toggle-pet') {
    const { petHidden = false } = await chrome.storage.local.get('petHidden');
    // Every tab's content script listens for this change and updates itself.
    await chrome.storage.local.set({ petHidden: !petHidden });
  } else if (typeof info.menuItemId === 'string' && info.menuItemId.startsWith('wake:')) {
    await update({ type: 'wake', projectId: info.menuItemId.slice('wake:'.length) });
  }
}
globalThis.handleMenuClick = handleMenuClick; // the browser check can't click the toolbar menu

chrome.contextMenus.onClicked.addListener((info) => {
  handleMenuClick(info).catch((e) => console.error(e));
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.petStatuses) updateTitle();
  if (changes.petAway || changes.petStatuses) rebuildMenu();
});

chrome.runtime.onInstalled.addListener(async () => {
  rebuildMenu();
  updateTitle();

  // Chrome only runs content scripts on pages loaded after install/reload,
  // so put the pets into tabs that are already open.
  const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*', 'file://*/*'] });
  for (const tab of tabs) {
    chrome.scripting
      .executeScript({ target: { tabId: tab.id }, files: CONTENT_SCRIPTS })
      .catch(() => {}); // Some pages (like the Chrome Web Store) refuse scripts.
  }
});

// Service worker: opens Studium when the toolbar icon is clicked, adds a right-click menu on the
// icon to show/hide the pets, and keeps the icon's tooltip up to date.
importScripts('content/logic.js');

// Studium's address lives in content/logic.js (HOMEPAGE_URL), shared with the content script.
const { HOMEPAGE_URL } = globalThis.PetLogic;

chrome.action.onClicked.addListener(async () => {
  // Reuse an open Studium tab instead of opening a new one each click.
  const [existing] = await chrome.tabs.query({ url: HOMEPAGE_URL + '*' });
  if (existing) {
    await chrome.tabs.update(existing.id, { active: true });
    await chrome.windows.update(existing.windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url: HOMEPAGE_URL });
  }
});

// Pets come from Studium, so before it has been opened there are none. Say how to get them.
async function updateTitle() {
  const { petStatuses } = await chrome.storage.local.get('petStatuses');
  // Damaged data doesn't count as having opened Studium.
  const usable = globalThis.PetLogic.parseStatuses(petStatuses ?? null);
  await chrome.action.setTitle({ title: usable ? 'Open Studium' : 'Open Studium once to meet your pets' });
}

chrome.runtime.onStartup.addListener(updateTitle);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.petStatuses) updateTitle();
});

// The right-click menu on the toolbar icon. Resolves once it exists; rejects with Chrome's error.
// Chrome keeps menu items across extension updates and reloads, so remove the old one first.
async function setUpMenu() {
  await chrome.contextMenus.removeAll();
  return new Promise((resolve, reject) => {
    chrome.contextMenus.create({ id: 'toggle-pet', title: 'Show / hide pet', contexts: ['action'] }, () => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve();
    });
  });
}

chrome.runtime.onInstalled.addListener(async () => {
  setUpMenu().catch((e) => console.error(e));
  updateTitle();

  // Chrome only runs content scripts on pages loaded after install/reload,
  // so put the pets into tabs that are already open.
  const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*', 'file://*/*'] });
  for (const tab of tabs) {
    chrome.scripting
      .executeScript({ target: { tabId: tab.id }, files: ['content/logic.js', 'content/pet.js'] })
      .catch(() => {}); // Some pages (like the Chrome Web Store) refuse scripts.
  }
});

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== 'toggle-pet') return;
  const { petHidden = false } = await chrome.storage.local.get('petHidden');
  // Every tab's content script listens for this change and updates itself.
  await chrome.storage.local.set({ petHidden: !petHidden });
});

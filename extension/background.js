// Service worker: opens the homepage when the toolbar icon is clicked,
// and adds a right-click menu on the icon to show/hide the pet.

// Change this when the homepage is deployed somewhere other than the Vite dev server.
const HOMEPAGE_URL = 'http://localhost:5173/';

chrome.action.onClicked.addListener(async () => {
  // Reuse an open homepage tab instead of opening a new one each click.
  const [existing] = await chrome.tabs.query({ url: HOMEPAGE_URL + '*' });
  if (existing) {
    await chrome.tabs.update(existing.id, { active: true });
    await chrome.windows.update(existing.windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url: HOMEPAGE_URL });
  }
});

chrome.runtime.onInstalled.addListener(async () => {
  chrome.contextMenus.create({
    id: 'toggle-pet',
    title: 'Show / hide pet',
    contexts: ['action'],
  });

  // Chrome only runs content scripts on pages loaded after install/reload,
  // so put the pet into tabs that are already open.
  const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*', 'file://*/*'] });
  for (const tab of tabs) {
    chrome.scripting
      .executeScript({ target: { tabId: tab.id }, files: ['content/pet.js'] })
      .catch(() => {}); // Some pages (like the Chrome Web Store) refuse scripts.
  }
});

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== 'toggle-pet') return;
  const { petHidden = false } = await chrome.storage.local.get('petHidden');
  // Every tab's content script listens for this change and updates itself.
  await chrome.storage.local.set({ petHidden: !petHidden });
});

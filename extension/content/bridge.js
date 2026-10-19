// Content script for the Studium page only: the link between Studium and the background worker.
//   - Mailbox: finished naps wait in chrome.storage.local.focusOutbox until Studium confirms it has
//     saved them. They are sent when this script loads, when the outbox changes and when Studium
//     says it's ready (studium:ready). Studium answers with studium:focus-received.
//   - Wake: the habitat's Wake button dispatches studium:wake-pet.
// Only strings cross between the extension's world and the page safely, so `detail` is JSON text.
(() => {
  if (window.top !== window) return;
  // Same guard as pet.js: a copy injected after a reload may run without the extension's APIs.
  if (typeof chrome === 'undefined' || !chrome.storage || !chrome.runtime?.id) return;
  const L = globalThis.PetLogic; // content/logic.js, loaded first
  if (!L.isStudiumUrl(location.href)) return;

  // A newer copy of this script replaces the old one's listeners.
  globalThis.CapstoneBridge?.abort();
  const controller = new AbortController();
  globalThis.CapstoneBridge = controller;
  const { signal } = controller;
  const alive = () => !signal.aborted && Boolean(chrome.runtime?.id);

  const send = (msg) => {
    if (alive()) chrome.runtime.sendMessage(msg).catch(() => {});
  };

  async function deliver() {
    if (!alive()) return;
    const { focusOutbox } = await chrome.storage.local.get('focusOutbox');
    const sessions = Object.values(L.parseOutbox(focusOutbox));
    if (sessions.length === 0 || !alive()) return;
    window.dispatchEvent(new CustomEvent(L.FOCUS_SESSIONS_EVENT, { detail: JSON.stringify(sessions) }));
  }

  window.addEventListener(L.READY_EVENT, () => deliver().catch(() => {}), { signal });

  window.addEventListener(
    L.FOCUS_RECEIVED_EVENT,
    (e) => {
      let ids;
      try {
        ids = JSON.parse(e.detail);
      } catch {
        return;
      }
      if (Array.isArray(ids) && ids.length > 0 && ids.every((id) => typeof id === 'string')) send({ type: 'delivered', ids });
    },
    { signal },
  );

  window.addEventListener(
    L.WAKE_PET_EVENT,
    (e) => {
      if (typeof e.detail === 'string' && e.detail) send({ type: 'wake', projectId: e.detail });
    },
    { signal },
  );

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.focusOutbox && alive()) deliver().catch(() => {});
  });

  deliver().catch(() => {});
})();

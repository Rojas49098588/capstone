// A stand-in for the few chrome.* calls the extension's pet code (extension/content/pet.js) makes,
// so the same file runs in the desktop app: in the overlay page, and injected into the Studium
// window for habitats. Storage and messages go to the main process through window.petBridge
// (src/preload/petBridge.js); pet art comes from studium://pets/.

function makeChrome(bridge) {
  return {
    runtime: {
      id: 'studium-desktop',
      getURL: (p) => 'studium://pets/' + String(p).replace(/^\/+/, ''),
      sendMessage: (msg) => {
        bridge.send(msg);
        return Promise.resolve();
      },
    },
    storage: {
      local: {
        get: (keys) => bridge.get(keys),
        set: (patch) => {
          bridge.set(patch);
          return Promise.resolve();
        },
      },
      onChanged: {
        addListener: (fn) => bridge.onChanged((changes) => fn(changes, 'local')),
      },
    },
  };
}

// In a page: install it, even over a chrome object the page may already have.
if (typeof globalThis !== 'undefined' && globalThis.petBridge) {
  Object.defineProperty(globalThis, 'chrome', { value: makeChrome(globalThis.petBridge), configurable: true, writable: true });
}

if (typeof module !== 'undefined') module.exports = { makeChrome };

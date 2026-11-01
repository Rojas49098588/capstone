/// <reference types="vite/client" />

// Set by the desktop app's preload script (desktop/src/preload/studium.js); missing in a browser.
interface Window {
  studiumDesktop?: { desktop: true };
}

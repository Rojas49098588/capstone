// Preload for every window of the app (registered on the default session in main.js): exposes
// window.petBridge, which the pet code's chrome stand-in (src/overlay/chromeShim.js) talks through.
// The main process decides, per window, what it accepts (src/main/petChannel.js); a page that
// isn't the overlay or Studium gets nothing back.
// Channels: pets:get (invoke), pets:set, pets:message, overlay:mouse (send), pets:changed (from main).

function installPetBridge({ ipc, expose }) {
  expose('petBridge', {
    get: (keys) => ipc.invoke('pets:get', keys),
    set: (patch) => ipc.send('pets:set', patch),
    send: (msg) => ipc.send('pets:message', msg),
    onChanged: (fn) => ipc.on('pets:changed', (_event, changes) => fn(changes)),
    setMouse: (wants) => ipc.send('overlay:mouse', wants === true),
  });
}

if (typeof process !== 'undefined' && process.type === 'renderer') {
  const { contextBridge, ipcRenderer } = require('electron');
  installPetBridge({ ipc: ipcRenderer, expose: (name, api) => contextBridge.exposeInMainWorld(name, api) });
}

if (typeof module !== 'undefined') module.exports = { installPetBridge };

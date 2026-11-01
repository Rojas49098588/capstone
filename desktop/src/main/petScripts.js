// The pet code injected into the Studium window, so a project page's pet lives in its habitat box
// as it did with the extension. Same files as the overlay page (src/overlay/index.html), with
// PetSurface "habitat": only the box's pet shows, and it saves nothing. Pure: no Electron here.
const path = require('node:path');

function habitatFiles({ petsRoot, overlayDir }) {
  return [
    path.join(overlayDir, 'chromeShim.js'),
    path.join(petsRoot, 'content', 'logic.js'),
    path.join(petsRoot, 'content', 'menu.js'),
    path.join(petsRoot, 'content', 'pet.js'),
  ];
}

/** One script from the files' sources. Each starts on its own line after a ";", so none runs into the next. */
function habitatScript(sources) {
  return 'globalThis.PetSurface = "habitat";\n' + sources.join('\n;\n');
}

module.exports = { habitatFiles, habitatScript };

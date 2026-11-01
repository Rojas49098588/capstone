// Plays the pets' sounds in the overlay (pet.js decides when: Moderate, Pet sounds on, at most one
// every 30 seconds). The files are extension/assets/sounds/<key>.wav, served on studium://pets/.
(() => {
  const VOLUME = globalThis.PetLogic?.MISCHIEF.SOUND_VOLUME ?? 0.3;
  globalThis.PetSound = {
    play(key) {
      if (typeof key !== 'string' || !/^[a-z]+$/.test(key)) return;
      const audio = new Audio(`studium://pets/assets/sounds/${key}.wav`);
      audio.volume = VOLUME;
      audio.play().catch(() => {}); // a missing file or a blocked play is just silence
    },
  };
})();

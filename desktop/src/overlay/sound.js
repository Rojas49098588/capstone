// Plays the pets' sounds in the overlay (pet.js decides when: Moderate, Pet sounds on, at most one
// every 30 seconds). The files are extension/assets/sounds/<key>.wav, served on studium://pets/.
(() => {
  globalThis.PetSound = {
    /** volume: 0 to 1, from Settings → Sound. */
    play(key, volume) {
      if (typeof key !== 'string' || !/^[a-z]+$/.test(key)) return;
      const audio = new Audio(`studium://pets/assets/sounds/${key}.wav`);
      audio.volume = typeof volume === 'number' && volume >= 0 && volume <= 1 ? volume : 0.3;
      audio.play().catch(() => {}); // a missing file or a blocked play is just silence
    },
  };
})();

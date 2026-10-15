// Pure helpers shared by the content script (pet.js), the service worker (background.js) and the
// tests in web/src/extension/. No chrome.*, window or document here. Wrapped in a function so it can
// be injected into a tab more than once.
(() => {
  // Where Studium runs. Change this when Studium is deployed somewhere else.
  const HOMEPAGE_URL = 'http://localhost:5173/';
  const PET_STATUS_KEY = 'studium-pets-v1';
  const PET_STATUS_EVENT = 'studium:pets-updated';
  const IDLE_MESSAGE_GAP_MS = 120000; // at most one "Haven't seen …" per pet every 2 minutes

  const PET_KINDS = ['cat', 'dog', 'frog', 'pigeon', 'turtle'];
  const MOODS = ['Proud', 'Delighted', 'Happy', 'Worried', 'Upset', 'Sick'];

  // How each mood changes a pet (spec section 5):
  //   speed: walking, rising and sideways-jump speed; soundEvery: multiplies the time between sounds
  //   sound/soundMs: replaces what it says and how often; pause: multiplies pauses between moves
  //   nap: multiplies nap chance; noNap/noFly: never; extraHopChance: hops in place sometimes
  const MOOD_EFFECTS = {
    Proud: { speed: 1.2, soundEvery: 0.5, extraHopChance: 0.25 },
    Delighted: { speed: 1.2, soundEvery: 0.5, extraHopChance: 0.25 },
    Happy: { speed: 1 },
    Worried: { speed: 0.7, soundEvery: 2 },
    Upset: { speed: 0.5, sound: '…', soundMs: [20000, 40000], pause: 1.6, nap: 1.5 },
    Sick: { speed: 0.3, sound: 'Achoo!', soundMs: [30000, 60000], noNap: true, noFly: true, tint: true },
  };

  function isStudiumUrl(href, homepage = HOMEPAGE_URL) {
    try {
      return new URL(href).origin === new URL(homepage).origin;
    } catch {
      return false;
    }
  }

  const text = (v) => typeof v === 'string' && v.length > 0;
  // The color goes into the pet's inline style, so only plain hex colors are allowed.
  const isHexColor = (v) => typeof v === 'string' && /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v);

  function cleanStatus(p) {
    if (!p || typeof p !== 'object') return null;
    if (!text(p.projectId) || !PET_KINDS.includes(p.petKind) || !MOODS.includes(p.mood)) return null;
    const idle = p.idleRequirement;
    return {
      projectId: p.projectId,
      shortName: text(p.shortName) ? p.shortName : p.projectId,
      name: text(p.name) ? p.name : p.projectId,
      color: isHexColor(p.color) ? p.color : '#2d3a8c',
      petKind: p.petKind,
      mood: p.mood,
      recovering: p.recovering === true,
      idleRequirement:
        idle && text(idle.title) && Number.isFinite(idle.days) ? { title: idle.title, days: Math.round(idle.days) } : null,
    };
  }

  /** Reads Studium's pet statuses (JSON text or an object). Null if they can't be used at all. */
  function parseStatuses(raw) {
    let value = raw;
    if (typeof raw === 'string') {
      try {
        value = JSON.parse(raw);
      } catch {
        return null;
      }
    }
    if (!value || typeof value !== 'object' || !Array.isArray(value.pets)) return null;
    const seen = new Set();
    const pets = [];
    for (const p of value.pets) {
      const clean = cleanStatus(p);
      if (clean && !seen.has(clean.projectId)) {
        seen.add(clean.projectId);
        pets.push(clean);
      }
    }
    return { updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : '', pets };
  }

  /** Saved pet positions ({ [projectId]: { xRatio } }), keeping only usable entries. */
  function parsePositions(raw) {
    const out = {};
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
    for (const [id, pos] of Object.entries(raw)) {
      if (pos && typeof pos === 'object' && Number.isFinite(pos.xRatio)) {
        out[id] = { xRatio: Math.min(1, Math.max(0, pos.xRatio)) };
      }
    }
    return out;
  }

  /** Same pets with the same looks and moods; the time stamp doesn't matter. */
  function statusesEqual(a, b) {
    return JSON.stringify(a?.pets ?? null) === JSON.stringify(b?.pets ?? null);
  }

  const scale = (range, factor) => [range[0] * factor, range[1] * factor];

  /** A copy of a KINDS entry with the mood's effects applied. */
  function applyMood(kind, mood) {
    const e = MOOD_EFFECTS[mood] ?? MOOD_EFFECTS.Happy;
    const k = { ...kind };
    if (kind.walkSpeed) k.walkSpeed = kind.walkSpeed * e.speed;
    if (kind.riseSpeed) k.riseSpeed = kind.riseSpeed * e.speed;
    if (kind.jumpSideways) k.jumpSideways = scale(kind.jumpSideways, e.speed);
    if (e.sound) {
      // Also gives quiet animals (the turtle) something to say.
      k.sound = e.sound;
      k.soundMs = e.soundMs;
    } else if (kind.soundMs && e.soundEvery) {
      k.soundMs = scale(kind.soundMs, e.soundEvery);
    }
    if (e.pause && kind.idleMs) k.idleMs = scale(kind.idleMs, e.pause);
    if (e.nap && kind.napChance) k.napChance = Math.min(0.9, kind.napChance * e.nap);
    if (e.noNap) k.napChance = 0;
    if (e.noFly) k.flyChance = 0;
    k.extraHopChance = e.extraHopChance ?? 0;
    k.tint = Boolean(e.tint);
    return k;
  }

  function idleMessage(idle) {
    return idle ? `Haven't seen ${idle.title} in ${idle.days} ${idle.days === 1 ? 'day' : 'days'}` : null;
  }

  /** When the next "Haven't seen …" may show: 2 to 4 minutes from now. */
  function nextIdleMessageAt(now, random = Math.random) {
    return now + IDLE_MESSAGE_GAP_MS * (1 + random());
  }

  // A pet's world: its left edge on screen, how far its floor is above the window's bottom edge,
  // and its size. Pet positions (x from the left wall, y up from the floor) are inside it.
  function windowWorld(width, height) {
    return { left: 0, bottom: 0, width, height };
  }

  function worldFromRect(rect, viewportHeight) {
    return { left: rect.left, bottom: viewportHeight - rect.bottom, width: rect.width, height: rect.height };
  }

  /** Where a dragged pet is (before clamping), given the pointer and where it grabbed the pet. */
  function dragPosition(pointer, offset, world, petHeight, viewportHeight) {
    return {
      x: pointer.x - offset.x - world.left,
      y: viewportHeight - world.bottom - petHeight - (pointer.y - offset.y),
    };
  }

  /** A CSS clip-path that only draws inside the box (plus headroom above it for speech bubbles). */
  function habitatClip(rect, viewportWidth, viewportHeight, headroom = 40) {
    const top = Math.max(0, rect.top - headroom);
    const right = Math.max(0, viewportWidth - rect.right);
    const bottom = Math.max(0, viewportHeight - rect.bottom);
    const left = Math.max(0, rect.left);
    return `inset(${top}px ${right}px ${bottom}px ${left}px)`;
  }

  globalThis.PetLogic = {
    HOMEPAGE_URL,
    PET_STATUS_KEY,
    PET_STATUS_EVENT,
    IDLE_MESSAGE_GAP_MS,
    MOOD_EFFECTS,
    isStudiumUrl,
    parseStatuses,
    parsePositions,
    statusesEqual,
    applyMood,
    idleMessage,
    nextIdleMessageAt,
    windowWorld,
    worldFromRect,
    dragPosition,
    habitatClip,
  };
})();

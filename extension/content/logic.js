// Pure helpers shared by the content script (pet.js), the service worker (background.js) and the
// tests in web/src/extension/. No chrome.*, window or document here. Wrapped in a function so it can
// be injected into a tab more than once.
(() => {
  // Where Studium runs. Change this when Studium is deployed somewhere else.
  const HOMEPAGE_URL = 'http://localhost:5173/';
  const PET_STATUS_KEY = 'studium-pets-v1';
  const PET_STATUS_EVENT = 'studium:pets-updated';
  const IDLE_MESSAGE_GAP_MS = 120000; // at most one "Haven't seen …" per pet every 2 minutes

  // Pet interactions (spec 2026-10-19-pet-interactions-design.md). Studium's store/petStatus.ts
  // uses the same event and attribute names.
  const NAP_MINUTES = 15;
  const SLEEP_HOURS = [1, 2];
  const MAX_AWAY_MS = 2 * 3600000; // an away entry further ahead than this is damaged
  const SUGGESTION_BUBBLE_MS = 6000;
  const FOCUS_SESSIONS_EVENT = 'studium:focus-sessions';
  const FOCUS_RECEIVED_EVENT = 'studium:focus-received';
  const READY_EVENT = 'studium:ready';
  const WAKE_PET_EVENT = 'studium:wake-pet';
  const PET_AWAY_ATTR = 'data-pet-away';
  const CELEBRATION_KINDS = ['task', 'firstTask', 'requirement'];

  // Habitat decor (spec 2026-10-19-habitat-decor-design.md). Where each spot sits in the habitat box,
  // as fractions of the box: x = centre from the left, y = bottom above the box's floor, w/h = size.
  // Must match Studium's web/src/ui/decorLayout.ts (web/src/extension/decorLayout.test.ts checks).
  const SLOT_POSITIONS = {
    floorLeft: { x: 0.18, y: 0.04, w: 0.2, h: 0.32 },
    floorMiddle: { x: 0.5, y: 0.02, w: 0.3, h: 0.16 },
    floorRight: { x: 0.82, y: 0.04, w: 0.2, h: 0.32 },
    wallLeft: { x: 0.14, y: 0.5, w: 0.14, h: 0.28 },
    wallRight: { x: 0.86, y: 0.5, w: 0.14, h: 0.28 },
  };
  const FURNITURE_USES = ['bed', 'scratch', 'bask', 'perch', 'lounge'];
  /** Which furniture each kind of pet uses (besides the bed, which every pet uses). */
  const KIND_USE = { cat: 'scratch', turtle: 'bask', pigeon: 'perch', dog: 'lounge', frog: 'lounge' };
  /** How high a pet sits on floor furniture, as a fraction of the box's height. */
  const SEAT = { bed: 0.06, lounge: 0.14, scratch: 0, bask: 0 };

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

  const isTime = (v) => text(v) && Number.isFinite(Date.parse(v));
  const isObject = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
  const textOrNull = (v) => v === null || text(v);

  function cleanSuggestion(s) {
    return isObject(s) && text(s.taskId) && text(s.title) && Number.isFinite(s.estimateMin) && s.estimateMin > 0
      ? { taskId: s.taskId, title: s.title, estimateMin: s.estimateMin }
      : null;
  }

  function cleanCelebration(c) {
    return isObject(c) && text(c.at) && CELEBRATION_KINDS.includes(c.kind) ? { at: c.at, kind: c.kind } : null;
  }

  /** What the pet can use in its habitat: [{ use, slot }], valid entries only (old statuses: none). */
  function cleanFurniture(list) {
    if (!Array.isArray(list)) return [];
    return list
      .filter((f) => isObject(f) && FURNITURE_USES.includes(f.use) && Object.hasOwnProperty.call(SLOT_POSITIONS, f.slot))
      .map((f) => ({ use: f.use, slot: f.slot }));
  }

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
      // Missing in statuses from older Studium builds.
      suggestion: cleanSuggestion(p.suggestion),
      celebration: cleanCelebration(p.celebration),
      furniture: cleanFurniture(p.furniture),
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

  /**
   * Same pets with the same looks and moods. The time stamp, suggestions and celebrations don't
   * matter: they change with every task but don't change how a pet looks, so they mustn't rebuild pets.
   * Furniture does count, so the habitat pet learns what it can use.
   */
  function statusesEqual(a, b) {
    const looks = (s) => s?.pets?.map(({ suggestion, celebration, ...rest }) => rest) ?? null;
    return JSON.stringify(looks(a)) === JSON.stringify(looks(b));
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

  // ---- Pet interactions: naps, sleep, check-ins and the focus outbox ----
  // State in chrome.storage.local, written only by the service worker:
  //   petAway: { [projectId]: { kind: 'nap' | 'sleep', id, startedAt, until, taskId, taskTitle } }
  //   focusOutbox: { [sessionId]: FocusSession }   finished naps waiting for Studium
  //   petCheckIn: { projectId, taskId, taskTitle, minutes, at } | null

  function cleanAway(e, now) {
    if (!isObject(e) || (e.kind !== 'nap' && e.kind !== 'sleep') || !text(e.id)) return null;
    if (!isTime(e.startedAt) || !isTime(e.until) || !textOrNull(e.taskId) || !textOrNull(e.taskTitle)) return null;
    const until = Date.parse(e.until);
    if (until < Date.parse(e.startedAt) || until - now > MAX_AWAY_MS) return null;
    return { kind: e.kind, id: e.id, startedAt: e.startedAt, until: e.until, taskId: e.taskId, taskTitle: e.taskTitle };
  }

  /** The away pets, keeping only usable entries. One more than 2 hours ahead can't hide a pet forever. */
  function parseAway(raw, now) {
    const out = {};
    if (!isObject(raw)) return out;
    for (const [id, e] of Object.entries(raw)) {
      const clean = cleanAway(e, now);
      if (clean) out[id] = clean;
    }
    return out;
  }

  function cleanSession(s) {
    if (!isObject(s) || !text(s.id) || !text(s.projectId) || !text(s.startedAt) || !text(s.at)) return null;
    if (!textOrNull(s.taskId) || !Number.isFinite(s.minutes) || s.minutes < 0) return null;
    return { id: s.id, projectId: s.projectId, taskId: s.taskId, startedAt: s.startedAt, at: s.at, minutes: s.minutes };
  }

  function parseOutbox(raw) {
    const out = {};
    if (!isObject(raw)) return out;
    for (const [id, s] of Object.entries(raw)) {
      const clean = cleanSession(s);
      if (clean && clean.id === id) out[id] = clean;
    }
    return out;
  }

  function parseCheckIn(raw) {
    if (!isObject(raw) || !text(raw.projectId) || !textOrNull(raw.taskId) || !textOrNull(raw.taskTitle)) return null;
    if (!Number.isFinite(raw.minutes) || raw.minutes < 0 || !text(raw.at)) return null;
    return { projectId: raw.projectId, taskId: raw.taskId, taskTitle: raw.taskTitle, minutes: raw.minutes, at: raw.at };
  }

  /** petTimingOverride ({ napMinutes }) only exists so the browser check doesn't wait 15 minutes. */
  function napMinutesFrom(override) {
    const m = override?.napMinutes;
    return Number.isFinite(m) && m > 0 && m <= NAP_MINUTES ? m : NAP_MINUTES;
  }

  /** A message from a content script, or null if it isn't one the worker accepts. */
  function parseRequest(msg) {
    if (!isObject(msg)) return null;
    switch (msg.type) {
      case 'nap':
      case 'wake':
      case 'openProject':
        return text(msg.projectId) ? { type: msg.type, projectId: msg.projectId } : null;
      case 'sleep':
        return text(msg.projectId) && SLEEP_HOURS.includes(msg.hours)
          ? { type: 'sleep', projectId: msg.projectId, hours: msg.hours }
          : null;
      case 'checkIn':
        return ['done', 'notYet', 'later'].includes(msg.answer) ? { type: 'checkIn', answer: msg.answer } : null;
      case 'delivered':
        return Array.isArray(msg.ids) && msg.ids.every(text) ? { type: 'delivered', ids: [...msg.ids] } : null;
      default:
        return null;
    }
  }

  const alarmName = (projectId) => `away:${projectId}`;
  const statusFor = (statuses, projectId) => statuses?.pets?.find((p) => p.projectId === projectId) ?? null;
  const isNapping = (petAway) => Object.values(petAway).some((e) => e.kind === 'nap');
  const without = (obj, key) => Object.fromEntries(Object.entries(obj).filter(([k]) => k !== key));

  function startAway(state, projectId, kind, ms, task, ctx) {
    const until = ctx.now + ms;
    const entry = {
      kind,
      id: ctx.newId(),
      startedAt: new Date(ctx.now).toISOString(),
      until: new Date(until).toISOString(),
      taskId: task?.taskId ?? null,
      taskTitle: task?.title ?? null,
    };
    // A new nap supersedes a pending check-in for the same pet.
    const petCheckIn = kind === 'nap' && state.petCheckIn?.projectId === projectId ? null : state.petCheckIn;
    return {
      state: { ...state, petAway: { ...state.petAway, [projectId]: entry }, petCheckIn },
      effects: [{ type: 'setAlarm', name: alarmName(projectId), when: until }],
      changed: true,
    };
  }

  const canStart = (state, projectId, ctx) => Boolean(statusFor(ctx.statuses, projectId)) && !state.petAway[projectId];

  /** One nap at a time. `task` is { taskId, title } or null. */
  function startNap(state, projectId, task, ctx) {
    if (!canStart(state, projectId, ctx) || isNapping(state.petAway)) return null;
    return startAway(state, projectId, 'nap', ctx.napMinutes * 60000, task, ctx);
  }

  /** Brings a pet back. A nap becomes a focus session and a check-in; a sleep records nothing. */
  function endAway(state, projectId, now) {
    const entry = state.petAway[projectId];
    if (!entry) return null;
    let { focusOutbox, petCheckIn } = state;
    if (entry.kind === 'nap') {
      const started = Date.parse(entry.startedAt);
      // Never more than the nap's own length, even if Chrome was closed for hours.
      const planned = Math.floor((Date.parse(entry.until) - started) / 60000);
      const minutes = Math.min(planned, Math.max(0, Math.floor((now - started) / 60000)));
      const at = new Date(now).toISOString();
      focusOutbox = {
        ...focusOutbox,
        [entry.id]: { id: entry.id, projectId, taskId: entry.taskId, startedAt: entry.startedAt, at, minutes },
      };
      petCheckIn = { projectId, taskId: entry.taskId, taskTitle: entry.taskTitle, minutes, at };
    }
    return {
      state: { petAway: without(state.petAway, projectId), focusOutbox, petCheckIn },
      effects: [{ type: 'clearAlarm', name: alarmName(projectId) }],
      changed: true,
    };
  }

  /**
   * The worker's whole state machine. Returns the new state, the effects for the worker to carry out
   * ({ type: 'setAlarm', name, when } | { type: 'clearAlarm', name } | { type: 'open', hash }) and
   * whether anything changed. Never changes `state`.
   *   state: { petAway, focusOutbox, petCheckIn }, already parsed
   *   request: a parseRequest() result, { type: 'end', projectId } (its alarm) or { type: 'endOverdue' }
   *   ctx: { now (ms), statuses (parsed), napMinutes, newId() }
   */
  function applyAwayRequest(state, request, ctx) {
    const unchanged = { state, effects: [], changed: false };
    switch (request.type) {
      case 'nap': {
        const suggestion = statusFor(ctx.statuses, request.projectId)?.suggestion ?? null;
        return startNap(state, request.projectId, suggestion, ctx) ?? unchanged;
      }
      case 'sleep':
        if (!canStart(state, request.projectId, ctx)) return unchanged;
        return startAway(state, request.projectId, 'sleep', request.hours * 3600000, null, ctx);
      case 'wake':
      case 'end':
        return endAway(state, request.projectId, ctx.now) ?? unchanged;
      case 'endOverdue': {
        // After Chrome was closed or the worker restarted: end what's due, re-arm the rest.
        let result = unchanged;
        const effects = [];
        for (const [projectId, entry] of Object.entries(state.petAway)) {
          if (Date.parse(entry.until) <= ctx.now) {
            result = endAway(result.state, projectId, ctx.now);
            effects.push(...result.effects);
          } else {
            effects.push({ type: 'setAlarm', name: alarmName(projectId), when: Date.parse(entry.until) });
          }
        }
        return { state: result.state, effects, changed: result.changed };
      }
      case 'checkIn': {
        const c = state.petCheckIn;
        if (!c) return unchanged;
        const cleared = { ...state, petCheckIn: null };
        if (request.answer === 'done') {
          const hash = c.taskId ? `complete=${encodeURIComponent(c.taskId)}` : `project=${encodeURIComponent(c.projectId)}`;
          return { state: cleared, effects: [{ type: 'open', hash }], changed: true };
        }
        if (request.answer === 'notYet' && c.taskId) {
          const again = startNap(cleared, c.projectId, { taskId: c.taskId, title: c.taskTitle }, ctx);
          if (again) return again;
        }
        return { state: cleared, effects: [], changed: true };
      }
      case 'delivered': {
        const ids = new Set(request.ids);
        if (!Object.keys(state.focusOutbox).some((id) => ids.has(id))) return unchanged;
        const focusOutbox = Object.fromEntries(Object.entries(state.focusOutbox).filter(([id]) => !ids.has(id)));
        return { state: { ...state, focusOutbox }, effects: [], changed: true };
      }
      default:
        return unchanged;
    }
  }

  /** Studium's address, with an optional link such as "project=<id>" (ids already encoded). */
  function studiumUrl(hash = '') {
    return hash ? `${HOMEPAGE_URL}#${hash}` : HOMEPAGE_URL;
  }

  // ---- The pet menu and its wording ----

  const shortNameOf = (statuses, projectId) => statusFor(statuses, projectId)?.shortName ?? projectId;

  /** The right-click menu for one pet: [{ id, label, disabled?, hint?, children? }]. */
  function petMenuItems(projectId, petAway, statuses) {
    const open = { id: 'open', label: 'Open project' };
    if (petAway[projectId]) return [{ id: 'wake', label: 'Wake' }, open];
    const napItem = { id: 'nap', label: `Nap (${NAP_MINUTES} min)` };
    const napping = Object.entries(petAway).find(([, e]) => e.kind === 'nap');
    if (napping) {
      napItem.disabled = true;
      napItem.hint = `Already focusing on ${napping[1].taskTitle ?? shortNameOf(statuses, napping[0])}`;
    }
    return [
      { id: 'suggest', label: 'What should I work on?' },
      napItem,
      {
        id: 'sleep',
        label: 'Sleep',
        children: [
          { id: 'sleep1', label: '1 hour' },
          { id: 'sleep2', label: '2 hours' },
        ],
      },
      open,
    ];
  }

  /** The toolbar icon's right-click menu gets one Wake item per away pet. */
  function wakeMenuEntries(petAway, statuses) {
    return Object.keys(petAway).map((id) => ({ id: `wake:${id}`, title: `Wake ${shortNameOf(statuses, id)}` }));
  }

  /** Same wording as Studium's formatMinutes. */
  function formatMinutes(minutes) {
    const m = Math.max(0, Math.round(minutes));
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60);
    const rest = m % 60;
    return rest ? `${h} h ${rest} min` : `${h} h`;
  }

  function suggestionText(suggestion) {
    return suggestion
      ? `Next up: ${suggestion.title} (~${formatMinutes(suggestion.estimateMin)})`
      : "Nothing to suggest: everything's done or waiting on something.";
  }

  function checkInPrompt(checkIn) {
    if (checkIn.taskId) {
      return {
        text: `Did you finish ${checkIn.taskTitle ?? 'your task'}?`,
        buttons: [
          { answer: 'done', label: 'Done' },
          { answer: 'notYet', label: 'Not yet' },
          { answer: 'later', label: 'Later' },
        ],
      };
    }
    return {
      text: 'Back! How did it go?',
      buttons: [
        { answer: 'done', label: 'Open project' },
        { answer: 'later', label: 'OK' },
      ],
    };
  }

  // Every completion celebrates; a project's first completed task and a finished requirement celebrate bigger.
  function celebrationText(kind) {
    if (kind === 'requirement') return 'Requirement finished!';
    if (kind === 'firstTask') return 'First task done!';
    return 'Task done!';
  }

  function celebrationHops(kind) {
    return kind === 'requirement' || kind === 'firstTask' ? 2 : 1;
  }

  /**
   * Which pets should celebrate. `seen` ({ [projectId]: at }) is what this tab has already seen. It
   * stays null until the first real statuses, which only fill it in, so old completions don't celebrate.
   */
  function newCelebrations(seen, statuses) {
    if (!statuses) return { seen, celebrate: [] };
    const next = {};
    const celebrate = [];
    for (const p of statuses.pets) {
      if (!p.celebration) continue;
      next[p.projectId] = p.celebration.at;
      const before = seen?.[p.projectId];
      if (seen && (before === undefined || Date.parse(p.celebration.at) > Date.parse(before))) {
        celebrate.push({ projectId: p.projectId, kind: p.celebration.kind });
      }
    }
    return { seen: next, celebrate };
  }

  /** The value of data-pet-away on the habitat box. */
  function awayAttribute(entry) {
    return `${entry.kind}:${entry.until}`;
  }

  /** While any pet naps, the others go quiet. */
  function isQuiet(petAway) {
    return isNapping(petAway);
  }

  /** Top-left corner for a menu opened at `point`, kept inside the window. */
  function menuPosition(point, size, viewport, margin = 8) {
    const fitsBelow = point.y + size.height <= viewport.height - margin;
    const top = fitsBelow ? point.y : point.y - size.height;
    return {
      left: Math.max(margin, Math.min(point.x, viewport.width - size.width - margin)),
      top: Math.max(margin, Math.min(top, viewport.height - size.height - margin)),
    };
  }

  // ---- Habitat furniture ----

  /** The furniture this kind of pet uses, if its habitat has it. */
  function ownFurniture(petKind, furniture) {
    return (furniture ?? []).find((f) => f.use === KIND_USE[petKind]) ?? null;
  }

  function bedOf(furniture) {
    return (furniture ?? []).find((f) => f.use === 'bed') ?? null;
  }

  /**
   * Where a pet stands to use a piece of furniture, in its world (the habitat box): x from the left
   * wall (the pet's left edge, centred on the furniture), y above the floor.
   */
  function furnitureSpot(entry, world, petW) {
    const slot = SLOT_POSITIONS[entry.slot];
    const x = Math.min(Math.max(0, slot.x * world.width - petW / 2), Math.max(0, world.width - petW));
    const onWall = entry.slot === 'wallLeft' || entry.slot === 'wallRight';
    const y = (onWall ? slot.y + slot.h * 0.35 : SEAT[entry.use] ?? 0) * world.height;
    return { x, y };
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
    NAP_MINUTES,
    MAX_AWAY_MS,
    SUGGESTION_BUBBLE_MS,
    FOCUS_SESSIONS_EVENT,
    FOCUS_RECEIVED_EVENT,
    READY_EVENT,
    WAKE_PET_EVENT,
    PET_AWAY_ATTR,
    parseAway,
    parseOutbox,
    parseCheckIn,
    napMinutesFrom,
    parseRequest,
    applyAwayRequest,
    studiumUrl,
    petMenuItems,
    wakeMenuEntries,
    formatMinutes,
    suggestionText,
    checkInPrompt,
    celebrationText,
    celebrationHops,
    newCelebrations,
    awayAttribute,
    isQuiet,
    menuPosition,
    SLOT_POSITIONS,
    FURNITURE_USES,
    KIND_USE,
    ownFurniture,
    bedOf,
    furnitureSpot,
  };
})();

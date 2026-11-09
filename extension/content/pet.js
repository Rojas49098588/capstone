// Content script: draws one pet per Studium project on every page and remembers where
// each one was, so they appear in the same spots when you switch pages or tabs.
//
// Pets come from Studium. On the Studium page this script copies Studium's pet statuses
// (localStorage "studium-pets-v1") into chrome.storage as `petStatuses`, and every tab rebuilds
// its pets from there. Before Studium has been opened there are no pets.
//
// Every pet can be dragged, thrown (it flies with momentum and bounces) and clicked (it hops
// and makes its sound). Each kind of animal has its own habits (KINDS below), and its mood
// changes how fast it moves and how often it talks (PetLogic.applyMood in logic.js).
// Art lives in extension/assets/pets/.
//
// How many pets show around the page at once, and which first, are User Settings in Studium
// (petScreen below);
// on a project page only that project's pet shows, in its habitat.
//
// Right-clicking a pet opens its menu (content/menu.js): What should I work on?, Nap (a 15-minute
// focus timer), Sleep (1 or 2 hours) and Open project. The background worker runs the timers and
// writes petAway / petCheckIn; this script only shows them: away pets are hidden (or asleep in their
// habitat), the others go quiet during a nap, and a returning pet asks how it went. Pets also
// celebrate tasks completed in Studium.
//
// In its Studium habitat a pet uses its furniture (status.furniture, from Studium's habitat decor):
// it naps in the bed, and now and then uses the piece made for its kind (furnitureChance below).
//
// The desktop app (desktop/) runs this same file in two more places, chosen by
// globalThis.PetSurface: 'overlay' (the transparent window over the whole screen; every pet roams
// except the one whose habitat shows in the Studium window, given as petHabitat) and 'habitat' (the
// Studium window: only the habitat box's pet, which it reports with a { type: 'habitat' } message;
// it saves nothing). There, `chrome` is a stand-in (desktop/src/overlay/chromeShim.js). Missing
// means 'page': the extension, unchanged.

(() => {
  if (window.top !== window) return;
  // Pets left over from before the extension was reloaded can't save anymore,
  // so replace them. Their loop stops once their element is gone (see loop()).
  document.getElementById('capstone-pet-host')?.remove();

  // When the extension reloads, background.js injects this script into tabs that are already open.
  // Some Chrome versions (seen in 155) run that copy without the extension's APIs. It can't load or
  // save anything, so stop here; the tab gets its pets back when it's refreshed.
  if (typeof chrome === 'undefined' || !chrome.storage || !chrome.runtime?.id) return;

  const L = globalThis.PetLogic; // content/logic.js, loaded just before this file
  // Where this copy runs (PetLogic.PET_SURFACES): a web page (the extension), the desktop app's
  // overlay, or the desktop app's Studium window, where it only draws the habitat pet.
  const SURFACE = L.cleanSurface(globalThis.PetSurface);

  // Shared physics. Each kind below can override the ones marked "per kind".
  const GRAVITY = 1400;         // px/s², per kind
  const HOP_SPEED = 380;        // px/s upward when clicked, per kind
  const BOUNCE = 0.5;           // speed kept after hitting a wall, floor or ceiling, per kind
  const AIR_DRAG = 0.4;         // sideways slowdown in the air, per kind
  const THROW_SAMPLE_MS = 80;   // how much recent mouse movement sets the throw speed
  const MAX_THROW_SPEED = 2500; // px/s
  const GROUND_FRICTION = 5;    // how quickly a slide along the floor stops
  const MIN_BOUNCE_SPEED = 200; // slower floor hits than this stop bouncing
  const MAX_TILT_DEG = 25;      // lean while flying sideways
  const SAVE_EVERY_MS = 2000;
  const NOTE_CARRY_MAX_MS = 8000; // a carried note is dropped by then even if the pet hasn't arrived

  // How each kind of animal looks and behaves (before its mood is applied). Ranges are [min, max].
  //   height/aspect: display size in px (aspect = width / height of the art)
  //   walkSpeed px/s, idleMs pause between walks, strollPx typical walk length
  //   sound: what it says when clicked and every soundMs or so
  //   furnitureChance: how often it uses its own furniture instead of walking (habitat only);
  //   furnitureMs: how long it stays there
  const KINDS = {
    cat: {
      height: 56, aspect: 0.82,
      walkSpeed: 28, idleMs: [3000, 8000], strollPx: 160,
      sound: 'Meow!', soundMs: [20000, 45000],
      napChance: 0.4, napMs: [10000, 20000], // sometimes naps instead of walking
      furnitureChance: 0.3, furnitureMs: [2000, 3000], // scratches its post
    },
    dog: {
      height: 60, aspect: 0.82,
      walkSpeed: 60, idleMs: [400, 1800], strollPx: 450, longWalkChance: 0.4,
      sound: 'Bark!', soundMs: [8000, 20000],
      furnitureChance: 0.3, furnitureMs: [8000, 15000], // lounges on its sofa
    },
    turtle: {
      height: 44, aspect: 1.48,
      walkSpeed: 10, idleMs: [3000, 8000], strollPx: 120,
      throwable: false, // drops straight down when let go
      bounce: 0.08, hopSpeed: 120,
      furnitureChance: 0.3, furnitureMs: [20000, 40000], // basks under its heat lamp
    },
    frog: {
      height: 50, aspect: 1.04,
      hops: true, jumpSpeed: [600, 850], jumpSideways: [120, 260], // moves by jumping
      idleMs: [1500, 5000], bounce: 0.15, hopSpeed: 850,
      sound: 'Ribbit!', soundMs: [12000, 30000],
      tongueMs: [4000, 10000], mouth: { x: 0.8, y: 0.37 }, // tongue flick, from the mouth corner
      furnitureChance: 0.3, furnitureMs: [8000, 15000], // lies on its log
    },
    pigeon: {
      height: 50, aspect: 0.81,
      walkSpeed: 40, idleMs: [1500, 5000], strollPx: 200,
      sound: 'Coo!', soundMs: [10000, 25000],
      flyChance: 0.35, flyHeight: [150, 400], riseSpeed: 150, // floats up the page...
      gravity: 200, maxFallSpeed: 90, airDrag: 1.2,           // ...and drifts down slowly
      furnitureChance: 0.3, furnitureMs: [8000, 15000],       // sits on its perch
    },
  };

  const between = ([lo, hi]) => lo + Math.random() * (hi - lo);

  const STYLE = `
    .pet {
      position: absolute; left: 0; bottom: 0;
      pointer-events: auto; cursor: grab; user-select: none; touch-action: none;
      will-change: transform;
    }
    .pet.dragging { cursor: grabbing; z-index: 1; }
    .body, .anim { width: 100%; height: 100%; transform-origin: 50% 100%; }
    .sprite {
      position: absolute; inset: 0; width: 100%; height: 100%;
      -webkit-user-drag: none; pointer-events: none;
      /* Thin outline in the project's color, so you can tell which project a pet belongs to. */
      filter: drop-shadow(1.5px 0 0 var(--c)) drop-shadow(-1.5px 0 0 var(--c))
              drop-shadow(0 1.5px 0 var(--c)) drop-shadow(0 -1.5px 0 var(--c));
    }
    /* A Sick pet looks a little green. */
    .pet.sick .anim { filter: sepia(.35) hue-rotate(45deg) saturate(1.4); }
    .ring {
      position: absolute; left: 10%; bottom: -4px; width: 80%; height: 8px;
      border-radius: 50%; background: var(--c); opacity: .35; pointer-events: none;
    }
    .pet.walking .anim { animation: bob .4s ease-in-out infinite; }
    .pet.sleeping .anim { animation: breathe 2.4s ease-in-out infinite; }
    .pet.flying .anim { animation: flap .18s ease-in-out infinite; }
    .pet.gliding .anim { animation: flap .6s ease-in-out infinite; }
    .pet.scratching .anim { animation: scratch .25s ease-in-out infinite; }
    .pet.lounging .anim { animation: breathe 2.4s ease-in-out infinite; }
    .pet.basking .sprite { filter: drop-shadow(0 0 6px #ffd36b) drop-shadow(0 0 2px #ffb000); }

    .tongue {
      position: absolute; height: 4px; width: 26px; border-radius: 2px;
      background: #e8577a; transform-origin: 0 50%; transform: scaleX(0);
    }
    .tongue::after {
      content: ''; position: absolute; right: -3px; top: -2px;
      width: 8px; height: 8px; border-radius: 50%; background: #e8577a;
    }
    .pet.licking .tongue { animation: lick .45s ease-out; }

    .bubble, .name {
      position: absolute; left: 50%; transform: translateX(-50%);
      font: 600 12px/1.2 system-ui, sans-serif; white-space: nowrap;
      pointer-events: none; opacity: 0; transition: opacity .2s;
    }
    .bubble {
      padding: 4px 8px; border-radius: 10px;
      background: #fff; color: #1a1816; box-shadow: 0 2px 6px rgba(0,0,0,.2);
    }
    .bubble.show { opacity: 1; }
    .pet.sleeping .bubble { font-style: italic; color: #6b6f7a; }
    .name { padding: 1px 6px; border-radius: 6px; background: var(--c); color: var(--ct, #fff); }

    /* A sticky note a Moderate pet leaves on the page (lower third, never over the middle half). */
    .note {
      position: fixed; bottom: 18vh; width: 190px; max-width: 22vw; padding: 10px 26px 12px 12px;
      /* Paper tinted with the project's color, with a strip of it along the top. */
      background: color-mix(in srgb, var(--c, #f2c94c) 22%, #fffdf3); color: #2b2a26;
      border-top: 6px solid var(--c, #f2c94c); box-shadow: 0 3px 10px rgba(0,0,0,.25); transform: rotate(-2deg);
      font: 600 13px/1.35 system-ui, sans-serif; pointer-events: auto; cursor: default;
    }
    .note .sign { margin: 6px 0 0; text-align: right; font-weight: 700; }
    .note.left { left: 2vw; }
    .note.right { right: 2vw; transform: rotate(2deg); }
    .note button {
      position: absolute; top: 2px; right: 4px; border: 0; background: none; color: inherit;
      font: 700 16px/1 system-ui, sans-serif; cursor: pointer; padding: 2px 4px;
    }

    /* A bubble with buttons (check-ins). It stays until it's answered. */
    .talk {
      position: absolute; left: 50%; transform: translateX(-50%); display: none;
      width: max-content; max-width: 220px; padding: 6px 8px; border-radius: 10px;
      background: #fff; color: #1a1816; box-shadow: 0 2px 6px rgba(0,0,0,.2);
      font: 600 12px/1.3 system-ui, sans-serif; white-space: normal; pointer-events: auto; cursor: default;
    }
    .talk.show { display: block; }
    /* A note carried in from the screen edge (desktop), held above the pet's head. */
    .carried {
      position: absolute; left: 50%; width: 22px; height: 18px; transform: translateX(-50%) rotate(-6deg);
      background: color-mix(in srgb, var(--n, #f2c94c) 22%, #fffdf3); border-top: 3px solid var(--n, #f2c94c);
      box-shadow: 0 1px 3px rgba(0,0,0,.3); border-radius: 2px;
    }
    .talk button {
      margin: 5px 4px 0 0; padding: 2px 8px; border: 1px solid #c9cdd6; border-radius: 6px;
      background: #f4f5f8; color: inherit; font: 600 11px/1.4 system-ui, sans-serif; cursor: pointer;
    }
    .talk button:hover { background: #e6e8ee; }
    /* The nap question: one scrolling list of tasks under Today / Suggested, then Just nap. */
    .talk .choices { max-height: 170px; overflow-y: auto; margin-top: 2px; }
    .talk .group {
      margin: 6px 0 0; font: 700 9px/1.2 system-ui, sans-serif; letter-spacing: .06em;
      text-transform: uppercase; color: #8a8e98;
    }
    .talk button.task { display: block; width: 100%; margin: 4px 0 0; text-align: left; }
    .talk button.task small { display: block; font-weight: 400; font-size: 10px; color: #6b6f7a; }
    .pet:hover .name { opacity: 1; }

    @keyframes bob { 50% { transform: translateY(-3px) scaleY(.96); } }
    @keyframes breathe { 50% { transform: scaleY(.93) scaleX(1.03); } }
    @keyframes flap { 50% { transform: translateY(-3px) scaleY(1.04); } }
    @keyframes scratch { 25% { transform: translateX(-2px) rotate(-4deg); } 75% { transform: translateX(2px) rotate(4deg); } }
    @keyframes lick { 40%, 55% { transform: scaleX(1); } 100% { transform: scaleX(0); } }
  `;

  // ---- DOM ----
  const host = document.createElement('div');
  host.id = 'capstone-pet-host';
  host.style.cssText =
    'all: initial; position: fixed; inset: 0; pointer-events: none; z-index: 2147483647;';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>${STYLE}${globalThis.PetMenu?.STYLE ?? ''}</style>`;
  document.documentElement.appendChild(host);

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  // Speed of the pointer over the last few moments of a drag, in px/s.
  // Holding still before letting go gives zero, so you can still set a pet down gently.
  function throwVelocity(samples) {
    const now = performance.now();
    const recent = samples.filter((s) => now - s.t <= THROW_SAMPLE_MS);
    if (recent.length < 2) return { vx: 0, vy: 0 };
    const first = recent[0];
    const lastS = recent[recent.length - 1];
    const secs = Math.max((lastS.t - first.t) / 1000, 0.008);
    let vx = (lastS.x - first.x) / secs;
    let vy = -(lastS.y - first.y) / secs; // screen y points down; ours points up
    const speed = Math.hypot(vx, vy);
    if (speed > MAX_THROW_SPEED) {
      vx *= MAX_THROW_SPEED / speed;
      vy *= MAX_THROW_SPEED / speed;
    }
    return { vx, vy };
  }

  // ---- One pet ----
  // status: one of Studium's pet statuses (projectId, shortName, name, color, petKind, mood, idleRequirement).
  // env: { quiet(): true while another pet naps, onMenu(pet, { x, y }): right-click on the pet }
  function createPet(status, index, count, env) {
    const kind = L.applyMood(KINDS[status.petKind], status.mood);
    const gravity = kind.gravity ?? GRAVITY;
    const bounce = kind.bounce ?? BOUNCE;
    const airDrag = kind.airDrag ?? AIR_DRAG;
    const h = L.petHeight(kind.height, status.stage);
    const w = Math.round(h * kind.aspect);
    const idleText = L.idleMessage(status.idleRequirement);

    // The pet's world: the whole window, or the Studium habitat box it lives in (habitat mode).
    // Positions are measured from the world's left wall and floor; the box is re-read every frame.
    let box = null;
    let shown = true;
    let world = L.windowWorld(window.innerWidth, window.innerHeight);
    function refreshWorld() {
      world = box
        ? L.worldFromRect(box.getBoundingClientRect(), window.innerHeight)
        : L.windowWorld(window.innerWidth, window.innerHeight);
    }
    const maxX = () => Math.max(0, world.width - w);
    const maxY = () => Math.max(0, world.height - h);

    const petEl = document.createElement('div');
    petEl.className = kind.tint ? 'pet sick' : 'pet';
    petEl.style.cssText = `width:${w}px;height:${h}px;--c:${status.color};--ct:${L.textOn(status.color)}`;
    petEl.innerHTML = `
      <div class="ring"></div>
      <div class="bubble" style="bottom:${h + 4}px"></div>
      <div class="talk" style="bottom:${h + 4}px"></div>
      <div class="carried" style="bottom:${h + 2}px" hidden></div>
      <div class="body"><div class="anim">
        <img class="sprite" alt="" src="${chrome.runtime.getURL(`assets/pets/${status.petKind}.png`)}">
        ${kind.mouth ? `<div class="tongue" style="left:${kind.mouth.x * 100}%;top:${kind.mouth.y * 100}%"></div>` : ''}
      </div></div>
      <div class="name" style="top:${h + 6}px"></div>`;
    petEl.querySelector('.name').textContent = `${status.shortName} · ${status.mood}`;
    petEl.title = status.name;
    const bodyEl = petEl.querySelector('.body');
    const ringEl = petEl.querySelector('.ring');
    const bubbleEl = petEl.querySelector('.bubble');
    const talkEl = petEl.querySelector('.talk');
    const carriedEl = petEl.querySelector('.carried');
    let carry = null; // { onArrive, timer } while carrying a note in (desktop)
    function finishCarry() {
      if (!carry) return;
      const { onArrive, timer } = carry;
      carry = null;
      clearTimeout(timer);
      carriedEl.hidden = true;
      onArrive();
    }
    root.appendChild(petEl);

    const state = {
      x: 0,               // from the world's left wall, px
      y: 0,               // height above the world's floor, px
      vx: 0,              // sideways speed, px/s (positive is right)
      vy: 0,              // vertical speed, px/s (positive is up)
      facing: 1,          // 1 = right, -1 = left (the art faces right or forward)
      mode: 'idle',       // idle | walk | fall | drag | sleep | fly | away (napping or sleeping for its project)
                          // | goto (on its way to furniture) | use (using it)
      targetX: 0,
      idleUntil: 0,
      sleepUntil: 0,
      flyTo: 0,           // height the pigeon rises to before gliding down
      nextSoundAt: 0,
      nextLickAt: 0,
      nextIdleMessageAt: 0,
      extraHops: 0,       // celebration hops still to do, one each time it lands
      plan: null,         // { activity: 'use' | 'nap', entry: { use, slot } }: what it does at the furniture
      gotoUntil: 0,       // gives up on reaching furniture after this
      useUntil: 0,
    };
    const furniture = status.furniture ?? [];
    // Spread the pets out across the window until they have saved positions.
    const defaultXRatio = (index + 0.5) / count;

    function say(text, ms = 1500) {
      bubbleEl.textContent = text;
      bubbleEl.classList.add('show');
      clearTimeout(say.timer);
      say.timer = setTimeout(() => bubbleEl.classList.remove('show'), ms);
    }

    // What a pet says on its own (sounds, naps, reminders). Quiet while another pet naps.
    function chatter(text, ms) {
      if (env.quiet()) return;
      if (env.showsBubble(text)) say(text, ms);
      env.sound?.(text); // desktop: out loud too ("Meow!", "*cough*")
    }

    function hop(factor = 1) {
      clearPlan();
      state.vx = 0;
      state.vy = (kind.hopSpeed ?? HOP_SPEED) * factor;
      state.mode = 'fall';
    }

    // ---- Chasing the mouse (desktop overlay, Moderate) ----
    // The cursor comes from the main process (env.cursor), polled while the chase lasts.
    let chase = null; // { until, target, last, stillSince, lost, timer }
    function startChase() {
      clearPlan();
      chase = { until: Date.now() + L.MISCHIEF.CHASE_MS, target: null, last: null, stillSince: 0, lost: false, timer: null };
      const c = chase;
      const poll = async () => {
        const p = await env.cursor();
        if (chase !== c) return;
        if (!p) {
          c.lost = true; // off the overlay: the taskbar or another screen
          return;
        }
        const moved = !c.last || Math.hypot(p.x - c.last.x, p.y - c.last.y) > 4;
        if (moved) c.stillSince = 0;
        else if (!c.stillSince) c.stillSince = Date.now();
        c.last = p;
        c.target = p;
      };
      c.timer = setInterval(poll, L.MISCHIEF.CURSOR_POLL_MS);
      poll();
      env.setChaser(api);
      state.mode = 'chase';
      petEl.classList.add('chasing');
    }
    function stopChase() {
      if (!chase) return false;
      clearInterval(chase.timer);
      chase = null;
      petEl.classList.remove('chasing');
      env.setChaser(null);
      state.nextChaseAt = L.nextChaseAt(Date.now(), status.mood, env.timing());
      return true;
    }
    function endChase(now) {
      if (stopChase() && state.mode === 'chase') goIdle(now);
    }

    function lick() {
      if (!kind.mouth) return;
      petEl.classList.remove('licking');
      void petEl.offsetWidth; // restart the animation if it's already running
      petEl.classList.add('licking');
      setTimeout(() => petEl.classList.remove('licking'), 450);
    }

    // ---- Furniture (habitat only) ----
    const spotFor = (entry) => L.furnitureSpot(entry, world, w);

    // Speed on the way to furniture: the pigeon flies to its perch, everyone else walks.
    // Frogs hop rather than walk, so they have no walkSpeed: they move along the floor at this speed.
    const floorSpeed = kind.walkSpeed ?? 120;
    const gotoSpeed = (entry) => (entry.use === 'perch' ? kind.riseSpeed ?? 150 : floorSpeed);

    function goTo(entry, activity, now) {
      state.plan = { activity, entry };
      // Give up only if it takes much longer than the trip should (slow pets have far to go).
      const spot = spotFor(entry);
      const trip = Math.hypot(spot.x - state.x, spot.y - state.y) / gotoSpeed(entry);
      state.gotoUntil = now + trip * 1500 + 3000;
      state.mode = 'goto';
    }

    function arrive(now) {
      const { activity, entry } = state.plan;
      const spot = spotFor(entry);
      Object.assign(state, { x: spot.x, y: spot.y, vx: 0, vy: 0 });
      if (activity === 'nap') {
        state.mode = 'sleep';
        const napMs = between(kind.napMs);
        state.sleepUntil = now + napMs;
        chatter('Zzzzz', napMs);
      } else {
        state.mode = 'use';
        state.useUntil = now + between(kind.furnitureMs ?? [8000, 15000]);
      }
    }

    function clearPlan() {
      state.plan = null;
    }

    // Furniture is placed in fractions of the box, so a pet using it (or asleep in its bed) keeps to
    // it whenever the box's size changes: the box may not be laid out yet when a nap starts, and it
    // changes with the page, not only when the window is resized. True if the pet is at furniture.
    function stayAtFurniture() {
      const entry =
        state.mode === 'away' ? (box ? L.bedOf(furniture) : null)
        : state.mode === 'use' || state.mode === 'sleep' ? state.plan?.entry
        : null;
      if (!box || !entry) return false;
      const spot = spotFor(entry);
      state.x = spot.x;
      state.y = spot.y;
      return true;
    }

    // Back to normal: a pet up on furniture drops back to the floor first.
    function settle(now) {
      clearPlan();
      if (state.y > 0) {
        state.vx = 0;
        state.vy = 0;
        state.mode = 'fall';
      } else {
        goIdle(now);
      }
    }

    // Minimal pets stay put and quiet on web pages (User Settings: How much pets interact).
    const keepsQuiet = () => L.staysPut(env.prefs?.(), Boolean(box));
    // On Moderate, its "Haven't seen …" reminders go into sticky notes instead (web pages only). Sounds stay bubbles.
    const writesNotes = () => L.writesNotes(env.prefs?.(), Boolean(box));

    function goIdle(now) {
      state.mode = 'idle';
      state.idleUntil = now + between(kind.idleMs);
    }

    function wake() {
      if (state.mode !== 'sleep') return;
      bubbleEl.classList.remove('show');
      petEl.classList.remove('sleeping');
    }

    // Decide what to do after a pause: walk, hop, nap or fly, depending on the kind and mood.
    function act(now) {
      // Minimal, on a web page: stay in place.
      if (keepsQuiet()) {
        goIdle(now);
        return;
      }
      // In its habitat: sometimes use its own furniture, and nap in the bed.
      const own = box ? L.ownFurniture(status.petKind, furniture) : null;
      if (own && Math.random() < (kind.furnitureChance ?? 0)) {
        goTo(own, 'use', now);
        return;
      }
      if (kind.napChance && Math.random() < kind.napChance) {
        const bed = box ? L.bedOf(furniture) : null;
        if (bed) {
          goTo(bed, 'nap', now);
          return;
        }
        state.mode = 'sleep';
        const napMs = between(kind.napMs);
        state.sleepUntil = now + napMs;
        chatter('Zzzzz', napMs);
        return;
      }
      if (kind.extraHopChance && Math.random() < kind.extraHopChance) {
        // A happy little hop in place.
        state.vx = 0;
        state.vy = (kind.hopSpeed ?? HOP_SPEED) * 0.6;
        state.mode = 'fall';
        return;
      }
      if (kind.flyChance && Math.random() < kind.flyChance) {
        state.mode = 'fly';
        state.flyTo = Math.min(maxY(), between(kind.flyHeight));
        state.vx = (Math.random() < 0.5 ? -1 : 1) * between([40, 100]);
        state.facing = Math.sign(state.vx);
        return;
      }
      if (kind.hops) {
        // Jump mostly toward the middle of the world so frogs don't pile up at the edges.
        const towardMiddle = state.x < maxX() / 2 ? 1 : -1;
        const dir = Math.random() < 0.7 ? towardMiddle : -towardMiddle;
        state.vx = dir * between(kind.jumpSideways);
        state.vy = between(kind.jumpSpeed);
        state.facing = dir;
        state.mode = 'fall';
        return;
      }
      // Walk: mostly short strolls, sometimes a long walk across the world.
      const range = Math.random() < (kind.longWalkChance ?? 0.2) ? maxX() : kind.strollPx;
      state.targetX = clamp(state.x + (Math.random() * 2 - 1) * range, 0, maxX());
      state.facing = state.targetX >= state.x ? 1 : -1;
      state.mode = 'walk';
    }

    function step(now, dt) {
      refreshWorld();
      stayAtFurniture();
      if (state.mode === 'away') return; // asleep in its habitat: no physics, sounds or timers
      if (carry && state.mode !== 'walk') finishCarry(); // arrived (or was picked up): drop the note
      // A chase ends when its time is up, the cursor leaves the overlay, the pet is picked up, or
      // mischief stops being allowed (a nap starts, a check-in opens, pets are hidden).
      if (chase && (state.mode !== 'chase' || chase.lost || Date.now() > chase.until || !env.mayChase(api))) endChase(now);
      if (!chase && env.chases && (state.mode === 'idle' || state.mode === 'walk')) {
        if (state.nextChaseAt === undefined) state.nextChaseAt = L.nextChaseAt(Date.now(), status.mood, env.timing());
        if (state.nextChaseAt !== null && Date.now() >= state.nextChaseAt && !keepsQuiet() && env.mayChase(api)) startChase();
      }
      // Sounds, tongue flicks and reminders happen on their own timers while awake.
      const busy = state.mode === 'drag' || state.mode === 'sleep';
      if (kind.sound && !busy && !keepsQuiet() && now > state.nextSoundAt) {
        if (state.nextSoundAt) chatter(L.pickSound(kind.sound));
        state.nextSoundAt = now + between(kind.soundMs);
      }
      if (kind.mouth && !busy && state.y === 0 && now > state.nextLickAt) {
        if (state.nextLickAt) lick();
        state.nextLickAt = now + between(kind.tongueMs);
      }
      if (idleText && !busy && !keepsQuiet() && !writesNotes() && now > state.nextIdleMessageAt) {
        if (state.nextIdleMessageAt) chatter(idleText, 4000);
        state.nextIdleMessageAt = L.nextIdleMessageAt(now);
      }

      switch (state.mode) {
        case 'idle':
          if (now > state.idleUntil) act(now);
          break;
        case 'sleep':
          if (now > state.sleepUntil) {
            wake();
            settle(now);
          }
          break;
        case 'goto': {
          if (!state.plan || now > state.gotoUntil) {
            settle(now);
            break;
          }
          const spot = spotFor(state.plan.entry);
          if (state.plan.entry.use === 'perch') {
            // Fly straight to the perch.
            const dx = spot.x - state.x;
            const dy = spot.y - state.y;
            const d = Math.hypot(dx, dy);
            const move = gotoSpeed(state.plan.entry) * dt;
            if (d <= move) {
              arrive(now);
            } else {
              state.x += (dx / d) * move;
              state.y += (dy / d) * move;
              if (Math.abs(dx) > 1) state.facing = Math.sign(dx);
            }
          } else {
            const dist = spot.x - state.x;
            const move = gotoSpeed(state.plan.entry) * dt;
            if (Math.abs(dist) <= move) {
              arrive(now);
            } else {
              state.x += Math.sign(dist) * move;
              state.facing = Math.sign(dist);
            }
          }
          dirty = true;
          break;
        }
        case 'use':
          if (now > state.useUntil) settle(now);
          break;
        case 'chase': {
          if (!chase) {
            goIdle(now); // its chase was stopped while it wasn't stepping (hidden, unshown)
            break;
          }
          if (!chase.target) break;
          // Run along the floor toward the cursor at twice walking speed (pigeons stay on the ground).
          const goal = clamp(chase.target.x - w / 2, 0, maxX());
          const dist = goal - state.x;
          if (Math.abs(dist) > 1) {
            state.facing = Math.sign(dist);
            state.x += Math.sign(dist) * Math.min(Math.abs(dist), floorSpeed * 2 * dt);
            dirty = true;
          }
          // The cursor stopped close by: pounce on it.
          const still = chase.stillSince && Date.now() - chase.stillSince >= L.MISCHIEF.POUNCE_STILL_MS;
          if (still && Math.abs(dist) <= L.MISCHIEF.POUNCE_RANGE_PX && state.y === 0) {
            const dir = Math.sign(dist) || state.facing;
            endChase(now);
            hop(1.4);
            state.vx = dir * 120;
          }
          break;
        }
        case 'walk': {
          const dist = state.targetX - state.x;
          const move = floorSpeed * dt;
          if (Math.abs(dist) <= move) {
            state.x = state.targetX;
            goIdle(now);
          } else {
            state.x += Math.sign(dist) * move;
          }
          dirty = true;
          break;
        }
        case 'fly': {
          // Rise steadily while drifting sideways, then glide back down (in 'fall').
          state.y += kind.riseSpeed * dt;
          state.x += state.vx * dt;
          if (state.x < 0 || state.x > maxX()) {
            state.x = clamp(state.x, 0, maxX());
            state.vx = -state.vx;
            state.facing = Math.sign(state.vx);
          }
          if (state.y >= state.flyTo) {
            state.y = state.flyTo;
            state.vy = 0;
            state.mode = 'fall';
          }
          dirty = true;
          break;
        }
        case 'fall': {
          state.vy -= gravity * dt;
          if (kind.maxFallSpeed) state.vy = Math.max(state.vy, -kind.maxFallSpeed);
          state.x += state.vx * dt;
          state.y += state.vy * dt;

          // Bounce off the walls and ceiling of the world.
          if (state.x < 0 || state.x > maxX()) {
            state.x = clamp(state.x, 0, maxX());
            state.vx = -state.vx * bounce;
          }
          if (state.y > maxY()) {
            state.y = maxY();
            state.vy = -state.vy * bounce;
          }

          const onFloor = state.y <= 0;
          if (onFloor) {
            state.y = 0;
            state.vy = -state.vy > MIN_BOUNCE_SPEED ? -state.vy * bounce : 0;
          }
          // Slide to a stop on the floor; drift a little in the air.
          state.vx *= Math.exp(-(onFloor && state.vy === 0 ? GROUND_FRICTION : airDrag) * dt);

          if (Math.abs(state.vx) > 20) state.facing = Math.sign(state.vx);
          if (onFloor && state.vy === 0 && Math.abs(state.vx) < 10) {
            state.vx = 0;
            if (state.extraHops > 0) {
              state.extraHops -= 1;
              hop(1.3);
            } else {
              goIdle(now);
            }
          }
          dirty = true;
          break;
        }
        // 'drag' is driven by pointer events below.
      }
    }

    function render() {
      petEl.style.transform = `translate(${world.left + state.x}px, ${-(world.bottom + state.y)}px)`;
      const airborne = state.mode === 'fall' && state.y > 0;
      const tilt = airborne && !kind.maxFallSpeed ? clamp(state.vx * 0.02, -MAX_TILT_DEG, MAX_TILT_DEG) : 0;
      bodyEl.style.transform = `rotate(${tilt}deg) scaleX(${state.facing})`;
      // The ring stays on the floor like a shadow and shrinks as the pet goes higher.
      ringEl.style.transform = `translateY(${state.y}px) scale(${1 / (1 + state.y / 250)})`;
      const flyingToPerch = state.mode === 'goto' && state.plan?.entry.use === 'perch';
      petEl.classList.toggle('walking', state.mode === 'walk' || state.mode === 'chase' || (state.mode === 'goto' && !flyingToPerch));
      const using = state.mode === 'use' ? state.plan?.entry.use : null;
      petEl.classList.toggle('scratching', using === 'scratch');
      petEl.classList.toggle('basking', using === 'bask');
      petEl.classList.toggle('lounging', using === 'lounge');
      petEl.classList.toggle('dragging', state.mode === 'drag');
      petEl.classList.toggle('sleeping', state.mode === 'sleep' || state.mode === 'away');
      petEl.classList.toggle('flying', state.mode === 'fly' || flyingToPerch);
      petEl.classList.toggle('gliding', airborne && Boolean(kind.maxFallSpeed));
    }

    // ---- Pointer: click to pet, drag to carry or throw ----
    let press = null;

    petEl.addEventListener('pointerdown', (e) => {
      if (state.mode === 'away' || e.button !== 0) return; // an away pet can't be dragged; right-click opens the menu
      const rect = petEl.getBoundingClientRect();
      press = {
        startX: e.clientX, startY: e.clientY,
        offX: e.clientX - rect.left, offY: e.clientY - rect.top,
        moved: false,
        samples: [], // recent { t, x, y } pointer positions, for throw speed
      };
      petEl.setPointerCapture(e.pointerId);
      e.preventDefault();
    });

    petEl.addEventListener('pointermove', (e) => {
      if (!press) return;
      if (!press.moved && Math.hypot(e.clientX - press.startX, e.clientY - press.startY) < 4) return;
      press.moved = true;
      wake();
      clearPlan();
      state.mode = 'drag';
      refreshWorld();
      const p = L.dragPosition(
        { x: e.clientX, y: e.clientY }, { x: press.offX, y: press.offY }, world, h, window.innerHeight,
      );
      state.x = clamp(p.x, 0, maxX());
      state.y = clamp(p.y, 0, maxY());
      dirty = true;

      const t = performance.now();
      press.samples.push({ t, x: e.clientX, y: e.clientY });
      while (press.samples.length > 2 && t - press.samples[0].t > THROW_SAMPLE_MS) press.samples.shift();
    });

    petEl.addEventListener('pointerup', () => {
      if (!press) return;
      if (press.moved) {
        const v = kind.throwable === false ? { vx: 0, vy: 0 } : throwVelocity(press.samples);
        state.vx = v.vx;
        state.vy = v.vy;
        state.mode = 'fall';
      } else if (state.mode === 'sleep') {
        // Clicking a napping pet wakes it up.
        wake();
        settle(performance.now());
        chatter(kind.sound ? L.pickSound(kind.sound).replace('!', '?') : '♥');
      } else {
        // Clicked: stop using furniture, hop and make its sound.
        if (state.mode === 'goto' || state.mode === 'use') settle(performance.now());
        if (state.y === 0) hop();
        chatter(L.pickSound(kind.sound) ?? '♥');
        lick();
      }
      press = null;
    });

    // ---- Right-click: the pet's menu ----
    petEl.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      env.onMenu(api, { x: e.clientX, y: e.clientY });
    });

    function clearTalk() {
      talkEl.classList.remove('show');
      talkEl.textContent = '';
    }

    const api = {
      id: status.petId ?? status.projectId, // a first pet's id is its project's
      step,
      render,
      start(now) {
        goIdle(now);
        render();
      },
      // xRatio: position as a fraction of the world's width, so it survives resizes.
      restore(xRatio = defaultXRatio) {
        state.x = clamp(xRatio * maxX(), 0, maxX());
      },
      xRatio: () => (maxX() ? state.x / maxX() : 0),
      clampToWorld() {
        refreshWorld();
        if (stayAtFurniture()) return;
        state.x = clamp(state.x, 0, maxX());
        state.y = clamp(state.y, 0, maxY());
        state.targetX = clamp(state.targetX, 0, maxX());
      },
      remove() {
        stopChase(); // replaced (a rebuild): its cursor polling stops too
        petEl.remove();
      },
      setShown(value) {
        if (!value) stopChase(); // a pet that isn't shown doesn't step: end its chase now
        shown = value;
        petEl.style.display = value ? '' : 'none';
      },
      isShown: () => shown,
      boxEl: () => box,
      // Habitat mode: move into the box and start in the middle of its floor.
      enterBox(el) {
        box = el;
        refreshWorld();
        wake();
        clearPlan();
        Object.assign(state, { x: maxX() / 2, y: 0, vx: 0, vy: 0 });
        goIdle(performance.now());
      },
      // Back to the whole window, at its saved floor position.
      leaveBox(xRatio = defaultXRatio) {
        box = null;
        refreshWorld();
        wake();
        clearPlan();
        Object.assign(state, { x: clamp(xRatio * maxX(), 0, maxX()), y: 0, vx: 0, vy: 0 });
        goIdle(performance.now());
      },
      say,
      // Napping or sleeping for its project: lies still with a "Zzz" (only seen in its habitat).
      setAway(value) {
        if (value === (state.mode === 'away')) return;
        if (value) {
          stopChase(); // an away pet doesn't step: end its chase (and cursor polling) now
          wake();
          clearPlan();
          // Asleep in its bed if the habitat has one.
          refreshWorld();
          const bed = box ? L.bedOf(furniture) : null;
          const spot = bed ? spotFor(bed) : { x: state.x, y: 0 };
          Object.assign(state, { x: spot.x, y: spot.y, vx: 0, vy: 0, extraHops: 0, mode: 'away' });
          clearTimeout(say.timer);
          bubbleEl.textContent = 'Zzz';
          bubbleEl.classList.add('show');
          clearTalk();
        } else {
          bubbleEl.classList.remove('show');
          state.mode = 'idle';
          settle(performance.now());
        }
        render();
      },
      isAway: () => state.mode === 'away',
      stopChase,
      replanChase() {
        if (!chase) state.nextChaseAt = L.nextChaseAt(Date.now(), status.mood, env.timing());
      },
      // Stroll toward a spot (0 = left edge, 1 = right edge), e.g. to leave a note there.
      walkTo(ratio) {
        if (state.mode !== 'idle' && state.mode !== 'walk') return;
        state.targetX = clamp(ratio * maxX(), 0, maxX());
        state.facing = state.targetX >= state.x ? 1 : -1;
        state.mode = 'walk';
      },
      // Desktop: walk in from the screen edge on that side holding a small note, then drop it
      // (onArrive). Dropped after NOTE_CARRY_MAX_MS anyway, or at once if the pet is busy.
      carryIn(side, color, onArrive) {
        if (state.mode !== 'idle' && state.mode !== 'walk') {
          onArrive();
          return;
        }
        finishCarry();
        carriedEl.style.setProperty('--n', color || '');
        carriedEl.hidden = false;
        carry = { onArrive, timer: setTimeout(finishCarry, NOTE_CARRY_MAX_MS) };
        state.x = side === 'left' ? 0 : maxX();
        state.y = 0;
        api.walkTo(side === 'left' ? 0.1 : 0.9);
      },
      // A bubble with buttons that stays until it's cleared. onAnswer gets the button's answer.
      talk(text, buttons, onAnswer) {
        clearTalk();
        bubbleEl.classList.remove('show');
        const line = document.createElement('div');
        line.textContent = text;
        talkEl.appendChild(line);
        for (const b of buttons) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.textContent = b.label;
          // Keep the pet's own drag/click handling out of it.
          btn.addEventListener('pointerdown', (e) => e.stopPropagation());
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            onAnswer(b.answer);
          });
          talkEl.appendChild(btn);
        }
        talkEl.classList.add('show');
      },
      // The nap question (PetLogic.napPrompt): onPick gets the chosen taskId, or null for Just nap.
      ask(prompt, onPick) {
        clearTalk();
        bubbleEl.classList.remove('show');
        const line = document.createElement('div');
        line.textContent = prompt.text;
        const list = document.createElement('div');
        list.className = 'choices';
        const button = (label, hint, value, className) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          if (className) btn.className = className;
          btn.textContent = label;
          if (hint) {
            const small = document.createElement('small');
            small.textContent = hint;
            btn.appendChild(small);
          }
          btn.addEventListener('pointerdown', (e) => e.stopPropagation());
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            onPick(value);
          });
          return btn;
        };
        for (const section of prompt.sections) {
          const label = document.createElement('div');
          label.className = 'group';
          label.textContent = section.label;
          list.appendChild(label);
          for (const item of section.items) list.appendChild(button(item.label, item.hint, item.taskId, 'task'));
        }
        // Scrolling the list mustn't scroll the page under it.
        list.addEventListener('wheel', (e) => e.stopPropagation());
        talkEl.append(line, list, button(prompt.skipLabel, '', null, ''));
        talkEl.classList.add('show');
      },
      clearTalk,
      isTalking: () => talkEl.classList.contains('show'),
      talkHeight: () => talkEl.offsetHeight,
      // A task was completed in Studium: hop (twice, higher, for a first task or a finished requirement).
      celebrate(celebrationKind) {
        if (state.mode === 'away' || keepsQuiet()) return;
        say(L.celebrationText(celebrationKind), 2500);
        if (state.mode === 'drag') return;
        const hops = L.celebrationHops(celebrationKind);
        const factor = hops > 1 ? 1.3 : 1;
        wake();
        if (state.y === 0 && state.mode !== 'fly') {
          hop(factor);
          state.extraHops = hops - 1;
        } else {
          state.extraHops = hops; // hops once it lands
        }
      },
    };
    return api;
  }

  let pets = [];
  let statuses = null; // the latest petStatuses (pets are rebuilt only when their looks change)
  let positions = {};  // saved x positions: { [petId]: { xRatio } }
  let hidden = false;
  let dirty = false;
  let prefs = L.cleanPrefs(null); // { involvement, nickname } (User Settings)
  let lastNoteAt = 0; // when any tab last left a sticky note (chrome.storage petNoteAt)
  let note = null; // the open note: { petId, el }
  let petScreen = L.cleanScreen(null); // petScreen: { limit, order } for the pets around the page (User Settings)
  let away = {};      // petAway: { [petId]: { kind, until, ... } }, written by the worker
  let checkIn = null; // petCheckIn: the question a returning pet asks
  let liveHabitats = []; // petHabitat (desktop app): the pets whose habitats show in the Studium window
  let timing = L.mischiefTiming(null); // mischief gaps (desktop app), shortened by petTimingOverride.mischiefMinutes
  let seenCelebrations = null; // { [petId]: at } already seen by this tab (null until the first statuses)
  let pendingCelebrations = [];

  const send = (msg) => {
    if (!stale()) chrome.runtime.sendMessage(msg).catch(() => {});
  };
  const statusOf = (id) => statuses?.pets.find((p) => p.petId === id) ?? null;
  // petHabitat is a list of habitat (pet) ids; an older main process sent one id or null.
  const habitatIds = (v) => (Array.isArray(v) ? v.filter((id) => typeof id === 'string' && id) : typeof v === 'string' && v ? [v] : []);
  let chaser = null; // the pet chasing the mouse right now (one at a time)
  let lastSoundAt = 0; // when a pet last made a real sound (desktop)
  const env = {
    quiet: () => L.isQuiet(away),
    onMenu: openMenu,
    prefs: () => prefs,
    timing: () => timing,
    // Mischief happens only in the desktop overlay.
    chases: SURFACE === 'overlay',
    mayChase: (pet) =>
      SURFACE === 'overlay' && pet.isShown() && (chaser === null || chaser === pet) &&
      // Not while it asks something (nap question, check-in) or a pet menu is open: the buttons
      // would run away from the click.
      !pet.isTalking() && globalThis.PetMenu?.isOpen() !== true &&
      L.mischiefAllowed({ prefs, petAway: away, checkIn, hidden }),
    setChaser: (pet) => {
      chaser = pet;
    },
    cursor: () => Promise.resolve(globalThis.petBridge?.cursor?.() ?? null).catch(() => null),
    // Settings → Sound → Sound bubbles off: a sound ("Meow!", "*cough*") is heard, not shown.
    showsBubble: (text) => prefs.soundBubbles || !L.soundKey(text),
    // Real sounds (desktop overlay, Moderate, Pet sounds on): at most one every soundGapMs across all pets.
    sound: (text) => {
      const key = L.soundKey(text);
      const now = Date.now();
      if (!key || SURFACE !== 'overlay' || !prefs.sounds || !globalThis.PetSound) return;
      if (!L.mischiefAllowed({ prefs, petAway: away, checkIn, hidden }) || !L.soundAllowed(lastSoundAt, now, timing)) return;
      lastSoundAt = now;
      globalThis.PetSound.play(key, prefs.volume);
    },
  };

  // ---- Storage ----
  // After the extension is reloaded, old content scripts lose access to chrome.*.
  const alive = () => Boolean(chrome.runtime?.id);
  // A newer copy of this script replaced this one (its host is gone): stop reacting.
  const stale = () => !host.isConnected || !alive();

  // One pet per status. keepPlaces: the current pets stay where they are (a mood or project
  // changed); otherwise every pet goes to its saved position.
  function rebuild(next, keepPlaces) {
    globalThis.PetMenu?.close();
    endNapAsk(); // its pet is replaced
    if (keepPlaces) for (const pet of pets) if (!pet.boxEl()) positions[pet.id] = { xRatio: pet.xRatio() };
    pets.forEach((pet) => pet.remove());
    statuses = next;
    const list = (next?.pets ?? []).filter((s) => KINDS[s.petKind]);
    pets = list.map((s, i) => createPet(s, i, list.length, env));
    const now = performance.now();
    for (const pet of pets) {
      pet.restore(positions[pet.id]?.xRatio);
      pet.start(now);
    }
    applyHabitat();
  }

  async function load() {
    if (stale()) return;
    const stored = await chrome.storage.local.get(['pets', 'petHidden', 'petStatuses', 'petAway', 'petCheckIn', 'petScreen', 'petPrefs', 'petNoteAt', 'petHabitat', 'petTimingOverride']);
    // Saved data may come from an older version or be damaged: use only what's valid.
    positions = L.parsePositions(stored.pets);
    liveHabitats = habitatIds(stored.petHabitat);
    timing = L.mischiefTiming(stored.petTimingOverride);
    away = L.parseAway(stored.petAway, Date.now());
    petScreen = L.cleanScreen(stored.petScreen);
    prefs = L.cleanPrefs(stored.petPrefs);
    lastNoteAt = Number.isFinite(stored.petNoteAt) ? stored.petNoteAt : 0;
    checkIn = L.parseCheckIn(stored.petCheckIn);
    const next = L.parseStatuses(stored.petStatuses ?? null);
    if (!L.statusesEqual(statuses, next)) {
      rebuild(next, false);
    } else {
      statuses = next;
      for (const pet of pets) if (!pet.boxEl()) pet.restore(positions[pet.id]?.xRatio);
      applyHabitat();
    }
    setHidden(stored.petHidden);
    noteCelebrations();
  }

  function save() {
    // The Studium window's habitat copy never saves: the overlay owns the desktop positions.
    if (SURFACE === 'habitat') return;
    // Only the tab you're looking at writes, so background tabs don't fight over positions.
    if (!dirty || stale() || document.visibilityState !== 'visible') return;
    dirty = false;
    for (const pet of pets) if (!pet.boxEl()) positions[pet.id] = { xRatio: pet.xRatio() };
    chrome.storage.local.set({ pets: positions }).catch(() => {});
  }

  function setHidden(value) {
    hidden = Boolean(value);
    if (hidden) for (const pet of pets) pet.stopChase(); // hidden pets don't step, so end their chase here
    host.style.display = hidden ? 'none' : '';
    markAttached();
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || stale()) return;
    if (changes.petHidden) setHidden(changes.petHidden.newValue);
    if (changes.petAway) {
      away = L.parseAway(changes.petAway.newValue, Date.now());
      globalThis.PetMenu?.close(); // its items may be out of date
    }
    if (changes.petCheckIn) checkIn = L.parseCheckIn(changes.petCheckIn.newValue);
    if (changes.petStatuses) {
      const next = L.parseStatuses(changes.petStatuses.newValue ?? null);
      if (!L.statusesEqual(statuses, next)) rebuild(next, true);
      else statuses = next; // a new suggestion or celebration: same pets
      noteCelebrations();
    }
    if (changes.petScreen) petScreen = L.cleanScreen(changes.petScreen.newValue);
    if (changes.petPrefs) prefs = L.cleanPrefs(changes.petPrefs.newValue);
    if (changes.petNoteAt && Number.isFinite(changes.petNoteAt.newValue)) lastNoteAt = changes.petNoteAt.newValue;
    if (changes.petHabitat) liveHabitats = habitatIds(changes.petHabitat.newValue);
    if (changes.petTimingOverride) {
      timing = L.mischiefTiming(changes.petTimingOverride.newValue);
      for (const pet of pets) pet.replanChase(); // the new gaps apply now, not after the next chase
    }
    // A note goes when its own pet naps or sleeps, or Moderate is turned off. Other projects' notes
    // stay while a pet naps (user's decision, 2026-11-01); no new note is left during a nap.
    if (note && (away[note.petId] || prefs.involvement !== 'moderate')) closeNote();
    if (changes.petAway || changes.petCheckIn || changes.petScreen || changes.petHabitat) applyHabitat();
  });

  // ---- Sticky notes (Moderate) ----
  function closeNote() {
    clearTimeout(note?.timer);
    note?.el.remove();
    note = null;
  }

  // Puts the note on screen. On the desktop there are no tabs to leave, so it goes after NOTE_STAY_MS.
  function placeNote(n) {
    if (note !== n) return; // closed (or replaced) while it was being carried in
    root.appendChild(n.el);
    if (SURFACE === 'overlay') n.timer = setTimeout(() => note === n && closeNote(), L.MISCHIEF.NOTE_STAY_MS);
  }

  function checkNote() {
    if (stale() || hidden) return;
    const now = Date.now();
    const shown = new Set(pets.filter((pet) => pet.isShown() && !pet.isAway()).map((pet) => pet.id));
    const choice = L.chooseNote({
      statuses: statuses?.pets ?? [], shown, prefs, petAway: away, lastNoteAt, now,
      today: L.todayKey(new Date(now)), onStudium, noteOpen: note !== null, pageVisible: document.visibilityState === 'visible',
      gapMs: SURFACE === 'overlay' ? timing.noteGapMs ?? undefined : undefined,
    });
    if (!choice) return;
    lastNoteAt = now;
    chrome.storage.local.set({ petNoteAt: now }).catch(() => {});
    const pet = pets.find((p) => p.id === choice.petId);
    const side = pet && pet.xRatio() > 0.5 ? 'right' : 'left';
    const el = document.createElement('div');
    el.className = `note ${side}`;
    el.setAttribute('role', 'note');
    if (choice.color) el.style.setProperty('--c', choice.color);
    const textEl = document.createElement('p');
    textEl.style.margin = '0';
    textEl.textContent = choice.text;
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = '×';
    close.setAttribute('aria-label', 'Close note');
    close.addEventListener('click', closeNote);
    const signEl = document.createElement('p');
    signEl.className = 'sign';
    signEl.textContent = choice.signature;
    el.append(textEl, signEl, close);
    const n = { petId: choice.petId, el, timer: null };
    note = n;
    // On the desktop a pet now and then carries its note in from the screen edge and drops it.
    if (SURFACE === 'overlay' && pet && L.noteCarries()) {
      pet.carryIn(side, choice.color, () => placeNote(n));
      return;
    }
    placeNote(n);
    pet?.walkTo(side === 'left' ? 0.1 : 0.9);
  }

  setInterval(checkNote, L.NOTE_CHECK_MS);
  // In a tab, a note belongs to the moment it was left: it goes when you leave the tab.
  document.addEventListener('visibilitychange', () => {
    if (SURFACE !== 'overlay' && document.visibilityState !== 'visible') closeNote();
  });

  // ---- The pet menu ----
  function openMenu(pet, point) {
    if (stale() || !globalThis.PetMenu) return;
    globalThis.PetMenu.open(root, point, L.petMenuItems(pet.id, away, statuses), (id) => pick(pet, id));
  }

  function pick(pet, id) {
    const petId = pet.id;
    if (id === 'suggest') pet.say(L.suggestionText(statusOf(petId)?.suggestion ?? null), L.SUGGESTION_BUBBLE_MS);
    else if (id === 'nap') askNap(pet);
    else if (id === 'sleep1') send({ type: 'sleep', petId, hours: 1 });
    else if (id === 'sleep2') send({ type: 'sleep', petId, hours: 2 });
    else if (id === 'open') send({ type: 'openProject', petId });
    else if (id === 'wake') send({ type: 'wake', petId });
  }

  // ---- Nap: the pet first asks what you'll work on (its project's Today tasks, then suggestions) ----
  let napAsk = null; // { petId, timer } while a pet is asking
  function endNapAsk() {
    if (!napAsk) return;
    clearTimeout(napAsk.timer);
    pets.find((p) => p.id === napAsk.petId)?.clearTalk();
    napAsk = null;
  }

  function askNap(pet) {
    endNapAsk();
    const petId = pet.id;
    const prompt = L.napPrompt(statusOf(petId)?.napTasks ?? []);
    if (!prompt) {
      send({ type: 'nap', petId, taskId: null }); // nothing to offer: it just naps
      return;
    }
    // Unanswered, the question goes away and no nap starts; right-click to ask again.
    napAsk = { petId, timer: setTimeout(endNapAsk, L.NAP_ASK_MS) };
    pet.ask(prompt, (taskId) => {
      endNapAsk();
      send({ type: 'nap', petId, taskId });
    });
  }

  // ---- Check-in: the pet back from a nap asks how it went, in every tab until it's answered ----
  function showCheckIn() {
    // A pet still asking about a nap keeps its question; one that left (asleep, hidden) drops it.
    const asker = napAsk && pets.find((p) => p.id === napAsk.petId && p.isShown() && !p.isAway());
    if (napAsk && !asker) endNapAsk();
    for (const pet of pets) if (pet !== asker) pet.clearTalk();
    if (!checkIn) return;
    const shown = pets.filter((pet) => pet.isShown() && !pet.isAway());
    let target = shown.find((pet) => pet.id === checkIn.petId);
    // Another pet asks for it, except in the desktop app where it is shown somewhere else: the
    // habitat copy only asks for its own pet, and the overlay leaves the habitat pet's to the habitat.
    if (!target && SURFACE !== 'habitat' && !(SURFACE === 'overlay' && liveHabitats.includes(checkIn.petId))) target = shown[0];
    if (!target || target === asker) return; // the check-in waits until the nap question is answered
    // Woken early because its task was checked off: a happy hop, once, before the congrats.
    if (checkIn.finished && congratsAt !== checkIn.at) {
      congratsAt = checkIn.at;
      target.celebrate('task');
    }
    const prompt = L.checkInPrompt(checkIn);
    target.talk(prompt.text, prompt.buttons, (answer) => send({ type: 'checkIn', answer }));
  }
  let congratsAt = null; // the finished check-in already celebrated

  // ---- Celebrations: a task completed in Studium ----
  // A tab in the background keeps them until you come back to it, so you see the hop.
  function noteCelebrations() {
    const r = L.newCelebrations(seenCelebrations, statuses);
    seenCelebrations = r.seen;
    pendingCelebrations.push(...r.celebrate);
    playCelebrations();
  }

  function playCelebrations() {
    if (hidden || document.visibilityState !== 'visible') return;
    for (const c of pendingCelebrations) {
      const pet = pets.find((p) => p.id === c.petId);
      if (pet?.isShown()) pet.celebrate(c.kind);
    }
    pendingCelebrations = [];
  }

  // ---- On the Studium page: copy its pet statuses for every tab ----
  // The habitat surface is Studium too: no notes there, and it watches for the habitat box.
  const onStudium = SURFACE === 'habitat' || (SURFACE === 'page' && L.isStudiumUrl(location.href));

  function copyStatusesFromStudium() {
    if (stale()) return;
    let raw = null;
    try {
      raw = localStorage.getItem(L.PET_STATUS_KEY);
    } catch {
      return; // storage is blocked on this page
    }
    const parsed = L.parseStatuses(raw);
    if (parsed) chrome.storage.local.set({ petStatuses: parsed }).catch(() => {});
  }

  // The same for the "Pets on screen at once", "Which pets show first" and "How much pets interact"
  // settings, and the nickname.
  function copySettingsFromStudium() {
    if (stale()) return;
    let raw = null;
    try {
      raw = localStorage.getItem(L.SETTINGS_KEY);
    } catch {
      return;
    }
    chrome.storage.local.set({ petScreen: L.screenFromSettings(raw), petPrefs: L.prefsFromSettings(raw) }).catch(() => {});
  }

  // In the desktop app, the Studium window's preload copies these instead.
  if (SURFACE === 'page' && onStudium) {
    window.addEventListener(L.PET_STATUS_EVENT, copyStatusesFromStudium);
    window.addEventListener(L.SETTINGS_EVENT, copySettingsFromStudium);
    copyStatusesFromStudium();
    copySettingsFromStudium();
  }

  // When you come back to this tab, pick up wherever the pets were in the other tab.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') load().then(playCelebrations);
    else save();
  });
  window.addEventListener('pagehide', save);
  setInterval(save, SAVE_EVERY_MS);

  window.addEventListener('resize', () => pets.forEach((pet) => pet.clampToWorld()));

  // ---- Habitat mode (Studium project pages) ----
  // A Studium project page has one <div data-pet-habitat="<petId>"> per pet (a first pet's id is its
  // project's). While they're there, only those pets show, each living inside its own box, and each
  // box gets data-pet-attached so Studium hides its still picture. React can replace the boxes at
  // any time (switching projects, buying an egg).
  let habitatEls = []; // the boxes on the page, in page order
  const boxFor = (pet) => habitatEls.find((el) => el.dataset.petHabitat === pet.id);
  const insidePets = () => pets.filter((pet) => pet.boxEl() && boxFor(pet) === pet.boxEl());

  // The box also gets data-pet-away while its pet naps or sleeps, so Studium can say when it's back.
  // That stays even while pets are hidden, for Studium's still picture.
  function markAttached() {
    for (const el of habitatEls) {
      const id = el.dataset.petHabitat;
      el.toggleAttribute('data-pet-attached', !hidden && pets.some((pet) => pet.id === id));
      const entry = away[id];
      if (entry) el.setAttribute(L.PET_AWAY_ATTR, L.awayAttribute(entry));
      else el.removeAttribute(L.PET_AWAY_ATTR);
    }
  }

  // Which pets show where. Away pets are hidden, except asleep in their own habitat box. Around
  // the page, at most petScreen.limit pets show, in its order (User Settings); a habitat always
  // shows its own pet.
  function applyHabitat() {
    const shown = L.shownPets({
      surface: SURFACE,
      pets: pets.map((pet) => statusOf(pet.id) ?? { petId: pet.id }),
      petAway: away,
      screen: petScreen,
      boxIds: habitatEls.map((el) => el.dataset.petHabitat),
      liveHabitats,
    });
    for (const pet of pets) {
      const box = boxFor(pet);
      const isAway = Boolean(away[pet.id]);
      pet.setShown(shown.has(pet.id));
      if (box && pet.boxEl() !== box) pet.enterBox(box);
      if (!box && pet.boxEl()) pet.leaveBox(positions[pet.id]?.xRatio);
      pet.setAway(isAway);
    }
    markAttached();
    showCheckIn();
  }

  function checkHabitat() {
    if (stale()) {
      habitatObserver?.disconnect();
      return;
    }
    const els = [...document.querySelectorAll('[data-pet-habitat]')];
    if (els.length === habitatEls.length && els.every((el, i) => el === habitatEls[i])) return;
    for (const old of habitatEls) {
      if (els.includes(old) || !old.isConnected) continue;
      old.removeAttribute('data-pet-attached');
      old.removeAttribute(L.PET_AWAY_ATTR);
    }
    habitatEls = els;
    // The desktop app hides these pets from its overlay while their boxes are showing.
    if (SURFACE === 'habitat') send({ type: 'habitat', ids: els.map((el) => el.dataset.petHabitat) });
    applyHabitat();
  }

  const habitatObserver = onStudium ? new MutationObserver(checkHabitat) : null;
  habitatObserver?.observe(document.documentElement, { childList: true, subtree: true });

  // ---- Loop ----
  let last = performance.now();
  function loop(now) {
    if (!host.isConnected) return; // replaced by a newer copy of this script
    const dt = Math.min(0.05, (now - last) / 1000); // cap so a background tab doesn't teleport
    last = now;
    if (!hidden) {
      for (const pet of pets) {
        if (!pet.isShown()) continue;
        pet.step(now, dt);
        pet.render();
      }
    }
    // In habitat mode, draw only inside the boxes (the area around all of them), so pets can't cover
    // the page when it scrolls away. The menu isn't clipped, and a talking pet gets room above.
    const inside = insidePets();
    if (inside.length > 0 && !globalThis.PetMenu?.isOpen()) {
      const rects = inside.map((pet) => pet.boxEl().getBoundingClientRect());
      const area = {
        top: Math.min(...rects.map((r) => r.top)),
        left: Math.min(...rects.map((r) => r.left)),
        right: Math.max(...rects.map((r) => r.right)),
        bottom: Math.max(...rects.map((r) => r.bottom)),
      };
      const talker = inside.find((pet) => pet.isTalking());
      host.style.clipPath = L.habitatClip(area, window.innerWidth, window.innerHeight, talker ? Math.max(90, talker.talkHeight() + 20) : 40);
    } else {
      host.style.clipPath = '';
    }
    requestAnimationFrame(loop);
  }

  // ---- Start ----
  load().then(() => {
    if (onStudium) checkHabitat();
    requestAnimationFrame(loop);
  });
})();

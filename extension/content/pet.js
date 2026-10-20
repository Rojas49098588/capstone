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
    .name { padding: 1px 6px; border-radius: 6px; background: var(--c); color: #fff; }

    /* A bubble with buttons (check-ins). It stays until it's answered. */
    .talk {
      position: absolute; left: 50%; transform: translateX(-50%); display: none;
      width: max-content; max-width: 220px; padding: 6px 8px; border-radius: 10px;
      background: #fff; color: #1a1816; box-shadow: 0 2px 6px rgba(0,0,0,.2);
      font: 600 12px/1.3 system-ui, sans-serif; white-space: normal; pointer-events: auto; cursor: default;
    }
    .talk.show { display: block; }
    .talk button {
      margin: 5px 4px 0 0; padding: 2px 8px; border: 1px solid #c9cdd6; border-radius: 6px;
      background: #f4f5f8; color: inherit; font: 600 11px/1.4 system-ui, sans-serif; cursor: pointer;
    }
    .talk button:hover { background: #e6e8ee; }
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
    const h = kind.height;
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
    petEl.style.cssText = `width:${w}px;height:${h}px;--c:${status.color}`;
    petEl.innerHTML = `
      <div class="ring"></div>
      <div class="bubble" style="bottom:${h + 4}px"></div>
      <div class="talk" style="bottom:${h + 4}px"></div>
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
      if (!env.quiet()) say(text, ms);
    }

    function hop(factor = 1) {
      clearPlan();
      state.vx = 0;
      state.vy = (kind.hopSpeed ?? HOP_SPEED) * factor;
      state.mode = 'fall';
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
    const gotoSpeed = (entry) => (entry.use === 'perch' ? kind.riseSpeed ?? 150 : kind.walkSpeed ?? 120);

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
      // Sounds, tongue flicks and reminders happen on their own timers while awake.
      const busy = state.mode === 'drag' || state.mode === 'sleep';
      if (kind.sound && !busy && now > state.nextSoundAt) {
        if (state.nextSoundAt) chatter(kind.sound);
        state.nextSoundAt = now + between(kind.soundMs);
      }
      if (kind.mouth && !busy && state.y === 0 && now > state.nextLickAt) {
        if (state.nextLickAt) lick();
        state.nextLickAt = now + between(kind.tongueMs);
      }
      if (idleText && !busy && now > state.nextIdleMessageAt) {
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
        case 'walk': {
          const dist = state.targetX - state.x;
          const move = kind.walkSpeed * dt;
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
      petEl.classList.toggle('walking', state.mode === 'walk' || (state.mode === 'goto' && !flyingToPerch));
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
        chatter(kind.sound ? kind.sound.replace('!', '?') : '♥');
      } else {
        // Clicked: stop using furniture, hop and make its sound.
        if (state.mode === 'goto' || state.mode === 'use') settle(performance.now());
        if (state.y === 0) hop();
        chatter(kind.sound ?? '♥');
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
      id: status.projectId,
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
        petEl.remove();
      },
      setShown(value) {
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
      clearTalk,
      isTalking: () => talkEl.classList.contains('show'),
      // A task was completed in Studium: hop (twice, higher, for a first task or a finished requirement).
      celebrate(celebrationKind) {
        if (state.mode === 'away') return;
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
  let positions = {};  // saved x positions: { [projectId]: { xRatio } }
  let hidden = false;
  let dirty = false;
  let petScreen = L.cleanScreen(null); // petScreen: { limit, order } for the pets around the page (User Settings)
  let away = {};      // petAway: { [projectId]: { kind, until, ... } }, written by the worker
  let checkIn = null; // petCheckIn: the question a returning pet asks
  let seenCelebrations = null; // { [projectId]: at } already seen by this tab (null until the first statuses)
  let pendingCelebrations = [];

  const send = (msg) => {
    if (!stale()) chrome.runtime.sendMessage(msg).catch(() => {});
  };
  const statusOf = (id) => statuses?.pets.find((p) => p.projectId === id) ?? null;
  const env = { quiet: () => L.isQuiet(away), onMenu: openMenu };

  // ---- Storage ----
  // After the extension is reloaded, old content scripts lose access to chrome.*.
  const alive = () => Boolean(chrome.runtime?.id);
  // A newer copy of this script replaced this one (its host is gone): stop reacting.
  const stale = () => !host.isConnected || !alive();

  // One pet per status. keepPlaces: the current pets stay where they are (a mood or project
  // changed); otherwise every pet goes to its saved position.
  function rebuild(next, keepPlaces) {
    globalThis.PetMenu?.close();
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
    const stored = await chrome.storage.local.get(['pets', 'petHidden', 'petStatuses', 'petAway', 'petCheckIn', 'petScreen']);
    // Saved data may come from an older version or be damaged: use only what's valid.
    positions = L.parsePositions(stored.pets);
    away = L.parseAway(stored.petAway, Date.now());
    petScreen = L.cleanScreen(stored.petScreen);
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
    // Only the tab you're looking at writes, so background tabs don't fight over positions.
    if (!dirty || stale() || document.visibilityState !== 'visible') return;
    dirty = false;
    for (const pet of pets) if (!pet.boxEl()) positions[pet.id] = { xRatio: pet.xRatio() };
    chrome.storage.local.set({ pets: positions }).catch(() => {});
  }

  function setHidden(value) {
    hidden = Boolean(value);
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
    if (changes.petAway || changes.petCheckIn || changes.petScreen) applyHabitat();
  });

  // ---- The pet menu ----
  function openMenu(pet, point) {
    if (stale() || !globalThis.PetMenu) return;
    globalThis.PetMenu.open(root, point, L.petMenuItems(pet.id, away, statuses), (id) => pick(pet, id));
  }

  function pick(pet, id) {
    const projectId = pet.id;
    if (id === 'suggest') pet.say(L.suggestionText(statusOf(projectId)?.suggestion ?? null), L.SUGGESTION_BUBBLE_MS);
    else if (id === 'nap') send({ type: 'nap', projectId });
    else if (id === 'sleep1') send({ type: 'sleep', projectId, hours: 1 });
    else if (id === 'sleep2') send({ type: 'sleep', projectId, hours: 2 });
    else if (id === 'open') send({ type: 'openProject', projectId });
    else if (id === 'wake') send({ type: 'wake', projectId });
  }

  // ---- Check-in: the pet back from a nap asks how it went, in every tab until it's answered ----
  function showCheckIn() {
    for (const pet of pets) pet.clearTalk();
    if (!checkIn) return;
    const shown = pets.filter((pet) => pet.isShown() && !pet.isAway());
    const target = shown.find((pet) => pet.id === checkIn.projectId) ?? shown[0];
    if (!target) return;
    const prompt = L.checkInPrompt(checkIn);
    target.talk(prompt.text, prompt.buttons, (answer) => send({ type: 'checkIn', answer }));
  }

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
      const pet = pets.find((p) => p.id === c.projectId);
      if (pet?.isShown()) pet.celebrate(c.kind);
    }
    pendingCelebrations = [];
  }

  // ---- On the Studium page: copy its pet statuses for every tab ----
  const onStudium = L.isStudiumUrl(location.href);

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

  // The same for the "Pets on screen at once" and "Which pets show first" settings.
  function copySettingsFromStudium() {
    if (stale()) return;
    let raw = null;
    try {
      raw = localStorage.getItem(L.SETTINGS_KEY);
    } catch {
      return;
    }
    chrome.storage.local.set({ petScreen: L.screenFromSettings(raw) }).catch(() => {});
  }

  if (onStudium) {
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
  // A Studium project page has <div data-pet-habitat="<projectId>">. While it's there, only that
  // project's pet shows, living inside the box, and the box gets data-pet-attached so Studium hides
  // its still picture. React can replace the box at any time (switching projects).
  let habitatEl = null;
  const habitatPet = () => (habitatEl ? pets.find((pet) => pet.id === habitatEl.dataset.petHabitat) : undefined);

  // The box also gets data-pet-away while its pet naps or sleeps, so Studium can say when it's back.
  // That stays even while pets are hidden, for Studium's still picture.
  function markAttached() {
    if (!habitatEl) return;
    habitatEl.toggleAttribute('data-pet-attached', !hidden && Boolean(habitatPet()));
    const entry = away[habitatEl.dataset.petHabitat];
    if (entry) habitatEl.setAttribute(L.PET_AWAY_ATTR, L.awayAttribute(entry));
    else habitatEl.removeAttribute(L.PET_AWAY_ATTR);
  }

  // Which pets show where. Away pets are hidden, except asleep in their own habitat box. Around
  // the page, at most petScreen.limit pets show, in its order (User Settings); a habitat always
  // shows its own pet.
  function applyHabitat() {
    const inside = habitatPet();
    const onScreen = L.petsOnScreen(pets.map((pet) => statusOf(pet.id) ?? { projectId: pet.id }), away, petScreen);
    for (const pet of pets) {
      const inBox = pet === inside;
      const isAway = Boolean(away[pet.id]);
      pet.setShown(isAway || habitatEl ? inBox : onScreen.has(pet.id));
      if (inBox && pet.boxEl() !== habitatEl) pet.enterBox(habitatEl);
      if (!inBox && pet.boxEl()) pet.leaveBox(positions[pet.id]?.xRatio);
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
    const el = document.querySelector('[data-pet-habitat]');
    if (el === habitatEl) return;
    if (habitatEl?.isConnected) {
      habitatEl.removeAttribute('data-pet-attached');
      habitatEl.removeAttribute(L.PET_AWAY_ATTR);
    }
    habitatEl = el;
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
    // In habitat mode, draw only inside the box, so the pet can't cover the page when it scrolls away.
    // The menu isn't clipped, and a check-in bubble gets more room above the box.
    const inside = habitatPet();
    host.style.clipPath =
      inside && !globalThis.PetMenu?.isOpen()
        ? L.habitatClip(habitatEl.getBoundingClientRect(), window.innerWidth, window.innerHeight, inside.isTalking() ? 90 : 40)
        : '';
    requestAnimationFrame(loop);
  }

  // ---- Start ----
  load().then(() => {
    if (onStudium) checkHabitat();
    requestAnimationFrame(loop);
  });
})();

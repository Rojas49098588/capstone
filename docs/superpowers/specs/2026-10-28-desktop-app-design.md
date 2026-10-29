# Studium desktop app

Date: 2026-10-28. Status: approved 2026-10-29.
Branch: `feature/desktop-app`, started from `feature/mood-notes`.
Due: the whole capstone is due **December 3rd, 2026** (about five weeks).

## Why

The user presented the MVP (Studium in the browser plus the Chrome extension pets) and the audience's
consensus was to move to a desktop app. The project types added in the last round (Writing, Art &
design, Music, Code) are mostly done outside the browser: in Word, Photoshop, a DAW or VS Code. A pet
that only lives on Chrome pages misses those people most of the day. On the desktop, a pet can be on
top of everything, and it can get up to the Goose-style mischief planned for the Moderate level.

It also removes the most fragile part of the current code: copying data and settings between the
Studium page and the extension (`petStatuses`, `petPrefs`, `petScreen`, the focus outbox). In one
desktop program, the pets and Studium share one process that holds the state.

## Goals (by December 3rd)

1. **A desktop app that runs on the user's Windows PC.** Studium opens in its own window. This is the
   minimum.
2. **Pets everywhere, all the time.** They roam the whole screen on top of every app, whether the
   Studium window is open, minimized or closed. Clicks pass through to whatever is underneath, except
   on a pet (and its menu, bubble or note).
3. **Everything the extension does today keeps working.** Moods and mood effects, sick sounds,
   drag/throw/click, the right-click menu (What should I work on?, Nap, Sleep, Open project), naps,
   sleep and check-ins, celebrations, Minimal/Mild/Moderate, sticky notes in the project's color
   signed with the pet's nickname, the "how many pets on screen" setting, and furniture in habitats.
4. **Habitats stay.** When a project page is open in the Studium window, that project's pet is in its
   habitat, as today.
5. **Two ways to open Studium:** the icon in the taskbar tray (near the clock), and right-clicking a
   pet and choosing "Open project", which opens that project's page.
6. **Easy mischief for Moderate pets** (below).
7. **A build classmates can install**, on Windows and, if possible, on Mac. Many of the user's
   classmates and testers are on Macs.

## Non-goals

- **Project sharing** between people. Wanted, but after December 3rd. It needs a hosted database and
  some kind of identity; that design comes later. Nothing in this round should make it harder (see
  "Leave room for sharing").
- **Moving existing data.** Everyone starts fresh in the desktop app. No import from the browser.
- **The browser version and the Chrome extension.** They are retired (below), not developed further.
- **Code signing and notarization.** Testers click past the warnings: "More info → Run anyway" on
  Windows, right-click → Open on Mac. Paying for Apple's developer program ($99/year) is the user's
  call later.
- **Auto-update.** Testers install a new build by hand.
- **Linux.**

## Anti-goals

Mischief must stay funny. The app fails if a tester wants to uninstall it. In particular:

- Never type into other apps, close anything, or touch files.
- Never take keyboard focus away from what the user is typing in. If Studium is brought forward by a
  pet, it is shown without focus (Electron `showInactive` / `moveTop`), so keystrokes keep going
  where they were going.
- Nothing during a nap or sleep (focus time), same as notes today.
- Nothing on Minimal; Mild behaves as today.

## How it's used (agreed with the user)

1. A classmate downloads the installer from a link and opens it (clicking past the security warning).
2. The Studium window opens, looking like the website does today. They go through setup and create
   their first project; an egg appears in its habitat.
3. They close or minimize the window to get to work.
4. The pets stay. Hatched pets walk along the bottom of the screen on top of every app, react to
   their mood, and on Moderate leave sticky notes and get up to mischief.
5. They open Studium again from the tray icon, or by right-clicking a pet → Open project.

My calls here, which the user agreed to in the playback:
- **The app starts with the computer** (`app.setLoginItemSettings`), so the pets are always there. A
  setting in Studium's Settings turns this off.
- **Closing the Studium window only hides it.** The app keeps running in the tray. Quit is in the
  tray menu.

## How it's built

### Electron

Electron, so the current code carries over: Studium is a React app (`web/`) and the pets are plain
JavaScript (`extension/content/`). Tauri was considered and dropped: it would mean writing the native
parts in Rust. New code goes in a new `desktop/` folder in the same repo.

The app has three parts:

- **Main process** (Node): the tray icon and menu, auto-start, the windows, and the state the
  extension kept in `chrome.storage.local` and its background worker (`extension/background.js`):
  pet statuses, prefs and screen settings, `petAway`, `petCheckIn`, the focus outbox, `petNoteAt`,
  saved pet positions. Its rules stay in the pure helpers of `logic.js` (`applyAwayRequest`,
  `parseAway`, and so on). It persists this state to a JSON file in Electron's `userData` folder, so
  naps and positions survive a restart.
- **The Studium window**: a normal window that loads the built `web/` app (in development, the Vite
  dev server on :5173). Studium's own data stays in that window's `localStorage`
  (`studium-data-v1`, `studium-settings-v1`), which Electron keeps in `userData`. A preload script
  replaces what `extension/content/bridge.js` and the Studium half of `pet.js` do today: it passes
  Studium's pet statuses and settings to the main process, delivers finished naps (the outbox), and
  forwards the habitat's Wake button.
- **The pet overlay**: one transparent, frameless, always-on-top window covering the primary
  display's work area (so pets stand on top of the taskbar, not behind it). It runs the pet code
  from `pet.js`, `menu.js` and `logic.js`. It ignores the mouse
  (`setIgnoreMouseEvents(true, { forward: true })`) except while the pointer is over a pet or its
  menu, bubble or note, when it takes clicks.

**Habitats:** pets keep being drawn in the Studium window's habitat box, as today. While a project
page is showing in the Studium window, its pet appears in the habitat and is hidden from the overlay;
the other pets keep roaming the desktop. When the page closes, the pet goes back to the overlay. How
the habitat pet is drawn (the same pet code loaded into the Studium window, as the content script is
today, is the obvious route) is left to the builder.

**Opening a project:** "Open project" and the tray's Open Studium show and focus the Studium window
(the user asked for these, so focus is fine here). They use the same `#project=<id>` link Studium
already follows.

**The tray menu** carries over the extension icon's menu: Open Studium, Show/Hide pets, Wake <pet>
for away pets, and adds Quit. Its tooltip says when there are no pets yet (as `updateTitle` does).

**Multiple monitors:** pets stay on the primary display for now (my call).

More of my calls:
- **The Studium window loads at login, hidden**, so moods and pet statuses keep refreshing (Studium
  recomputes them on a timer) even when nobody opens it. A hidden window doesn't count as a project
  page showing, so its pet stays on the desktop.
- **The overlay never takes keyboard focus** (`focusable: false`), so clicking a pet doesn't steal
  focus from the app being typed in.
- **A desktop note stays** until it's closed, its pet goes on a nap or sleep, or 15 minutes pass.
  (In Chrome it went when you left the tab; there's no tab now.)

### Mischief (Moderate only)

All the "easy" kinds, by December 3rd: four, since two brainstorm items became one (note under the table). None needs a permission from the operating system.

| Mischief | What happens | Who and how often (my defaults) |
|---|---|---|
| Sticky notes | As today, but anywhere on screen, on top of any app. A pet now and then carries its note in from the screen edge and drops it. | Today's rules: worst mood writes, Happy 60 / Worried 30 / Upset 15 / Sick 10 minutes. |
| Chase the mouse | The pet notices the cursor and runs after it for a few seconds, or pounces when it stops. Cursor position comes from the main process (`screen.getCursorScreenPoint`), not from mouse events. | Any awake mood except Sick, every 10 to 20 minutes, a chase of about 10 seconds. More often when Proud or Delighted. |
| Open its project | An upset or sick pet shows the Studium window at its project page, **without taking focus**. | Upset and Sick only. At most once every 2 hours, and not if Studium was open in the last 30 minutes. |
| Real sounds | When a pet says its sound in a bubble ("Meow!", "*cough*"), it also plays it. A mute switch in Settings. | Moderate only, gentle volume, at most one sound every 30 seconds across all pets. |

("Open something" and "pop Studium to the front" from the brainstorm are one item here: opening the
pet's project page in Studium is both.)

Everything above uses the existing quiet rules: nothing during naps or sleep, nothing while a
check-in question is open, and nothing on Minimal. The numbers live in one place (like
`NOTE_GAP_MINUTES`) so they are easy to tune.

**Sound files:** the repo has none. The builder uses short free (CC0) clips, one per animal plus
sneeze, sniffle, cough and sigh, and lists their sources in `README.md`; the user can swap them.

### Stretch, only if there's time after the above

In the user's order:

1. **Nudge a window:** the pet pushes the active window a little to the side. Windows first (a native
   call to move the foreground window), Mac only with Accessibility permission.
2. Drag the mouse a short way (rare: at most once an hour). Needs native input code, and Accessibility
   permission on Mac.
3. Walk on top of windows instead of only along the bottom of the screen.

### Building and handing out

- An installer for Windows (for example an NSIS `.exe` via electron-builder), built on the user's PC.
- A Mac `.dmg`, which has to be built on a Mac: a GitHub Actions workflow on a macOS runner
  builds it. The repo (`Rojas49098588/capstone`) is private, so this uses Actions minutes; macOS
  minutes count ten times, so builds should be on demand (manual trigger or a tag), not on every
  push.
- Both unsigned. The README gets a short "Installing" section with the warning steps for each.

### Retiring the browser version and the extension

- Before the switch, tag the last working extension version: `chrome-extension-final`.
- The README says the desktop app is the way to run Studium, and the extension and running
  Studium in a browser are retired.
- The extension's code stays in the repo while the desktop app reuses it. Where the shared pet code
  ends up (left in `extension/content/`, or moved to `desktop/`) is the builder's choice; the
  existing tests that import it move with it.
- The web app keeps building with Vite; it's simply loaded by Electron now. Nothing in it has to
  stop working in a browser, but it isn't tested there anymore.

### Leave room for sharing

Sharing comes next. This round doesn't build any of it, but:
- Keep the pet state in the main process behind one small module (load, save, change), not spread
  across files, so it can later sync with a server.
- Don't add anything that assumes a single user per project.

## Testing

- The pure logic keeps its Vitest tests (`logic.js` and the web app). New pure rules (mischief timing,
  overlay click-through regions, window/tray state) get Vitest tests in the same style.
- The main process's state module gets unit tests (load, save, damaged file).
- An end-to-end check with Playwright's Electron support (`_electron.launch`): the app starts, the
  Studium window shows setup, a hatched pet appears in the overlay, right-click → Open project opens
  its page, the tray's Show/Hide works, closing the window keeps the pets.
- By hand on the user's PC before each handout: install from the installer, start-with-computer, and
  each mischief once (with the timings shortened by a dev setting, like today's `petTimingOverride`).

## Order of work (suggested)

About five weeks, from October 28th to December 3rd:

1. **Week 1:** Electron shell. Studium window, tray, close-to-tray, auto-start, the main-process
   state module, a Windows installer. Tag `chrome-extension-final` first.
2. **Week 2:** Pets in the overlay with click-through, drag/throw, menu, naps/sleep/check-ins,
   celebrations, Open project, habitats in the Studium window.
3. **Week 3:** Notes on the desktop and the three other mischief kinds (chase, open its project, sounds).
4. **Week 4:** Mac build through GitHub Actions, an install test on a classmate's Mac, README,
   fixes from testers.
5. **Last days:** buffer, then the stretch list.

## Left to the builder

- Electron tooling (Forge or electron-builder), and how `desktop/` is laid out.
- How pet code is shared between the overlay and the Studium window, and whether `pet.js` runs with
  a small stand-in for the `chrome.*` calls it makes or is changed to call the main process directly.
- How the overlay decides when to take the mouse (hit-testing pets, menus, bubbles, notes).
- The exact chase and note-carry animations.
- Which free sound clips to use.

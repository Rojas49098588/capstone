# The demo stand: a demo save with Reset, and a cheat sheet: design

Date: 2026-11-18. Status: draft, waiting for the owner's approval.
Builds on: `docs/ROADMAP.md` ("Still needed for the demo", item 7) and every feature spec in this folder.

## Why

The final demo on December 3 is an **informal stand of about 30 minutes**, not a talk. Peers come up one or
two at a time, watch, try the app and ask questions. The owner runs it alone, from their own laptop connected
to a TV. The goals are that visitors **get a general idea of how Studium works** and **want to download it** (QR
code to `/releases/latest`, `docs/demo/download-qr.png`).

The owner's worry is too much content for the time. So the stand shows one path in depth and leaves the rest to
questions.

What hooks people, in the owner's words, is **the pets roaming on screen**.

## Goals

1. **A demo save** that looks like a real student's semester, built from the owner's five real classes
   with made-up requirements and tasks (the owner's choice: the real ones aren't up to date).
2. **A separate "Studium Demo" copy on the laptop** with its own data, so the owner's real save, pets and
   account are never touched.
3. **Reset demo:** one button, only in the demo copy, that rebuilds the demo save fresh, with dates
   worked out from the day it's pressed.
4. **A one-page cheat sheet** for the owner (pitch, planner path, things for visitors to try, answers,
   what to skip when busy).

## Non-goals

- A scripted 30-minute talk or slides.
- Anything in the phone app or the browser extension.
- Changes to features. This only arranges what exists.
- A demo mode in the downloadable app that visitors would see.

## Anti-goals

- **The owner's real data is never read, changed or synced** by the demo copy. The demo copy never signs in.
- **Peers who download Studium never see Reset demo or the demo data.** The demo is reached only by the
  shortcut's command-line flag.
- **Dates never look stale.** "Today", "Soon", overdue and moods must be right on rehearsal day (12/2), demo
  day (12/3) or any other day Reset is pressed.
- **Visitors can't get stuck.** There are enough tokens to buy several things, and a messy save is one Reset
  away.

## The visitor flow (what the data must support)

About 3 to 5 minutes per visitor:

1. **Attract:** pets wander the TV screen, with a toy out. That draws people over.
2. **30-second pitch** from the owner: a planner where each class gets a pet; keep up and your pets thrive.
3. **The owner drives the planner (about 2 minutes), in the Web Dev project:**
   - the requirements, one with a sublabel;
   - the ≡ menu: Collapse all, then the Soon filter;
   - a 🔒 requirement waiting on another;
   - drag a task to the top;
   - tick a task off: tokens are earned and the pet reacts.
4. **The visitor plays with the pets:**
   - throw the Focus Ball and watch the fetch;
   - right-click a pet and ask "What should I work on?";
   - buy a snack (the favorite flavor gets a ♥) and feed it;
   - open a habitat with decor and the Window.
5. **The QR code** on the way out, always visible by the laptop.

## The demo save

**Projects:** five projects, one per class, each with a different pet kind (cat, dog, frog, pigeon, turtle).
Stages are mixed so visitors see variety: mostly adults, at least one juvenile, no eggs (an egg doesn't roam). At least one project
has a second pet bought from the Shop.

| Project | Short name | What it is | Requirements (made up, believable) |
|---|---|---|---|
| Capstone: Studium | Capstone | This app | e.g. user testing, final installer, demo prep. Mostly done. |
| App Dev: Mustang Closet | App Dev | An app for the marching band's uniforms | e.g. inventory screen, check-out flow, testing with the band |
| Web Dev: Childcare website | Web Dev | A childcare center's site | **Front end, Back end, Middle layer, Deployment** (the owner's four). Deployment waits on the others (🔒). |
| 3D Animation: Blender short | 3D Anim | A short animation in Blender | e.g. storyboard, modelling, rigging, animation, render |
| UI/UX: YouTube redesign | UI/UX | Evaluating and redesigning YouTube's UI | e.g. heuristic evaluation, user interviews, wireframes, prototype |

**Must show, all relative to the day Reset is pressed:**
- **Web Dev** carries the planner path:
  - at least one requirement with a sublabel;
  - one requirement due within 3 days (so Soon shows something), and others later (so Soon hides some and says "N more hidden");
  - Deployment waiting on the others;
  - a requirement with 4 or more unfinished tasks, so dragging is worth showing;
  - one task on Today ready to tick off.
- **Today** has 3 to 5 tasks across projects, none done yet.
- **Moods are visibly different:** at least one pet happy (recent work), one doing worse (behind or overdue). Exact moods come from the event history the save is given.
- **Progress varies:** Capstone nearly done, others in the middle, so progress bars differ.
- **Tokens:** enough to buy several foods and a decor item (my call: around 1,500).
- **Habitats:** at least one already decorated, including the Window. Others are plainer so buying decor shows a change.
- **Toys** are owned, so the Focus Ball can go out at once.
- **Desktop pets:** the "Pets on screen at once" setting shows all five, not just one.
- **Settings** (saved apart from the project data, `studium-settings-v1`): setup is marked done, pets interact at
  the most lively level, and a nickname is set. Reset puts these back too.

## The demo copy and Reset

- **The shortcut:** a "Studium Demo" shortcut that starts the installed app with
  `--user-data=<a folder of its own>` (already supported by `desktop/src/main/paths.js`) and a new flag, `--demo`.
  The real Studium must be quit first, so two sets of pets aren't on screen at once. The builder makes sure of
  this or puts it on the cheat sheet.
- **First start:** the demo copy with an empty save builds the demo data automatically, skipping setup.
- **Reset demo:** a button shown only with `--demo` (my call: in Settings, with a confirm step). It replaces the
  save and the settings above with fresh ones, then reloads the pets. Toy and desktop-pet positions held by the
  desktop app (`pet-state.json`) don't need resetting; pets just carry on from where they are.
- **No sign-in in the demo copy:** the account section is hidden or disabled with `--demo`, so nothing syncs.
- **Where the data comes from:** a function that builds the whole demo save from "now". It's tested like the
  rest of the planner: it loads through `normalizeData` without changes, and the "must show" list above holds
  for any date.

## The cheat sheet

`docs/demo/cheat-sheet.md`, one printed page:
- **The pitch** (30 seconds).
- **The planner path**, step by step, matching the data above.
- **"Try it yourself" list** for visitors.
- **Answers to likely questions:** Is it free? Mac and Linux? Does it sync? Is there a phone app (built, not in
  the demo, coming later)? What's next (from the ROADMAP's after-December list)?
- **When busy:** skip the drag and the 🔒; show Soon and one tick, then hand over the pets.
- **Before the stand:** quit the real Studium, open Studium Demo, press Reset, check the sound goes to the TV,
  put the QR code out.

## Settled in the builder check (my calls, Claude's)

- Reset covers both saved parts: the project data and the settings. Pet positions on the desktop aren't reset.
- No eggs in the demo: an egg doesn't roam, and roaming is the hook.
- Tokens around 1,500; the exact number is tuned so a visitor can buy a few foods and one decor item.

## Left to the builder

- The exact requirements, tasks, estimates and event history, within the "must show" list.
- How the Reset confirm looks, and where exactly the shortcut points (installed app path, demo folder).
- How the shortcut is created (a small script or written steps on the cheat sheet).

## Schedule

The data and Reset can be built now and checked in the next test installer. Rehearse with it on 12/2, per the
ROADMAP.

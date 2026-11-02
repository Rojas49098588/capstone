# Capstone

**Studium** is a study and project manager with project pets, as a desktop app for Windows and Mac.

## Installing

Download the latest version from this repo's **[Releases](https://github.com/Rojas49098588/capstone/releases)** page, under **Assets**:

- **Windows:** `Studium-Setup-<version>.exe`
- **Mac** (Apple chip or Intel): `Studium-<version>-mac.dmg`

Studium isn't signed with a paid certificate, so your computer warns you the first time.

- **Windows:** open the `.exe`. At "Windows protected your PC", click **More info → Run anyway**.
- **Mac:**
  1. Open the `.dmg`, drag **Studium** into **Applications**, then open it. macOS says it can't check it for malware; click **Done**.
  2. Go to **System Settings → Privacy & Security**, scroll down, and click **Open Anyway** next to Studium (macOS 15 and later). On macOS 14 or earlier, you can instead right-click Studium → **Open**.
  3. If macOS says Studium "is damaged and can't be opened", run `xattr -cr /Applications/Studium.app` in Terminal and open it again.
  4. On a Mac, Studium's icon is in the menu bar at the top right, and pets walk along the top of the Dock.

To update, install the new version over the old one. Your projects and pets stay.

## The code

Two parts:

- **`extension/`**: a Chrome extension (Manifest V3, plain JavaScript, no build step). It puts a virtual pet on every page you visit and remembers where it was. Clicking the toolbar icon opens the homepage.
- **`web/`**: the homepage, **Studium**, a study and project manager built with Vite, React, TypeScript and Tailwind CSS v4. It started as a Figma Make export. [HANDOFF.md](HANDOFF.md) is the current status and briefing for whoever works on it next.

## Run the homepage

```sh
cd web
npm install
npm run dev
```

It runs at http://localhost:5173 (the port is fixed because the extension opens that URL).

## Desktop app

The desktop app in `desktop/` (Electron, Windows and Mac) is the way to run Studium. Running Studium in a browser and the Chrome extension are retired (the last extension version is tagged `chrome-extension-final`); the desktop app still reuses the extension's pet code. See the spec `docs/superpowers/specs/2026-10-28-desktop-app-design.md`. Week 1 is done: Studium opens in its own window, closing it keeps the app in the tray by the clock, the app starts with the computer and opens its window (Settings can turn that off, or start it quietly in the tray instead), and naps and sleep run in the app. Week 2 is done: hatched pets walk along the top of the taskbar, on top of every app, even with Studium closed. Clicks pass through to whatever is underneath except on a pet, so you can drag, throw and click them, and right-click one for its menu (What should I work on?, Nap, Sleep, Open project). A project page in Studium shows its pet in the habitat; that pet leaves the desktop until the window is closed or minimized. **Hide pets** / **Show pets** is in the tray menu. Week 3 is done: on Moderate, pets leave sticky notes anywhere on the desktop (gone after 15 minutes, some carried in from the screen edge), chase the mouse now and then, make their sounds out loud (Settings → **Pet sounds**), and an upset or sick pet brings Studium up at its project page without taking your keyboard focus. None of this happens during a nap, while a pet asks how a nap went, or on Mild or Minimal.

```sh
cd desktop
npm install
npm start          # builds web/ and opens the app
npm run dev        # the app on the Vite dev server: run `npm run dev` in web/ first
npm test           # unit tests
npm run test:e2e   # starts the real app (builds web/ first)
npm run dist       # this computer's installer (Windows .exe or Mac .dmg) in your home folder's StudiumBuilds
```

- **Releases:** GitHub → **Actions** → **Build installers** → **Run workflow** (`.github/workflows/build.yml`). It runs the tests, builds the Windows `.exe` and the universal Mac `.dmg`, checks each packaged app starts, and puts both on a draft Release `v<version>` (from `desktop/package.json`). Open it on the Releases page and click **Publish release**. Only a run on `main` makes a release. Running it again for the same version replaces the files while the release is still a draft; once published, it's never changed, so bump the version for a new release.

- Dev mode (`npm run dev`) loads `http://localhost:5173`, so its Studium data is separate from the built app's.
- Closing the window only hides it. To quit, right-click Studium's taskbar button (or the egg in the tray; Windows may tuck it under the **^** by the clock) and choose **Quit Studium**. On a Mac, use the menu bar icon's **Quit** or press Cmd+Q; clicking the Dock icon brings a closed window back.
- The installer isn't signed: Windows shows "Windows protected your PC", so click **More info → Run anyway**.
- The installer is built outside the repo (set `STUDIUM_RELEASE_DIR` to change where): built inside OneDrive, the installer step timed out while OneDrive synced the 120 MB file.
- `desktop/node_modules` holds the Electron program. Like `web/node_modules`, it's best kept out of OneDrive sync. On a new PC, OneDrive may leave these folders "online-only", which makes tests time out; right-click them → **Always keep on this device**.
- The pets run the extension's own code (`extension/content/`): the desktop app loads it into a see-through window over the screen (`desktop/src/overlay/`) and into the Studium window for habitats.

### Pet sounds

On Moderate, desktop pets make their sounds out loud (Settings → **Pet sounds** turns this off). The
files are `extension/assets/sounds/<sound>.wav`: `meow`, `bark`, `ribbit`, `coo`, `sneeze`, `sniffle`,
`cough` and `sigh`. They are placeholders synthesized by `desktop/scripts/makeSounds.js` (no
recordings, so there are no licences to track). To use a real clip, replace a file with one of the same
name, a short `.wav` under a second, and list its source here. Use only clips you may share, such as
CC0.

## Load the extension

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and choose the `extension/` folder.
4. Pin the extension so its icon shows in the toolbar.

After editing extension files, click the reload icon on the extension's card, then refresh any open pages.

**Using it:**
- Open Studium (click the toolbar icon) once: that's where the pets come from. Until then there are none, and the icon's tooltip says so.
- **First open shows a short setup**: what you make, a nickname, how strict and how chatty your pets are, and rings or bars, light or dark. A new user then starts with no projects; Studium asks you to create the first one, and the tutorial starts on it.
- **Each project has a type and a difficulty.** The type sets its words (a Writing project has chapters and scenes instead of requirements and tasks). The difficulty sets how soon its pet gets worried, upset or sick: Gentle, Steady or Strict.
- **How much pets interact** (Settings): Minimal pets stay put and quiet on web pages, Mild is the usual behavior, and Moderate pets also leave a sticky note about your work now and then (at most every 30 minutes).
- **A new project starts as an egg** that stays in its habitat. Adding the project's 3rd requirement hatches it: a pop-up says "<short name> is hatching!" and a juvenile (the adult art at 75% size, for now) appears. Pets that existed before eggs are adults.
- One pet per Studium project wanders along the bottom of every normal web page (eggs don't). Its mood follows the project: happy pets are quicker and chattier, worried and upset ones slow down, and a sick pet looks green and sneezes. Drag it to move it, or click it to make it hop.
- On a Studium project page, only that project's pet shows, living inside the page's habitat box.
- Click the toolbar icon to open or focus the homepage.
- **Decorate habitats.** Studium's Shop has a **Habitat** tab (next to **Supplies**). It sells:
  - wallpaper and flooring;
  - rugs and wall decor;
  - a pet bed;
  - one piece of furniture per kind of pet: a scratching post, a heat lamp, a perch, a mini sofa and a log.

  Under each project's habitat, the **Inventory** box lists what you own. **Items** has Medicine, food, clothes and toys. **Furniture** has your decor, with **Place**, **Move here**, **Remove** and **Plain**.

  In its habitat, a pet naps in its bed and now and then uses its own furniture.
- **Pets grow up.** A juvenile becomes a full-size adult once half the tasks it cares about are done since it hatched (tasks added later count too). Completing that task says "<name> grew up!".
- **More pets per project.** The Shop's **Pets** tab sells one egg per kind of pet (400 tokens). You pick the project it goes to. A project can have up to 4 pets, with one bought egg waiting at a time. A bought egg gets its own habitat (with its own furniture) under the project's other habitats. It hatches once any one requirement is half done since you bought it. Then you name it and choose what it cares about: the project's mood (shared with the first pet, including sickness and medicine) or one requirement (its own mood and health, and its own dose of medicine). On the desktop, bought pets roam like first pets, with their own name, the full menu (What should I work on?, Nap, Sleep, Open project) and mischief, and they count toward Pets on screen at once. A pet looking after a requirement suggests that requirement's tasks and offers them for naps. Open project opens the project page scrolled to that pet's habitat. While a project page is open in Studium, all of its pets live in their habitats there instead of on the desktop.
- Right-click a pet for its menu:
  - **What should I work on?** names the project's next task.
  - **Nap (15 min)** is a focus timer: the pet leaves while you work on that task and comes back to ask whether you finished. Every nap is saved in Studium as focus time ("Focused 45 min" on the task, "Focused this week" on the project), and it pre-fills "About how long did it take?". Only one pet naps at a time, and the others go quiet meanwhile.
  - **Sleep** sends the pet away for 1 or 2 hours and records nothing.
  - **Open project** opens that project in Studium.
- An away pet lies asleep in its Studium habitat, with a **Wake** button. You can also wake it from the toolbar icon's right-click menu.
- **Blocking:** a task can wait on other tasks, and a requirement on other requirements (or on all the others). A waiting requirement's tasks can't be checked off until every task in what it waits on is done; it shows "Waiting on …" (hover or tap "Waiting on 3" for the list). **Duplicate** on a requirement makes the next one in a series ("Prototype 9" → "Prototype 10") with its tasks unchecked, waiting on the original.
- Pets hop when you complete a task in Studium, and celebrate bigger for a project's first task and for a finished requirement.
- Right-click the toolbar icon and choose **Show / hide pet** to toggle it everywhere.
- Chrome blocks extensions on `chrome://` pages and the Chrome Web Store, so the pet can't appear there.

## Where to change things

| What | Where |
| --- | --- |
| Which pet a project gets | the egg picker in Studium's New Project form |
| How mood changes a pet | `MOOD_EFFECTS` in `extension/content/logic.js` |
| Habitat decor: items, prices, which spots they fit | `DECOR_ITEMS` in `web/src/store/decor.ts` |
| Decor art (placeholders) | `web/public/decor/<item id>.svg`. Replace a file to swap its art, or change `image` in `decor.ts` (for example to a `.png`). |
| Where the habitat spots are | `SLOT_LAYOUT` in `web/src/ui/decorLayout.ts` and `SLOT_POSITIONS` in `extension/content/logic.js`; a test keeps them the same |
| How often pets use furniture, and for how long | `furnitureChance` / `furnitureMs` in `KINDS` (`extension/content/pet.js`) |
| Nap length, the pet menu, check-ins, celebrations (rules and wording) | `extension/content/logic.js` (`NAP_MINUTES`, `applyAwayRequest`, `petMenuItems`, …) |
| Each pet's speed, size, sound, naps, hops, flying | `KINDS` in `extension/content/pet.js` |
| Shared physics (gravity, throwing, bounce) | constants at the top of `extension/content/pet.js` |
| Pet art | `extension/assets/pets/` (cleaned-up copies of the originals in `assets/`) |
| Studium's address (the icon opens it; pets read it) | `HOMEPAGE_URL` in `extension/content/logic.js` |
| Studium screens | `web/src/components/` (one file per piece; `App.tsx` is just the shell) |
| Wording shown in Studium (labels, token messages) | `web/src/ui/format.ts` |
| Egg looks and descriptions | `web/src/pets/eggs.ts` |
| Each difficulty's thresholds | `DIFFICULTY_RULES` in `web/src/planner/tuning.ts` |
| Each project type's words | `projectWords` in `web/src/ui/format.ts` |
| The hint under each project type | `PROJECT_TYPE_HINTS` in `web/src/ui/format.ts` |
| What blocks what (tasks and requirements, "All other requirements", loop checks) | `web/src/planner/blocking.ts` |
| How many tokens a new user starts with | `STARTING_TOKENS` in `web/src/planner/tuning.ts` (data saved before 2026-10-30 started with `LEGACY_STARTING_TOKENS`, 650) |
| Readable text on a project color | `web/src/ui/color.ts` (and `textOn` in `extension/content/logic.js` for the pet's name label) |
| Setup's questions and wording | `web/src/components/Setup.tsx`, `SETUP_COPY` in `web/src/ui/format.ts` |
| Sticky notes: how often (by mood), what they say | `NOTE_GAP_MINUTES`, `SICK_NOTES`, `UPSET_NOTES`, `WORRIED_NOTES`, `noteText` and `chooseNote` in `extension/content/logic.js` |
| How many requirements hatch an egg, and the juvenile size | `HATCH_REQUIREMENTS` and `JUVENILE_SCALE` in `web/src/planner/tuning.ts` (and `JUVENILE_SCALE` in `extension/content/logic.js`; a test keeps them equal) |
| The egg shown in the habitat | `web/public/pets/egg.png` |
| Studium colors, fonts, dark mode | `web/src/index.css` |

## Planner core (Studium logic)

The rules from the planner spec (`docs/superpowers/specs/2026-10-14-studium-planner-design.md`) live in `web/src/planner/` as plain, tested functions. The Studium screens use them through `web/src/store/useStudium.tsx`, which saves every change in this browser.

| What | Where |
| --- | --- |
| Every tunable number (bonuses, thresholds, curve, token rate) | `web/src/planner/tuning.ts` |
| Example projects, requirements and tasks | `web/src/store/seed.ts` |
| Shop items, including Medicine | `web/src/store/products.ts` |
| Bought pets: growing up, eggs hatching, a pet's mood, egg limits | `web/src/planner/pets.ts` |

Run the tests with `npm test` in `web/`.

## Ideas for next steps

- Sprite sheets with real animation frames (walking, sleeping, the frog's tongue) to replace the single images.
- Studium's own next steps are listed at the end of HANDOFF.md (saving data, earning tokens, using shop items).
- Toolbar icons (`icons` in `manifest.json`).

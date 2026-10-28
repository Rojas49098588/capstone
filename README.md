# Capstone

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

## Load the extension

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and choose the `extension/` folder.
4. Pin the extension so its icon shows in the toolbar.

After editing extension files, click the reload icon on the extension's card, then refresh any open pages.

**Using it:**
- Open Studium (click the toolbar icon) once: that's where the pets come from. Until then there are none, and the icon's tooltip says so.
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
- Right-click a pet for its menu:
  - **What should I work on?** names the project's next task.
  - **Nap (15 min)** is a focus timer: the pet leaves while you work on that task and comes back to ask whether you finished. Every nap is saved in Studium as focus time ("Focused 45 min" on the task, "Focused this week" on the project), and it pre-fills "About how long did it take?". Only one pet naps at a time, and the others go quiet meanwhile.
  - **Sleep** sends the pet away for 1 or 2 hours and records nothing.
  - **Open project** opens that project in Studium.
- An away pet lies asleep in its Studium habitat, with a **Wake** button. You can also wake it from the toolbar icon's right-click menu.
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

Run the tests with `npm test` in `web/`.

## Ideas for next steps

- Sprite sheets with real animation frames (walking, sleeping, the frog's tongue) to replace the single images.
- Studium's own next steps are listed at the end of HANDOFF.md (saving data, earning tokens, using shop items).
- Toolbar icons (`icons` in `manifest.json`).

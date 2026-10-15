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
- One pet per Studium project wanders along the bottom of every normal web page. Its mood follows the project: happy pets are quicker and chattier, worried and upset ones slow down, and a sick pet looks green and sneezes. Drag it to move it, or click it to make it hop.
- On a Studium project page, only that project's pet shows, living inside the page's habitat box.
- Click the toolbar icon to open or focus the homepage.
- Right-click the toolbar icon and choose **Show / hide pet** to toggle it everywhere.
- Chrome blocks extensions on `chrome://` pages and the Chrome Web Store, so the pet can't appear there.

## Where to change things

| What | Where |
| --- | --- |
| Which pet a project gets | the egg picker in Studium's New Project form |
| How mood changes a pet | `MOOD_EFFECTS` in `extension/content/logic.js` |
| Each pet's speed, size, sound, naps, hops, flying | `KINDS` in `extension/content/pet.js` |
| Shared physics (gravity, throwing, bounce) | constants at the top of `extension/content/pet.js` |
| Pet art | `extension/assets/pets/` (cleaned-up copies of the originals in `assets/`) |
| Studium's address (the icon opens it; pets read it) | `HOMEPAGE_URL` in `extension/content/logic.js` |
| Studium screens | `web/src/components/` (one file per piece; `App.tsx` is just the shell) |
| Wording shown in Studium (labels, token messages) | `web/src/ui/format.ts` |
| Egg looks and descriptions | `web/src/pets/eggs.ts` |
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

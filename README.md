# Capstone

Two parts:

- **`extension/`**: a Chrome extension (Manifest V3, plain JavaScript, no build step). It puts a virtual pet on every page you visit and remembers where it was. Clicking the toolbar icon opens the homepage.
- **`web/`**: the homepage, **Studium**, a study and project manager built with Vite, React, TypeScript and Tailwind CSS v4. It came from the Figma Make export described in [HANDOFF.md](HANDOFF.md), which documents its features, data model and design system.

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
- The pet wanders along the bottom of every normal web page. Drag it to move it, or click it to make it hop.
- Click the toolbar icon to open or focus the homepage.
- Right-click the toolbar icon and choose **Show / hide pet** to toggle it everywhere.
- Chrome blocks extensions on `chrome://` pages and the Chrome Web Store, so the pet can't appear there.

## Where to change things

| What | Where |
| --- | --- |
| Which project gets which pet | `PROJECTS` in `extension/content/pet.js` |
| Each pet's speed, size, sound, naps, hops, flying | `KINDS` in `extension/content/pet.js` |
| Shared physics (gravity, throwing, bounce) | constants at the top of `extension/content/pet.js` |
| Pet art | `extension/assets/pets/` (cleaned-up copies of the originals in `assets/`) |
| Homepage URL the icon opens | `HOMEPAGE_URL` in `extension/background.js` |
| Studium projects, shop items, all UI | `web/src/App.tsx` (see HANDOFF.md) |
| Studium colors, fonts, dark mode | `web/src/index.css` |

## Ideas for next steps

- Sprite sheets with real animation frames (walking, sleeping, the frog's tongue) to replace the single images.
- Pet stats (hunger, happiness) stored in `chrome.storage` and shown on the homepage, using `externally_connectable` so the homepage can talk to the extension.
- Completing tasks on the homepage rewards the pet.
- Studium's own next steps are listed at the end of HANDOFF.md (saving data, earning tokens, using shop items).
- Toolbar icons (`icons` in `manifest.json`).

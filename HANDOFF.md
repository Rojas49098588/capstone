# Studium — Project Handoff

## Product summary

Studium is an interactive study and project manager wireframe with a Swiss modernist visual style. It supports multiple simultaneous projects, task checklists, daily goals, deadline tracking, priority surfacing, project companions, dark mode, and a lightweight rewards shop.

The five seeded projects are:

- `webDev` — Web Development Portfolio
- `appDev` — Mobile App — Habit Tracker
- `Animation` — 3D Animation Reel
- `seniorCap` — Senior Capstone Project
- `petExt` — Virtual Pet Extension (added in Capstone; the Chrome extension shows one pet per seeded project, see `PROJECTS` in `extension/content/pet.js`)

## Current implementation

### Overview

- Aggregates task and daily-goal completion across all projects.
- Displays total progress plus concentric project progress rings.
- Includes per-project progress summaries and deadline countdowns.
- Surfaces incomplete flagged tasks in **Priority Focus**, ordered by nearest deadline.
- Priority tasks can be completed directly from the overview.

### Project details

- Shows the project description, deadline, days remaining, and task progress.
- Supports adding, completing, prioritizing, and removing tasks.
- Supports adding, completing, and removing today's goals.
- Sorts priority tasks to the top of the project checklist.
- Includes a responsive Tamagotchi habitat at the bottom of each project.

### Project companion

Companion status is derived from current project activity:

- Overall status: `Settling in`, `Growing`, or `Thriving`.
- Hunger combines task completion and today's goal completion. Lower is better.
- Hunger labels: `Satisfied`, `Peckish`, and `Hungry`.
- Mood combines task completion and today's goal completion.
- Mood labels: `Calm`, `Happy`, and `Delighted`.
- Hunger and Mood show readable labels, percentages, and accessible
  `role="progressbar"` metadata.

### Shop

- Available from both desktop and mobile navigation.
- Starts with **650 Study Tokens**.
- Offers food, clothes, and toys.
- Purchases reduce the token balance and increment the item's inventory count.
- Unaffordable products are disabled and show the token shortfall.

### Theme

- Light and dark themes use semantic CSS custom properties.
- The active theme is applied to the root element with `data-theme`.
- The preference is stored in `localStorage` under `studium-theme`.
- When no saved preference exists, the initial theme follows
  `prefers-color-scheme`.

## Architecture

The application is intentionally compact:

- `src/main.tsx` mounts the React application and imports global styles.
- `src/App.tsx` contains types, seed data, calculations, all UI components, and
  client-side state.
- `src/index.css` contains Tailwind CSS v4 setup, Google Font imports, theme
  tokens, and global element styling.

Key components in `src/App.tsx`:

- `App` — application shell, navigation, theme, and top-level state.
- `Overview` — aggregate progress, priority focus, and project cards.
- `ProjectDetail` — project tasks, daily goals, and progress.
- `ProjectCompanion` — habitat illustration and derived wellbeing metrics.
- `Shop` / `ShopProductIcon` — catalog, purchasing, and inventory display.
- `AddProjectModal` — new-project form.

No router or external state library is used. Navigation is represented by the
`page` and `selectedId` state values.

## Data and persistence

- Project data is initialized from `INITIAL_PROJECTS`.
- Projects, tasks, goals, token balance, and inventory live only in React
  memory and reset on page reload.
- Theme is the only persisted application state.
- IDs for newly created projects, tasks, and goals use `Date.now()`.
- Shop transactions are intentionally fake and have no backend.

This persistence boundary is the most important behavior to preserve or
deliberately change in future work.

## Design system

- Heading face: **DM Serif Display**
- Body face: **Inter**
- Utility/metadata face: **DM Mono**
- Primary: navy
- Accent: terracotta
- Project-specific colors identify projects in charts and detail views.
- Light and dark palettes are defined as semantic variables in
  `src/index.css`.
- Layout and styling use Tailwind CSS v4 utility classes directly in JSX.

Fonts currently load through a Google Fonts CSS import, so they require network
access; browser fallbacks are defined in the theme.

## Important behavior and edge cases

- A project with no tasks reports `0%` progress.
- A project with no daily goals uses a neutral `0.5` goal ratio for companion
  calculations.
- Deadlines use the browser's local time and `Math.ceil` when calculating days
  remaining.
- A deadline at or below zero days is labeled `Overdue`.
- The theme's system preference is read only during initial state creation;
  later operating-system theme changes do not automatically update the app.
- The add-project modal requires a name and deadline; description and short
  label are optional.
- There is currently no project edit or delete flow.
- Purchased companion items are counted in inventory but cannot yet be used,
  equipped, or fed to a companion.
- Study Tokens are spent but are not currently earned through task completion.

## Development

The Figma Make development server is already running and should not be started
manually. Source changes hot reload in the preview.

Available scripts:

```sh
pnpm build
pnpm format
```

The project uses React 19, Vite 8, TypeScript 5.7, Tailwind CSS v4, and oxfmt.
Repository-specific guidance is in `AGENTS.md`.

## Verification status

At handoff:

- `pnpm build` passes.
- `git diff --check` passes.

## Suggested next steps

1. Persist project, goal, shop, and token state in local storage or a backend.
2. Add editing/deletion for projects and optional due dates for individual
   tasks.
3. Award Study Tokens for meaningful completion events with safeguards against
   repeated toggling.
4. Connect purchased food, clothes, and toys to companion interactions and
   visuals.
5. Add modal focus management, Escape-to-close behavior, and broader accessible
   labels for icon-only controls.
6. Add focused tests for progress calculations, companion thresholds, priority
   ordering, purchases, and persistence.

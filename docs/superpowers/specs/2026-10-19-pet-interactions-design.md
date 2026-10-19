# Pet Interactions and Focus Sessions — Design

_Date: 2026-10-19. Status: approved in conversation, awaiting written-spec review._
_Builds on: `2026-10-14-studium-planner-design.md` (Plans 1–3, all merged)._

## Goal

Give the browser pets interactions that help projects move forward, not just play:
- A **right-click menu** on each pet.
- **Nap**: a 15-minute focus timer. The pet leaves while you work on its project and comes back to check in.
- **Sleep**: the pet goes away for 1 or 2 hours ("leave me alone").
- **What should I work on?**: the pet names its project's next task.
- **Open project**: jumps to the project in Studium.
- **Celebrations**: pets hop when you complete tasks in Studium.

Every nap is recorded in Studium as **focus time**. That gives the user a second measure of actual time, alongside the "how long did it take?" answers, and it's the data a later round will use for **work limiters**.

## Decisions made during brainstorming

| Topic | Decision |
|---|---|
| Purpose of nap and sleep | Nap is a focus timer; sleep is a longer "leave me alone". |
| Scope of this round | The pet menu, nap, sleep, What should I work on?, Open project, and celebrations. Medicine and treats from the pet are **out**: inventory is being redesigned separately. Deadline nudges wait for a later round. |
| Focus tracking | Naps are recorded in Studium as focus sessions (option C). |
| Work limiters | A separate later round ("B"). It will use the focus data from this round. Nothing in this design limits work. |
| Focus time and the completion prompt | "About how long did it take?" is **pre-filled** with the focus minutes on that task, and the user can still change it. |
| Waking early | Records the **real** minutes; the pet returns with the usual check-in. |
| Sleep length | Chosen each time: **1 hour** or **2 hours**. Sleep records nothing and never changes mood. |
| Other pets during a nap | They keep walking but **go quiet**: no sounds, no speech bubbles, no idle reminders. |
| Data from the extension to Studium | A **mailbox**: the extension keeps finished sessions until the Studium page confirms it has saved them. |
| Focus sessions at a time | One. While a pet naps, Nap is disabled on the others. |
| Habitat while away | The pet lies asleep and still in its habitat box. Studium shows "<name> is napping · back in 12 min" with a **Wake** button. |

## 1. Studium side

### Focus sessions in the event log

New event type:

```ts
| {
    type: "focus_session";
    at: string;            // ISO time the session ended
    id: string;            // made by the extension when the nap started; recording is idempotent by id
    projectId: string;
    taskId: string | null; // the task the nap was for, if any
    startedAt: string;     // ISO
    minutes: number;       // whole minutes actually focused, >= 0
  }
```

- `isValidData` accepts it: `id`, `projectId` and `startedAt` must be strings, `taskId` a string or null, and `minutes` a finite number ≥ 0. Older builds keep it and ignore it, as with any unknown event type.
- A new action, `recordFocusSessions(data, sessions, now)`:
  - skips ids already in the log;
  - drops sessions whose project no longer exists;
  - records `taskId: null` when the task no longer exists;
  - rounds minutes to whole numbers and clamps them to 0–240;
  - returns the data and the ids it has **handled**: recorded, already in the log, or dropped because the project is gone. The extension deletes its copies of all of them, so nothing is resent forever.
- Focus sessions never pay tokens and never change progress or mood.

### Using focus time

- `focusMinutes(events, filter)` sums sessions. The filter is a project, a task, and/or a "since" time.
- **Completion prompt:** opens with the minutes focused on that task since it was created or last reopened, whichever is later. With no focus time, it opens with the estimate, as now. The user's answer is still what's recorded.
- **Task row:** shows "Focused 45 min" when the task has focus time since it was last reopened.
- **Project page:** a "Focused this week: 2 h 30 min" line under the overall progress. The week starts Monday, local time.

### What Studium publishes to the pets

`PetStatus` (the `studium-pets-v1` entries) gains two fields:

```ts
suggestion: { taskId: string; title: string; estimateMin: number } | null;
celebration: { at: string; finishedRequirement: boolean } | null;
```

- **`suggestion`** is the project's first open, linked, unblocked task:
  1. tasks in **Today's plan** for this project first, in Today's order;
  2. then the project's tasks in the same order as Suggested next (pinned first, then by expected tokens).

  It is `null` when there is none.
- **`celebration`** is the project's latest `task_completed` event that **paid tokens** (a first completion). `finishedRequirement` is true when that event's `breakdown.finish > 0`. Re-checking an old task doesn't celebrate.
- The extension's `parseStatuses` accepts both fields when they're valid and treats missing or damaged ones as `null`, so old statuses still load.

### Links into Studium

Studium reads `location.hash` on load and on `hashchange`, then clears it with `history.replaceState`:
- `#project=<projectId>`: opens that project's page. An unknown id stays on the overview.
- `#complete=<taskId>`:
  - opens the task's project and its completion prompt (pre-filled as above);
  - if the task is already done or blocked, only the project opens;
  - an unknown task does nothing.

### The habitat while a pet is away

- The extension marks the habitat box with `data-pet-away="<nap|sleep>:<ISO time it returns>"` while that project's pet is away.
- Habitat shows "**<shortName> is napping** · back in 12 min" (or "is sleeping · back at 4:30 PM") and a **Wake** button. The text updates with the provider's `now`.
- **Wake** dispatches `window.dispatchEvent(new CustomEvent("studium:wake-pet", { detail: "<projectId>" }))`.
- The pet itself is drawn asleep in the box by the extension (section 2).
- Without the extension (no `data-pet-attached`), Studium shows its still picture with the same "is napping" line.

### Receiving sessions from the extension

- On the Studium page, the extension dispatches `studium:focus-sessions` on `window`. Its `detail` is a **JSON string** of `FocusSession[]`, because only strings cross between the extension's world and the page safely.
- After mounting, the provider dispatches `studium:ready` on `window`, so the extension knows it can send.
- The provider listens for `studium:focus-sessions`. It parses and validates each session, calls `recordFocusSessions`, saves, and then answers with `studium:focus-received` (`detail`: JSON string of the handled ids).
- If saving fails (storage full or unavailable), Studium doesn't answer, so the extension keeps the sessions.

## 2. Extension side

### State in `chrome.storage.local`

```js
petAway: { [projectId]: { kind: 'nap' | 'sleep', id, startedAt, until, taskId, taskTitle } }
focusOutbox: { [sessionId]: FocusSession }   // finished naps waiting for Studium
petCheckIn: { projectId, taskId, taskTitle, minutes, at } | null
```

- The background service worker is the **only writer** of `petAway`, `petCheckIn` and new `focusOutbox` entries.
- Content scripts send requests to the worker with `chrome.runtime.sendMessage`:
  - `{ type: 'nap', projectId }`
  - `{ type: 'sleep', projectId, hours: 1 | 2 }`
  - `{ type: 'wake', projectId }`
  - `{ type: 'checkIn', answer: 'done' | 'notYet' | 'later' }`
  - `{ type: 'openProject', projectId }`
  - `{ type: 'delivered', ids }`
- `logic.js` gains validators for all three keys, and damaged entries are dropped. An away entry whose `until` is more than 2 hours ahead is treated as damaged, so a pet can't be hidden forever.

### Timing (the background worker)

- **Nap:**
  - Refused if any pet is already on a nap.
  - Records `until = now + NAP_MINUTES` (15), plus `taskId`/`taskTitle` from the pet's current `suggestion`.
  - Sets a `chrome.alarms` alarm named `away:<projectId>`.
- **Sleep:** the same, with 1 or 2 hours and no task.
- **Alarm or wake:** removes the away entry. For a nap it also:
  - adds a `FocusSession` to `focusOutbox`, with minutes = the whole minutes between `startedAt` and now (rounded down), at most `NAP_MINUTES`;
  - sets `petCheckIn`.
- **On startup:** ends any overdue entries the same way, which covers alarms missed while Chrome was closed.
- **New permission:** `alarms`. Chrome shows no warning for it.
- **Testability:** `NAP_MINUTES` can be overridden through `chrome.storage.local.petTimingOverride`. This exists only so the browser check doesn't wait 15 real minutes.

### The pet menu

- A `contextmenu` event on a pet prevents the browser menu and opens a small menu in the pets' shadow root, next to the pet:
  - **What should I work on?**
  - **Nap (15 min)**: disabled, with "Already focusing on <title or project>" as its hint, while another nap runs.
  - **Sleep ▸ 1 hour / 2 hours**
  - **Open project**
- It closes on Escape, on a click outside it, on scroll, or when the pet is rebuilt.
- In habitat mode, the habitat pet gets the same menu.
- An away pet asleep in its habitat offers only **Wake** and **Open project**.

### While pets are away

- **Normal pages:** away pets are hidden.
- **Studium habitat:** the away pet shows in its box in the existing sleeping style (breathing animation, "Zzz" bubble), with no physics, dragging or throws. The box gets `data-pet-away`.
- **The content script listens for `studium:wake-pet`** on the Studium page and sends `wake`.
- **The toolbar's right-click menu** gains one **Wake <shortName>** item per away pet, rebuilt whenever `petAway` changes.
- **Quiet mode:** while any pet is on a nap, the other pets keep moving but skip sounds, speech bubbles and "Haven't seen…" reminders. The menu's own bubbles (suggestions, check-ins, celebrations) still show.

### Check-in

- When `petCheckIn` is set, the returning pet shows a bubble with buttons in whichever tab is visible:
  - **With a task:** "Did you finish *<title>*?" with **Done** / **Not yet** / **Later**.
    - **Done** asks the worker to focus or open Studium at `#complete=<taskId>`.
    - **Not yet** starts a new nap on the same task.
    - **Later** clears the check-in.
  - **Without a task:** "Back! How did it go?" with **Open project** / **OK**.
- The check-in stays until it's answered, and shows in every tab until then.

### Other interactions

- **What should I work on?:** a bubble for about 6 seconds:
  - "Next up: *<title>* (~<estimate>)", or
  - "Nothing to suggest: everything's done or waiting on something."
- **Open project:** the worker focuses the existing Studium tab and sets its hash to `#project=<id>`, or opens a new tab at that address.
- **Celebrations:**
  - Each tab remembers the last `celebration.at` it saw per project (from the first statuses it loads, so old completions don't celebrate).
  - A newer one makes that pet hop once and say "Task done!".
  - With `finishedRequirement`, it hops twice and says "Requirement finished!".
  - Pets that are away don't celebrate.

### Mailbox delivery

- The content script on the Studium origin sends `focusOutbox` to the page whenever:
  - the script loads;
  - `focusOutbox` changes;
  - the page signals it's ready, with a `studium:ready` event dispatched by the provider after mount.
- On `studium:focus-received`, it asks the worker to delete those ids (`delivered`).

## 3. Error handling

| Situation | Behavior |
|---|---|
| Damaged `petAway` / `focusOutbox` / `petCheckIn` | Dropped by the validators; pets come back. |
| Studium not opened for days | Sessions wait in `focusOutbox`, with no limit (each is about 200 bytes). |
| Session for a deleted task | Recorded with `taskId: null`. |
| Session for a deleted project | Dropped by Studium; its id is still confirmed so the extension deletes its copy. |
| **Done** for a task that's gone or already done | Opens the project only. |
| Extension reloaded during a nap | The alarm survives; overdue naps are ended on startup. |
| Studium can't save | No `studium:focus-received`; the extension resends later. |
| A copy injected without the extension's APIs | Already handled by the guard at the top of `pet.js`. |

## 4. Testing

- **Vitest (web):**
  - validating and de-duplicating `focus_session`;
  - `recordFocusSessions` edge cases (deleted task or project, clamping, confirmed ids);
  - `focusMinutes`;
  - the pre-filled completion prompt;
  - "Focused…" on task rows and the project page;
  - `suggestion` and `celebration` in `buildPetStatuses`;
  - the hash links;
  - Habitat's away line and Wake event;
  - the provider receiving sessions and answering, and staying silent when a save fails.
- **Vitest (extension logic, from `web/src/extension/`):**
  - the new validators;
  - building a session at the end of a nap (minutes, clamping);
  - menu items for each state;
  - check-in wording;
  - `parseStatuses` with the new fields.
- **Playwright with the real extension** (scratch script, as before):
  - right-click opens the menu;
  - nap: the pet leaves and the others go quiet;
  - wake early from the toolbar: the session reaches Studium, and the task row shows "Focused N min";
  - **Done** opens the pre-filled prompt;
  - sleep 1 h: the pet is gone on normal pages and asleep in the habitat, and Wake brings it back;
  - completing a task in Studium makes the pet hop in another tab;
  - Open project focuses Studium on the right project;
  - the mailbox survives Studium being closed.

  The check shortens `NAP_MINUTES` through `petTimingOverride`.
- `npm test` and `npm run build` must pass.

## Out of scope

- Work limiters (next round). Deadline nudges.
- Medicine and treats from the pet (inventory redesign).
- Focus statistics beyond the two "Focused…" lines.
- Choosing a nap length.
- Naps for more than one pet at a time.

# Pet Interactions and Focus Sessions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each browser pet a right-click menu (What should I work on?, Nap, Sleep, Open project), record every nap in Studium as focus time, and make pets celebrate completed tasks.

**Architecture:**
- **Studium side.** A new `focus_session` event type, a pure `recordFocusSessions` action and `planner/focus.ts` sums. Screens show focus time (completion prompt, task row, project page). `petStatus.ts` adds `suggestion` and `celebration` to each pet. The provider receives sessions through window events and answers only after a successful save. `App.tsx` follows `#project=` / `#complete=` links. `Habitat.tsx` shows an "is napping" line from `data-pet-away`.
- **Extension side.** Every state change (nap, sleep, wake, check-in answer, delivery) is a pure reducer, `PetLogic.applyAwayRequest`, in `content/logic.js`, tested with Vitest. `background.js` is the only writer: it loads state, runs the reducer, saves, and carries out the effects it returns (alarms, opening Studium). Two new content scripts: `content/menu.js` (the pet menu's DOM, no `chrome.*`) and `content/bridge.js` (Studium page only: the mailbox and the Wake event). `content/pet.js` wires the menu, away pets, quiet mode, check-ins and celebrations.

**Tech Stack:** React 19, TypeScript 5.9 (strict, lib ES2020), Vitest 5 + jsdom, Chrome MV3 plain JS (no build step), Playwright from a scratch folder for the browser check.

**Spec:** `docs/superpowers/specs/2026-10-19-pet-interactions-design.md`. **Builds on:** `docs/superpowers/specs/2026-10-14-studium-planner-design.md` and Plans 1–3 (merged). Read `HANDOFF.md` "Gotchas" first.

## Global Constraints

- Branch: `feature/pet-interactions` (exists). Run web commands from `web/`: `npm test`, `npm run build` (type-checks tests too; run it after every task).
- TypeScript lib is ES2020: no `Array.prototype.at`, no `Object.hasOwn`.
- Planner and store functions take `now: Date` and never call `new Date()`/`Date.now()`. Components get time from the provider (`s.now`).
- Nothing in `extension/` may start with `_`. `logic.js` and `menu.js` never touch `chrome.*`. `logic.js` never touches `window`/`document`. Each extension script is an IIFE, safe to inject twice.
- Names copied from the spec:
  - event type `focus_session` with `{ at, id, projectId, taskId: string | null, startedAt, minutes }`;
  - window events `studium:focus-sessions`, `studium:focus-received`, `studium:ready`, `studium:wake-pet`; `detail` of the first two is a **JSON string**, of `studium:wake-pet` the project id string;
  - attribute `data-pet-away="<nap|sleep>:<ISO until>"`;
  - chrome.storage keys `petAway`, `focusOutbox`, `petCheckIn`, `petTimingOverride` (`{ napMinutes }`);
  - worker messages `{ type: 'nap', projectId }`, `{ type: 'sleep', projectId, hours: 1 | 2 }`, `{ type: 'wake', projectId }`, `{ type: 'checkIn', answer: 'done' | 'notYet' | 'later' }`, `{ type: 'openProject', projectId }`, `{ type: 'delivered', ids }`;
  - alarm name `away:<projectId>`; links `#project=<id>`, `#complete=<taskId>` (ids `encodeURIComponent`-ed).
- Numbers: `NAP_MINUTES = 15`; sleep 1 or 2 hours; away entries more than 2 h ahead are damaged; session minutes clamped to 0–240 by Studium; suggestion bubble ~6 s (`6000` ms).
- Copy (exact): "Nap (15 min)", "What should I work on?", "Sleep", "1 hour", "2 hours", "Open project", "Wake", "Already focusing on <taskTitle or shortName>", "Next up: <title> (~<estimate>)", "Nothing to suggest: everything's done or waiting on something.", "Did you finish <title>?" (Done / Not yet / Later), "Back! How did it go?" (Open project / OK), "Task done!", "First task done!", "Requirement finished!", "Focused <minutes>", "Focused this week: <minutes>", "<shortName> is napping · back in <n> min", "<shortName> is sleeping · back at <h:mm AM>", toolbar "Wake <shortName>".
- Minutes are always shown with `formatMinutes` wording ("45 min", "2 h 30 min").
- Focus sessions never pay tokens and never change progress, mood or neglect.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A session arrives while the completion prompt is already open** (Done opens a new Studium tab; React opens the prompt from the hash before the bridge delivers). The pre-fill should update to the focus minutes until the user touches the picker. Pinned in Task 2 (`updates the pre-fill when focus time arrives, until the user changes it`).
2. **Studium's save fails after receiving sessions.** The sessions must not stay in memory, or the next delivery would look like a duplicate, be confirmed and be deleted unsaved. Pinned in Task 4 (`doesn't answer or keep sessions it couldn't save`, then `records them on the next delivery`).
3. **Wake pressed twice, or Wake racing the alarm.** Only one session and one check-in. Pinned in Task 7 (`ending a pet that isn't away changes nothing`) and the worker's serial queue in Task 8.
4. **Chrome closed for hours during a nap.** On startup the nap ends with its planned length (15), not the hours that passed. Pinned in Task 7 (`endOverdue ends late naps with at most their planned minutes`).
5. **The menu near a window edge or inside the clipped habitat box.** It should stay fully on screen and not be cut off by the habitat clip. Pinned in Task 7 (`menuPosition keeps the menu inside the window`) and Task 11 (no clip while the menu is open) plus the browser check (`the habitat menu is fully visible`).

---

## File Structure

```
web/src/
  planner/types.ts            + focus_session event, FocusSession type
  planner/time.ts             + startOfWeek(now)
  planner/focus.ts            NEW: focusMinutes, taskFocusStart, taskFocusMinutes
  store/storage.ts            + isValidFocusSession (used by isValidData), parseFocusSessions(json)
  store/actions.ts            + recordFocusSessions
  store/petStatus.ts          + suggestion, celebration; extension event names
  store/useStudium.tsx        + receives sessions, answers, studium:ready
  ui/format.ts                + focusedLabel, weekFocusLabel, awayLabel, parsePetAway
  ui/hashLinks.ts             NEW: parseHashLink
  components/CompletionPrompt.tsx, TaskRow.tsx, ProjectDetail.tsx, Habitat.tsx, App.tsx
  extension/petLogic.test.ts  + new logic tests
  extension/menu.test.ts      NEW (jsdom)
  extension/bridge.test.ts    NEW (jsdom, url http://localhost:5173/)
extension/
  manifest.json               + "alarms", new content scripts, version 0.3.0
  background.js               runs applyAwayRequest, alarms, messages, toolbar Wake items
  content/logic.js            + validators, reducer, menu items, wording, celebrations, positions
  content/menu.js             NEW: globalThis.PetMenu
  content/bridge.js           NEW: mailbox + studium:wake-pet (Studium origin only)
  content/pet.js              menu wiring, away pets, quiet mode, check-in, celebrations
README.md, HANDOFF.md, spec status line   Task 12
(scratch, not in repo) ext-check.mjs        Playwright check, Task 11
```

---

### Task 1: Focus sessions in the event log

**Files:**
- Modify: `web/src/planner/types.ts`, `web/src/planner/time.ts`, `web/src/store/storage.ts`, `web/src/store/actions.ts`
- Create: `web/src/planner/focus.ts`
- Test: `web/src/planner/focus.test.ts` (new), `web/src/planner/time.test.ts`, `web/src/store/storage.test.ts`, `web/src/store/actions.test.ts`

**Interfaces:**
- Produces:
  - `StudiumEvent` gains `{ type: "focus_session"; at; id; projectId; taskId: string | null; startedAt; minutes }`; `export type FocusSessionEvent = Extract<StudiumEvent, { type: "focus_session" }>`; `export type FocusSession = Omit<FocusSessionEvent, "type">`.
  - `startOfWeek(now: Date): Date` (time.ts): local Monday 00:00 of `now`'s week.
  - `focusMinutes(events: StudiumEvent[], filter: { projectId?: string; taskId?: string; since?: Date }): number` — sums `minutes` of focus sessions matching every given field; `since` compares the session's `at` (`>=`).
  - `taskFocusStart(task: Task, events: StudiumEvent[]): Date` — later of `task.createdAt` and the task's last `task_reopened`.
  - `taskFocusMinutes(task: Task, events: StudiumEvent[]): number` — `focusMinutes` for the task since `taskFocusStart`.
  - `isValidFocusSession(v: unknown): v is FocusSession` and `parseFocusSessions(json: string): FocusSession[]` (storage.ts).
  - `recordFocusSessions(data: StudiumData, sessions: FocusSession[], now: Date): { data: StudiumData; handled: string[] }` (actions.ts).

- [ ] **Step 1: Write the failing tests**

`time.test.ts` — `startOfWeek starts on Monday`: `startOfWeek(NOW)` (Wed 2026-10-14 noon) equals `new Date(2026, 9, 12)`; `startOfWeek(new Date(2026, 9, 18, 23))` (Sunday) equals `new Date(2026, 9, 12)`; `startOfWeek(new Date(2026, 9, 19, 0, 30))` equals `new Date(2026, 9, 19)`.

`storage.test.ts`:
- `accepts focus sessions and rejects damaged ones`: seed data plus a valid session event is valid; each of `minutes: -1`, `minutes: NaN`, `taskId: 5`, missing `startedAt`, `id: 7` makes `isValidData` false.
- `parseFocusSessions keeps valid sessions only`: `parseFocusSessions("{broken")` and `parseFocusSessions('{"a":1}')` return `[]`; an array of one valid session and one with `minutes: "5"` returns just the valid one.

`focus.test.ts` (node), using a helper `session(o)` that builds a `focus_session` event (defaults `id "s1"`, `projectId "p1"`, `taskId "t1"`, `startedAt daysAgo(0)`, `at NOW ISO`, `minutes 15`):
- `focusMinutes sums by project, task and since`: events `[s(p1,t1,15), s(p1,t2,10), s(p2,null,20,at 8 days ago)]` → `{}` 45, `{ projectId: "p1" }` 25, `{ taskId: "t1" }` 15, `{ since: startOfWeek(NOW) }` 25; other event types are ignored.
- `taskFocusMinutes counts only since the task was created or last reopened`: task created 10 days ago; a 30-min session 5 days ago, a `task_reopened` 2 days ago, a 15-min session 1 day ago → 15. Without the reopen → 45.

`actions.test.ts` — `recordFocusSessions`:
- `records new sessions as events and reports them handled`: one session for seed `webDev` / `webDev-t5` → one appended `focus_session` event with the session's fields and `at`; `handled` is `["<id>"]`; `tokenBalance` unchanged.
- `skips ids already in the log, also within one batch`: recording the same session twice (in one call, and again in a second call) leaves one event; both calls report the id handled; the second returns the same `data` object.
- `drops sessions for deleted projects but still reports them handled`: projectId `"gone"` → no event, id in `handled`.
- `records taskId null when the task no longer exists`.
- `rounds and clamps minutes`: `14.6` → 15, `-3` → 0, `500` → 240.

- [ ] **Step 2: Run them and see them fail**

Run: `npm test -- focus time storage actions` — Expected: FAIL (missing exports).

- [ ] **Step 3: Implement**

- `types.ts`: add the union member and the two types.
- `time.ts`: `startOfWeek`.
- `storage.ts`: `isValidFocusSession` checks `id`, `projectId`, `startedAt`, `at` are strings, `taskId` string or null, `minutes` finite ≥ 0. `isValidData` uses it for `e.type === "focus_session"` (it already requires `at`). `parseFocusSessions` returns `[]` for bad JSON or a non-array.
- `focus.ts`: the three functions above.
- `actions.ts`: `recordFocusSessions` per the spec: ids already in `data.events` (or earlier in the same batch) are handled and skipped; unknown project → handled, dropped; unknown task → `taskId: null`; `minutes = Math.min(240, Math.max(0, Math.round(m)))`; `at` is the session's `at` when `Date.parse` gives a finite time, otherwise `now.toISOString()`. Return the same `data` object when nothing was appended.

- [ ] **Step 4: Run tests and build**

Run: `npm test` then `npm run build` — Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add web/src/planner web/src/store
git commit -m "feat(studium): record focus sessions in the event log"
```

---

### Task 2: Focus time on the screens

**Files:**
- Modify: `web/src/ui/format.ts`, `web/src/components/CompletionPrompt.tsx`, `web/src/components/TaskRow.tsx`, `web/src/components/ProjectDetail.tsx`
- Test: `web/src/ui/format.test.ts`, `web/src/components/CompletionPrompt.test.tsx`, `web/src/components/TaskRow.test.tsx`, `web/src/components/ProjectDetail.test.tsx`

**Interfaces:**
- Consumes: `taskFocusMinutes`, `focusMinutes`, `startOfWeek`, `recordFocusSessions` (Task 1).
- Produces: `focusedLabel(minutes: number): string` → `"Focused 45 min"`; `weekFocusLabel(minutes: number): string` → `"Focused this week: 2 h 30 min"`.

Test data: `withFocus(minutes, taskId = "webDev-t5", at = NOW)` = `recordFocusSessions(buildSeed(NOW), [{ id: "s1", projectId: "webDev", taskId, startedAt: …, at: at.toISOString(), minutes }], NOW).data`.

- [ ] **Step 1: Write the failing tests**

- `format.test.ts`: `focusedLabel(45)` → `"Focused 45 min"`; `weekFocusLabel(150)` → `"Focused this week: 2 h 30 min"`.
- `CompletionPrompt.test.tsx`:
  - `pre-fills the time with the focus minutes on that task`: `withFocus(45)` → the minutes box shows `45`; the text says `You estimated <est> and focused 45 min on it with your pet.`
  - `pre-fills the estimate when there is no focus time` (existing behavior still holds).
  - `updates the pre-fill when focus time arrives, until the user changes it`: render with the seed, then dispatch a `StorageEvent` for `STORAGE_KEY` whose `newValue` is `JSON.stringify(withFocus(20))` (the provider adopts another tab's data, which is also how a late session looks to the prompt) → the box shows `20`. Type `30` into the box, dispatch another with `withFocus(50)` → the box stays `30`.
- `TaskRow.test.tsx`: `shows focus time since the task was last reopened`: `withFocus(45)` → `Focused 45 min` visible; seed alone → no `Focused` text.
- `ProjectDetail.test.tsx`: `shows this week's focus time`: `withFocus(150)` → `Focused this week: 2 h 30 min`; a session dated 9 days ago only → no `Focused this week` text.

- [ ] **Step 2: Run them and see them fail**

Run: `npm test -- format CompletionPrompt TaskRow ProjectDetail` — Expected: FAIL.

- [ ] **Step 3: Implement**

- `format.ts`: the two labels.
- `CompletionPrompt`: `focused = taskFocusMinutes(task, s.data.events)`; `prefill = focused > 0 ? focused : task.estimateMin`. Keep a `touched` flag set by the picker's `onChange`; a `useEffect` on `prefill` calls `setMinutes(prefill)` while `!touched`. Text when `focused > 0`: `You estimated ${formatMinutes(est)} and focused ${formatMinutes(focused)} on it with your pet. A rough answer is fine; it helps Studium learn your pace.` Otherwise unchanged. The answer the user saves is still what's recorded.
- `TaskRow`: append ` · ${focusedLabel(m)}` to the metadata line when `taskFocusMinutes > 0` (done or open).
- `ProjectDetail`: a `<p className="text-xs text-[var(--color-muted-foreground)] mt-1">` with `weekFocusLabel(...)` under the "tasks complete" line, only when the project's minutes since `startOfWeek(s.now)` are > 0.

- [ ] **Step 4: Run tests and build** — `npm test`, `npm run build`: pass.

- [ ] **Step 5: Commit** — `feat(studium): show focus time in the prompt, task rows and project page`

---

### Task 3: Pet statuses carry a suggestion and a celebration

**Files:**
- Modify: `web/src/store/petStatus.ts`
- Test: `web/src/store/petStatus.test.ts`

**Interfaces:**
- Produces: `PetStatus` gains `suggestion: { taskId: string; title: string; estimateMin: number } | null` and `celebration: { at: string; kind: "task" | "firstTask" | "requirement" } | null`. Also exports the event names used by Tasks 4 and 6: `FOCUS_SESSIONS_EVENT = "studium:focus-sessions"`, `FOCUS_RECEIVED_EVENT = "studium:focus-received"`, `STUDIUM_READY_EVENT = "studium:ready"`, `WAKE_PET_EVENT = "studium:wake-pet"`, `PET_AWAY_ATTR = "data-pet-away"`.

- [ ] **Step 1: Write the failing tests** (use `suggest.test.ts`'s fixture shape: tasks a, b, c blocked by a, d done, e unlinked, f in today, g pinned, all in project p1)

- `suggests today's tasks for the project first`: suggestion is `{ taskId: "f", title: "Task", estimateMin: 60 }`.
- `then follows Suggested next`: same data with an empty today → `"g"`.
- `suggests nothing when every task is done, blocked or unlinked`: → `null`.
- `celebrates the latest completion`: two linked tasks a, b in a weight-5 requirement with a third open task c; complete a at NOW → `{ at: NOW ISO, kind: "firstTask" }`; complete b an hour later → `kind: "task"`.
- `re-checks celebrate too`: reopen b and complete it again → `celebration.at` is the newest time, `kind: "task"`.
- `finishing a requirement is the biggest`: completing the requirement's last open task (event `breakdown.finish > 0`) → `kind: "requirement"`, also when it is the project's first completion.
- `no completion, no celebration`: → `null`.

- [ ] **Step 2: Run and see them fail** — `npm test -- petStatus`.

- [ ] **Step 3: Implement**

Compute `suggestNext(data, now, Infinity)` and `todayTaskIds(data, now)` once in `buildPetStatuses`. Per project: first today task that is in the project, open, linked and not `isBlocked`; else the first `suggestNext` entry for the project. Celebration (user's decision, replacing the spec's "paid tokens" rule): the project's last `task_completed` event of any kind. The project is found through the task (`taskId`), or the event's `requirementId` when the task is gone. `kind` is `"requirement"` when `breakdown.finish > 0`; otherwise `"firstTask"` when no earlier `task_completed` event belongs to the project; otherwise `"task"`.

- [ ] **Step 4: Run tests and build** — pass.

- [ ] **Step 5: Commit** — `feat(studium): publish each pet's next task and latest celebration`

---

### Task 4: The provider receives focus sessions

**Files:**
- Modify: `web/src/store/useStudium.tsx`
- Test: `web/src/store/useStudium.test.tsx`

**Interfaces:**
- Consumes: `parseFocusSessions`, `recordFocusSessions` (Task 1); event names (Task 3).
- Produces: window behavior only. On `studium:focus-sessions` with a JSON `detail`, the provider records and saves, then dispatches `studium:focus-received` with `detail = JSON.stringify(handledIds)`. After adding its listener it dispatches `studium:ready` (an `Event`).

Test helper: `send(sessions)` = `window.dispatchEvent(new CustomEvent(FOCUS_SESSIONS_EVENT, { detail: JSON.stringify(sessions) }))` inside `act`; collect `studium:focus-received` details with a listener.

- [ ] **Step 1: Write the failing tests**

- `announces it is ready after mounting`: a `studium:ready` listener added before `renderHook` is called once or more.
- `records sessions, saves and answers with the handled ids`: one session → saved data has the event; one answer `["s1"]`.
- `answers again for sessions it already has`: send twice → one event, two answers.
- `ignores damaged deliveries`: `detail` `"{broken"` and a non-string `detail` → no answer, no change.
- `doesn't answer or keep sessions it couldn't save`: make `storage.setItem` throw, send → no answer, `result.current.data.events` has no focus event, notice `"save-failed"`. Then restore `setItem` and send again → recorded and answered (`records them on the next delivery`).
- `doesn't answer when storage is unavailable`: `storage: null` → no answer.

- [ ] **Step 2: Run and see them fail** — `npm test -- useStudium`.

- [ ] **Step 3: Implement**

A `useEffect` (deps `[env, persistent]`) adds the listener, then dispatches `studium:ready`. The handler ignores non-string `detail`; parses with `parseFocusSessions`; returns without answering if `!persistent`; runs `recordFocusSessions(dataRef.current, sessions, env.clock())`. If the data changed, save first: on failure `setNotice("save-failed")` and return **without** updating `dataRef`/state; on success update `dataRef`, `setData`, `setNow`. Then answer. (Don't reuse `apply`, which keeps changes it couldn't save.)

- [ ] **Step 4: Run tests and build** — pass.

- [ ] **Step 5: Commit** — `feat(studium): receive focus sessions from the extension`

---

### Task 5: Links into Studium

**Files:**
- Create: `web/src/ui/hashLinks.ts`
- Modify: `web/src/App.tsx`
- Test: `web/src/ui/hashLinks.test.ts` (new), `web/src/App.test.tsx`

**Interfaces:**
- Produces: `parseHashLink(hash: string): { kind: "project" | "complete"; id: string } | null` — accepts `#project=<id>` / `#complete=<id>` with a non-empty, `decodeURIComponent`-ed id; anything else (or a decode error) is `null`.

- [ ] **Step 1: Write the failing tests**

- `hashLinks.test.ts`: `"#project=webDev"` → project webDev; `"#complete=a%20b"` → complete `"a b"`; `""`, `"#"`, `"#project="`, `"#other=x"`, `"#complete=%E0"` → `null`.
- `App.test.tsx` (set `window.location.hash` before rendering `StudiumApp` with `renderWithStudium`):
  - `#project=<id> opens that project and clears the hash`: heading `Web Development Portfolio` shown; `location.hash` is `""`.
  - `an unknown project stays on the overview`.
  - `#complete=<taskId> opens the project and its completion prompt`: `webDev-t5` → dialog `About how long did …` open on webDev's page.
  - `#complete for a done or blocked task only opens the project`: no dialog.
  - `an unknown task does nothing`.
  - `follows links that arrive later (hashchange)`: render, then set `location.hash = "#project=appDev"` and dispatch `hashchange` → appDev's page.

- [ ] **Step 2: Run and see them fail** — `npm test -- hashLinks App`.

- [ ] **Step 3: Implement**

In `StudiumApp`, a `useEffect` (empty deps) runs `follow()` once and on `hashchange`. `follow` reads data through a ref updated every render (so the listener is added once), parses `location.hash`, clears it with `history.replaceState(null, "", location.pathname + location.search)` when it was non-empty, then: project → `openProject(id)` if it exists; complete → if the task exists, `openProject(task.projectId)` and, when `!task.done && !isBlocked(task, data.tasks)`, `setCompletingId(task.id)`.

- [ ] **Step 4: Run tests and build** — pass.

- [ ] **Step 5: Commit** — `feat(studium): open projects and completion prompts from #project and #complete links`

---

### Task 6: The habitat while a pet is away

**Files:**
- Modify: `web/src/ui/format.ts`, `web/src/components/Habitat.tsx`
- Test: `web/src/ui/format.test.ts`, `web/src/components/Habitat.test.tsx`

**Interfaces:**
- Consumes: `PET_AWAY_ATTR`, `WAKE_PET_EVENT` (Task 3).
- Produces: `parsePetAway(value: string | null): { kind: "nap" | "sleep"; until: Date } | null` (split at the first `:`; `until` must parse); `awayLabel(away, now: Date): { title: string; detail: string }` with `kind nap` → `{ title: "is napping", detail: "back in N min" }` where `N = max(1, ceil((until - now) / 60000))`, `kind sleep` → `{ title: "is sleeping", detail: "back at " + until.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) }`.

- [ ] **Step 1: Write the failing tests**

- `format.test.ts`: `parsePetAway("nap:2026-10-14T12:12:00.000Z")` → nap with that date; `"nap:nope"`, `"dance:…"`, `null` → `null`. `awayLabel` nap 12 min ahead → `back in 12 min`; 10 s ahead and in the past → `back in 1 min`; sleep → `back at 4:30 PM` for a local 16:30 `until`.
- `Habitat.test.tsx`:
  - `shows that the pet is napping, with a Wake button`: set `data-pet-away` to `nap:<NOW + 12 min>` on the box (inside `act`) → text `webDev is napping` and `back in 12 min`; clicking **Wake** dispatches `studium:wake-pet` with `detail "webDev"`.
  - `shows sleeping with the return time`.
  - `goes back to normal when the attribute is removed`.
  - `shows the still picture with the napping line when no pet is attached`: fake timers, attribute set, no `data-pet-attached`, advance `HABITAT_FALLBACK_MS` → image and line both shown.

- [ ] **Step 2: Run and see them fail** — `npm test -- format Habitat`.

- [ ] **Step 3: Implement**

Extend the existing MutationObserver's `attributeFilter` with `data-pet-away` and keep `away` state from `parsePetAway(box.getAttribute(...))`. While away, render at the top of the box (in place of "It hatched" when both apply) `<strong>{shortName} {title}</strong> · {detail}` and a small **Wake** button (`BUTTON_SMALL`) that dispatches `new CustomEvent(WAKE_PET_EVENT, { detail: project.id })`. The label uses `s.now`.

- [ ] **Step 4: Run tests and build** — pass.

- [ ] **Step 5: Commit** — `feat(studium): show away pets in the habitat with a Wake button`

---

### Task 7: Extension logic for away pets, menus and wording

**Files:**
- Modify: `extension/content/logic.js`
- Test: `web/src/extension/petLogic.test.ts`

**Interfaces** (all on `globalThis.PetLogic`; JS, so shapes are documented in JSDoc):
- Constants: `NAP_MINUTES = 15`, `MAX_AWAY_MS = 7_200_000`, `SUGGESTION_BUBBLE_MS = 6000`, `FOCUS_SESSIONS_EVENT`, `FOCUS_RECEIVED_EVENT`, `READY_EVENT = 'studium:ready'`, `WAKE_PET_EVENT`, `PET_AWAY_ATTR`.
- `parseStatuses`: each pet also gets `suggestion` (`{ taskId, title, estimateMin }`, title/taskId non-empty strings, `estimateMin` finite > 0) and `celebration` (`{ at, kind }`, `at` non-empty string, `kind` one of `task`, `firstTask`, `requirement`) or `null`.
- `statusesEqual(a, b)`: now ignores `suggestion` and `celebration` too (they don't change how a pet looks, so they mustn't rebuild pets).
- `parseAway(raw, now: number)` → `{ [projectId]: { kind, id, startedAt, until, taskId, taskTitle } }`; drops entries with a bad kind, non-string id, unparseable times, `until < startedAt`, or `Date.parse(until) - now > MAX_AWAY_MS`.
- `parseOutbox(raw)` → `{ [id]: FocusSession }`, keeping entries whose key equals `session.id` and that have the Studium session shape (`id`, `projectId`, `startedAt`, `at` strings; `taskId` string|null; `minutes` finite ≥ 0).
- `parseCheckIn(raw)` → `{ projectId, taskId, taskTitle, minutes, at } | null`.
- `napMinutesFrom(override)` → `override.napMinutes` when finite, > 0 and ≤ `NAP_MINUTES`, else `NAP_MINUTES`.
- `parseRequest(msg)` → a valid worker message (Global Constraints list) or `null` (`hours` must be 1 or 2; `ids` an array of strings).
- `applyAwayRequest(state, request, ctx)` → `{ state, effects, changed }` where `state = { petAway, focusOutbox, petCheckIn }`, `request` is a `parseRequest` result or `{ type: 'end', projectId }` (alarm) or `{ type: 'endOverdue' }`, `ctx = { now: number, statuses, napMinutes, newId: () => string }`, effects are `{ type: 'setAlarm', name, when }`, `{ type: 'clearAlarm', name }`, `{ type: 'open', hash }` (hash without `#`, e.g. `complete=t1`). Never mutates its input.
- `studiumUrl(hash = '')` → `HOMEPAGE_URL` plus `#hash` when given.
- `petMenuItems(projectId, petAway, statuses)` → `[{ id, label, disabled?, hint?, children? }]`.
- `wakeMenuEntries(petAway, statuses)` → `[{ id: 'wake:<projectId>', title: 'Wake <shortName>' }]`.
- `formatMinutes(m)` (same wording as Studium), `suggestionText(suggestion)`, `checkInPrompt(checkIn)` → `{ text, buttons: [{ answer, label }] }`, `celebrationText(kind)`, `celebrationHops(kind)` (1 for `task`, 2 otherwise).
- `newCelebrations(seen, statuses)` → `{ seen, celebrate: [{ projectId, kind }] }`; `seen` is `null` before the first statuses.
- `awayAttribute(entry)` → `'<kind>:<until>'`; `isQuiet(petAway)` → any nap.
- `menuPosition(point, size, viewport, margin = 8)` → `{ left, top }`.

- [ ] **Step 1: Write the failing tests** (`ctx = { now: T, statuses: parseStatuses({ pets: [pet(), pet({ projectId: 'appDev', shortName: 'appDev', petKind: 'dog', suggestion: { taskId: 't1', title: 'Push', estimateMin: 30 } })] }), napMinutes: 15, newId: () => 'n1' }`, `T = Date.parse('2026-10-19T12:00:00Z')`, `empty = { petAway: {}, focusOutbox: {}, petCheckIn: null }`)

`parseStatuses`:
- `reads suggestion and celebration`; `treats missing or damaged ones as null` (old statuses still load: `pet()` has neither → both `null`; `suggestion: { title: 5 }` → `null`).
- `statusesEqual ignores suggestion and celebration`.

Validators:
- `parseAway drops damaged entries and ones more than 2 hours ahead`: a good nap kept; `kind: 'coma'`, `until: 'x'`, `until` = T + 2 h + 1 s dropped; `until` = T + 2 h kept; non-object raw → `{}`.
- `parseOutbox keeps valid sessions keyed by their id`; `parseCheckIn` returns `null` for damaged input.
- `napMinutesFrom`: `{ napMinutes: 0.5 }` → 0.5; `{ napMinutes: 0 }`, `{ napMinutes: 99 }`, `undefined` → 15.
- `parseRequest`: each valid message passes; `{ type: 'sleep', hours: 3 }`, `{ type: 'nap' }`, `{ type: 'delivered', ids: [1] }`, `null` → `null`.

`applyAwayRequest`:
- `nap stores the pet's suggested task and sets an alarm`: appDev nap → `petAway.appDev = { kind: 'nap', id: 'n1', startedAt: ISO(T), until: ISO(T + 15 min), taskId: 't1', taskTitle: 'Push' }`; effects `[{ type: 'setAlarm', name: 'away:appDev', when: T + 15 min }]`.
- `nap is refused while another pet naps, and for an unknown pet`: `changed: false`, no effects.
- `sleep lasts 1 or 2 hours with no task`: until T + 2 h, `taskId: null`; allowed while another pet naps.
- `waking a nap records a session and asks for a check-in`: start at T, wake at T + 9 min 50 s → outbox `n1` with `minutes: 9`, `at: ISO(now)`, check-in `{ projectId: 'appDev', taskId: 't1', taskTitle: 'Push', minutes: 9 }`; effect `clearAlarm away:appDev`.
- `waking a sleeping pet records nothing`.
- `ending a pet that isn't away changes nothing` (`changed: false`) — wake twice after one nap leaves one session.
- `endOverdue ends late naps with at most their planned minutes`: nap at T, `endOverdue` at T + 5 h → session `minutes: 15`; a sleep not yet due is kept and gets a `setAlarm` effect (re-arms alarms after a restart).
- `check-in answers`: `later` clears it; `done` clears it and opens `complete=t1`; `done` without a task opens `project=appDev`; `notYet` clears it and starts a new nap on `t1` (title `Push`, even if the suggestion has changed); with no check-in → `changed: false`.
- `delivered removes those sessions from the outbox` (unknown ids ignored).
- `doesn't change the state it was given` (deep-equal snapshot before/after).

Menus and wording:
- `petMenuItems for a pet at home`: labels `['What should I work on?', 'Nap (15 min)', 'Sleep', 'Open project']`; Sleep's children `['1 hour', '2 hours']` with ids `sleep1`, `sleep2`.
- `Nap is disabled while another pet naps`: hint `Already focusing on Push` (that nap's task title), or `Already focusing on webDev` (its shortName) when it has no task.
- `an away pet offers only Wake and Open project`.
- `wakeMenuEntries` → `[{ id: 'wake:appDev', title: 'Wake appDev' }]`.
- `suggestionText`: `Next up: Push (~30 min)`; 90 min → `(~1 h 30 min)`; `null` → `Nothing to suggest: everything's done or waiting on something.`
- `checkInPrompt` with and without a task (exact copy and answers from Global Constraints; without a task the buttons are Open project → `done`, OK → `later`).
- `celebrationText`: `requirement` → `Requirement finished!`, `firstTask` → `First task done!`, `task` → `Task done!`; unknown → `Task done!`. `celebrationHops`: 1, 2, 2.
- `newCelebrations`: first call (`seen: null`) celebrates nothing and remembers every `at`; a later status with a newer `at` celebrates that pet once; the same `at` again celebrates nothing; a project not seen before with a celebration celebrates.
- `menuPosition keeps the menu inside the window`: point (790, 590), size 180×160, viewport 800×600 → `{ left: 612, top: 430 }`; point (5, 5) → `{ left: 8, top: 8 }`; a normal point is unchanged.
- `awayAttribute`, `isQuiet`, `studiumUrl('project=a b')` is unencoded on purpose (callers encode) — assert `studiumUrl()` is `HOMEPAGE_URL` and `studiumUrl('project=x')` is `HOMEPAGE_URL + '#project=x'`.

- [ ] **Step 2: Run and see them fail** — `npm test -- petLogic`.

- [ ] **Step 3: Implement** the functions above in `logic.js`. Notes the tests don't pin:
  - Hashes built by the reducer use `encodeURIComponent` on ids.
  - Session minutes are `floor((now - startedAt) / 60000)`, clamped to `[0, floor((until - startedAt) / 60000)]`, so the cap is the nap's own planned length.
  - A new nap clears a pending check-in only when it's for the same project.

- [ ] **Step 4: Run tests and build** — pass.

- [ ] **Step 5: Commit** — `feat(extension): pure logic for naps, sleep, check-ins, menus and celebrations`

---

### Task 8: The service worker runs the timing

**Files:**
- Modify: `extension/background.js`, `extension/manifest.json`

**Interfaces:**
- Consumes: `parseAway`, `parseOutbox`, `parseCheckIn`, `parseStatuses`, `napMinutesFrom`, `parseRequest`, `applyAwayRequest`, `studiumUrl`, `wakeMenuEntries` (Task 7).
- Produces: storage writes of `petAway`, `focusOutbox`, `petCheckIn`; alarms `away:<projectId>`; toolbar menu items `toggle-pet` and `wake:<projectId>`.

No unit tests (chrome APIs); verified by the browser check in Task 11.

- [ ] **Step 1: Implement**

- `manifest.json`: add `"alarms"`; `content_scripts.js` becomes `["content/logic.js", "content/menu.js", "content/bridge.js", "content/pet.js"]`; version `0.3.0`. The install-time `executeScript` in `background.js` injects the same list (one shared `CONTENT_SCRIPTS` constant).
- `openStudium(hash = '')`: today's toolbar-click code, generalized. Existing tab → `tabs.update(id, { url: studiumUrl(hash), active: true })` when a hash is given (a hash-only change fires `hashchange`, no reload), focus its window; else `tabs.create`.
- `update(request)`: chained on one promise queue so requests never interleave. Loads `petAway`, `focusOutbox`, `petCheckIn`, `petStatuses`, `petTimingOverride`; parses them (`parseAway(raw, Date.now())`); calls `applyAwayRequest` with `newId: () => crypto.randomUUID()`; writes the three keys in one `storage.local.set` when `changed`; runs effects (`chrome.alarms.create(name, { when })`, `chrome.alarms.clear(name)`, `openStudium(hash)`). Errors are logged, and the queue keeps going.
- `chrome.runtime.onMessage`: `parseRequest(msg)`; `openProject` → `openStudium('project=' + encodeURIComponent(id))`; everything else → `update(request)`. Invalid messages are ignored.
- `chrome.alarms.onAlarm`: `away:<id>` → `update({ type: 'end', projectId: id })`.
- On every worker start (top level), and in `onStartup`: `update({ type: 'endOverdue' })`.
- Toolbar menu: `setUpMenu()` becomes `rebuildMenu()`, serialized on its own queue (two overlapping `removeAll` + `create` runs caused the duplicate-id bug fixed in `0b64b30`). It creates `toggle-pet` plus `wakeMenuEntries(...)` (contexts `['action']`). Run it on install and whenever `petAway` or `petStatuses` change. `contextMenus.onClicked` calls a top-level `handleMenuClick(info)`, which handles `toggle-pet` as today and `wake:<id>` with `update({ type: 'wake', projectId })`. For the browser check, `rebuildMenu` keeps the ids it created in `globalThis.menuIds`.

- [ ] **Step 2: Check syntax and tests**

Run: `node --check ../extension/background.js` then `npm test` and `npm run build`. Expected: no errors; all pass.

- [ ] **Step 3: Commit** — `feat(extension): worker keeps nap and sleep timers, the outbox and check-ins`

---

### Task 9: The pet menu's DOM

**Files:**
- Create: `extension/content/menu.js`
- Test: `web/src/extension/menu.test.ts` (jsdom)

**Interfaces:**
- Consumes: `PetLogic.menuPosition` (Task 7).
- Produces: `globalThis.PetMenu = { STYLE, open(root, point, items, onPick), close(), isOpen() }`. `root` is a ShadowRoot or element; `point` is `{ x, y }` in client pixels; `items` come from `petMenuItems`; `onPick(id)` is called with a leaf item's id, then the menu closes. Opening again replaces the open menu.

- [ ] **Step 1: Write the failing tests** (attach a shadow root to a div; `import '../../../extension/content/logic.js'` and `menu.js`)

- `renders the items as a menu`: `role="menu"` with `menuitem` buttons in order; the first item has focus.
- `a disabled item shows its hint and can't be picked`: `aria-disabled="true"`, hint text visible; clicking doesn't call `onPick`.
- `Sleep opens its choices`: clicking Sleep sets `aria-expanded="true"` and shows `1 hour` / `2 hours`; clicking `2 hours` calls `onPick('sleep2')` and closes.
- `picking an item calls back and closes`: `isOpen()` false afterwards, menu element gone.
- `closes on Escape, on a click outside and on scroll`: three cases (`keydown` Escape on `document`; `pointerdown` on `document.body`; `scroll` on `window`); a `pointerdown` inside the menu keeps it open.

- [ ] **Step 2: Run and see them fail** — `npm test -- menu`.

- [ ] **Step 3: Implement**

Plain DOM. `.pet-menu` is `position: fixed; pointer-events: auto`, white, rounded, shadow, `font: 13px system-ui`, and positioned after measuring with `menuPosition(point, rect size, { width: innerWidth, height: innerHeight })`. Hints render as a `<span class="hint">` under the label. Document and window listeners are added on open with an `AbortController` and removed on close. Outside clicks are detected with `e.composedPath().includes(menuEl)`. `STYLE` is a CSS string that `pet.js` adds to its shadow root.

- [ ] **Step 4: Run tests and build** — pass.

- [ ] **Step 5: Commit** — `feat(extension): pet right-click menu`

---

### Task 10: The Studium bridge (mailbox and Wake)

**Files:**
- Create: `extension/content/bridge.js`
- Test: `web/src/extension/bridge.test.ts` — first lines `// @vitest-environment jsdom` and `// @vitest-environment-options {"url": "http://localhost:5173/"}`

**Interfaces:**
- Consumes: `isStudiumUrl`, `parseOutbox`, event names (Task 7).
- Produces: on the Studium origin, dispatches `studium:focus-sessions` (JSON string of the outbox's sessions) on load, on `focusOutbox` changes and on `studium:ready`; forwards `studium:focus-received` as `{ type: 'delivered', ids }` and `studium:wake-pet` as `{ type: 'wake', projectId }` through `chrome.runtime.sendMessage`.

Fake `chrome`: `{ runtime: { id: 'x', sendMessage: vi.fn(() => Promise.resolve()) }, storage: { local: { get: async () => ({ focusOutbox }) }, onChanged: { addListener: (fn) => (listener = fn) } } }`. Import the script with a cache-busting query (`await import('../../../extension/content/bridge.js?' + n)`) so each test gets a fresh copy.

- [ ] **Step 1: Write the failing tests**

- `sends the outbox to the page when it loads`: one `studium:focus-sessions` whose `detail` parses to the one valid session (a damaged entry is left out).
- `sends nothing when the outbox is empty`.
- `sends again when the page is ready and when the outbox changes`.
- `confirms what the page saved`: dispatch `studium:focus-received` with `detail '["s1"]'` → `sendMessage({ type: 'delivered', ids: ['s1'] })`; a damaged detail sends nothing.
- `forwards Wake from the habitat`: `studium:wake-pet` with `detail 'webDev'` → `sendMessage({ type: 'wake', projectId: 'webDev' })`.
- `a newer copy replaces the old one`: import twice, dispatch `studium:ready` → exactly one new `studium:focus-sessions`.
- `stops quietly without the extension's APIs` (`chrome = { runtime: {} }`) → no errors, no events.

- [ ] **Step 2: Run and see them fail** — `npm test -- bridge`.

- [ ] **Step 3: Implement**

IIFE: return unless top window, chrome APIs present (same guard as `pet.js`) and `isStudiumUrl(location.href)`. `globalThis.CapstoneBridge?.abort()`, then a new `AbortController` stored there; every `window` listener gets its `signal`; the `storage.onChanged` listener returns early once `signal.aborted` or `!chrome.runtime?.id`. `sendMessage(...).catch(() => {})`.

- [ ] **Step 4: Run tests and build** — pass.

- [ ] **Step 5: Commit** — `feat(extension): deliver focus sessions to Studium and forward Wake`

---

### Task 11: Pets use the menu, nap, sleep, check in and celebrate

**Files:**
- Modify: `extension/content/pet.js`
- Test: `web/src/extension/petScript.test.ts` (existing test must still pass); scratch Playwright `ext-check.mjs`

**Interfaces:**
- Consumes: everything from Tasks 7–10.
- Produces: user-visible behavior only.

- [ ] **Step 1: Implement**

State and loading:
- `load()` also reads `petAway` and `petCheckIn`. `away = L.parseAway(raw, Date.now())`, `checkIn = L.parseCheckIn(raw)`. `storage.onChanged` handles both keys and then calls `applyHabitat()` / `showCheckIn()`.
- `statuses` always holds the latest parsed statuses. Rebuild only when `!statusesEqual` (Task 7 makes that ignore suggestion and celebration). The menu reads the suggestion from `statuses`, not from the pet's build-time status.
- Add `PetMenu.STYLE` to the shadow root's `<style>`.

Pet additions (`createPet(status, index, count, env)`, `env = { quiet: () => boolean, onMenu: (pet, point) => void }`):
- A `contextmenu` listener: `preventDefault()`, `stopPropagation()`, `env.onMenu(api, { x: e.clientX, y: e.clientY })`. Pointer handlers return early while away.
- Ambient speech goes through `chatter(text, ms)`, which returns early when `env.quiet()`: timed sounds, the cat's "Zzzzz", "Haven't seen…", and the click sound. Hops still happen. Menu, check-in and celebration bubbles use `say` directly.
- `setAway(value)`: on → mode `'away'` (no physics, no timers), on the floor, class `sleeping`, bubble `Zzz` kept showing; off → `wake()`, `goIdle`.
- `talk(text, buttons, onAnswer)` / `clearTalk()`: a `.talk` element above the pet (pointer-events auto, wraps up to ~220 px, small buttons). It stays until cleared.
- `celebrate(kind)`: hop `celebrationHops(kind)` times (each next hop when the previous one lands; the big ones hop higher, `hopSpeed × 1.3`) and `say(celebrationText(kind), 2500)`.

Page wiring:
- `applyHabitat()`: a pet is shown when it is not away and (`!habitatEl` or it's the box's pet), or when it's the away pet of the current box (drawn with `setAway(true)`). Keep `data-pet-away` on the box from `awayAttribute(away[id])` (removed when not away), even while pets are hidden.
- `onMenu`: `PetMenu.open(root, point, L.petMenuItems(pet.id, away, statuses), pick)`. `pick`: `suggest` → `say(suggestionText(status.suggestion), SUGGESTION_BUBBLE_MS)`; `nap`, `sleep1`/`sleep2`, `open`, `wake` → `chrome.runtime.sendMessage({ type: 'nap' | 'sleep' | 'openProject' | 'wake', projectId, hours? }).catch(() => {})`.
- `rebuild()` calls `PetMenu.close()` first and `showCheckIn()` after.
- `showCheckIn()`: `clearTalk()` on every pet. If `checkIn` is set, `talk(...)` on its project's pet, or on the first shown pet if that one isn't shown. Answers send `{ type: 'checkIn', answer }`.
- Celebrations: `seen = null` per tab. After every status load or change, `newCelebrations(seen, statuses)`; celebrate each listed pet that is shown and not away.
- Loop: no habitat clip while `PetMenu.isOpen()`; headroom 90 px while the habitat pet has a talk bubble (40 otherwise).
- All new listeners check `stale()`.

- [ ] **Step 2: Unit tests and build**

Run: `npm test`, `npm run build`, `node --check ../extension/content/pet.js`. Expected: pass (including `petScript.test.ts`).

- [ ] **Step 3: Browser check with the real extension**

Write `ext-check.mjs` in the scratchpad (Plan 3's setup: `launchPersistentContext` with the extension, service worker via `ctx.serviceWorkers()`, Studium on port 5173 — reuse a running `npm run dev`). Shorten naps with `petTimingOverride: { napMinutes: 0.5 }`, and back-date `petAway.<id>.startedAt` through `sw.evaluate` where a check needs whole minutes. Checks (each prints PASS/FAIL):
1. `right-click opens the pet menu` (4 items) on example.com; Escape closes it.
2. `nap: the pet leaves and the others go quiet`: the pet is gone on example.com; for 20 s no other pet shows a bubble.
3. `Nap is disabled on the other pets` with the hint.
4. `wake early from the toolbar menu`: Playwright can't open the toolbar menu, so Task 8's `globalThis.menuIds` must contain `wake:<id>`, and `sw.evaluate(() => handleMenuClick({ menuItemId: 'wake:<id>' }))` must record a session.
5. `the session reaches Studium`: `focusOutbox` empties, and the task row shows `Focused N min`.
6. `Done opens the pre-filled prompt` at `#complete=…`.
7. `sleep 1 h: gone on normal pages, asleep in the habitat, Wake brings it back` (the line `is sleeping · back at`, and the Wake button).
8. `the habitat menu is fully visible`: on a project page, the menu's rect is inside the window and isn't clipped (the host's computed `clip-path` is `none` while it's open).
9. `completing a task in Studium makes the pet hop in another tab` ("Task done!", or "First task done!" / "Requirement finished!" with two hops).
10. `Open project focuses Studium on the right project`.
11. `the mailbox survives Studium being closed`: close Studium, end a nap, reopen it → the session is recorded.
12. `the nap alarm ends the nap on its own` (30 s override).

Expected: all PASS. Fix anything that fails before committing.

- [ ] **Step 4: Commit** — `feat(extension): pets nap, sleep, suggest work, check in and celebrate`

---

### Task 12: Docs and final check

**Files:** `README.md`, `HANDOFF.md`, `docs/superpowers/specs/2026-10-19-pet-interactions-design.md`

- [ ] **Step 1:** README: the pet menu, naps as focus time, sleep, the new `alarms` permission. HANDOFF: status row for this plan, code map entries for `focus.ts`, `hashLinks.ts`, `menu.js`, `bridge.js`, the reducer, new decisions (statusesEqual ignores suggestion/celebration; failed saves aren't kept in memory; the pre-fill follows late sessions), and the next round (work limiters). Spec: update the celebration section to the user's rule (every completion; first task and finished requirement bigger; `{ at, kind }`), and set the status line to "Approved; implemented by `docs/superpowers/plans/2026-10-19-pet-interactions.md`."
- [ ] **Step 2:** `npm test` and `npm run build` — all pass.
- [ ] **Step 3: Commit** — `docs: pet interactions and focus sessions`

---

## Coverage map (spec → task)

| Spec | Task |
|---|---|
| `focus_session` event, validation, `recordFocusSessions` | 1 |
| `focusMinutes`, pre-filled prompt, task row, project page | 1, 2 |
| `suggestion`, `celebration` in `PetStatus`; `parseStatuses` | 3, 7 |
| `#project` / `#complete` links | 5 |
| Habitat away line, Wake event, still picture | 6 |
| Receiving sessions, `studium:ready`, silence on failed save | 4 |
| `petAway` / `focusOutbox` / `petCheckIn` validators, 2 h cap | 7 |
| Worker as only writer, messages, alarms, startup, `alarms` permission, `petTimingOverride` | 7, 8 |
| Pet menu, disabled Nap, Sleep submenu, closing rules, habitat menu, away-pet menu | 7, 9, 11 |
| Hidden away pets, asleep in habitat, `data-pet-away`, toolbar Wake items, quiet mode | 7, 8, 11 |
| Check-in (with / without task, every tab, until answered) | 7, 8, 11 |
| What should I work on?, Open project, celebrations | 7, 8, 11 |
| Mailbox delivery | 4, 10 |
| Browser check | 11 |

**Changed from the spec (user's decision, 2026-10-19):** every completion celebrates, re-checks and 0-token completions included. The project's first completed task and finishing a requirement celebrate bigger (two higher hops, "First task done!" / "Requirement finished!"). `celebration` is `{ at, kind }` instead of `{ at, finishedRequirement }`. Task 12 updates the spec to match.

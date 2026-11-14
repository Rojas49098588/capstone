# Bugs

Tracked issues for the Capstone repo (Studium web app, desktop app and browser extension).

> **Reminder:** Every open bug has an `Opened` date. Anything open **more than 3 days** is overdue. Fix it, or write down why it's waiting. When a bug is fixed, move it to **Fixed** with the date and commit.

## Open

### Desktop: pets and sticky notes stop responding to clicks

_Opened 2026-11-05. Waiting for the next time it happens (can't reproduce yet)._

**What happens:** in the Windows desktop app, every pet and sticky note on the overlay stops responding to clicks, sometimes. It lasts until the app restarts. The cause hasn't been found.

**Workaround (no reinstall needed):** click the **^** arrow near the clock, right-click the Studium icon, and choose **Quit Studium**. Or right-click Studium's taskbar button and choose **Quit Studium** (installed version only). Then reopen Studium from the Start menu.

**How clicks reach the pets:** the overlay (`desktop/src/main/overlayWindow.js`) is a see-through, always-on-top window over the work area. It lets clicks through to the apps underneath, but Windows still forwards mouse moves to it. `desktop/src/overlay/mouse.js` checks whether the pointer is over a pet, note, bubble or menu. If it is, it sends `overlay:mouse` true, and `main.js` calls `setIgnoreMouseEvents(false)` so the window catches clicks. The page only sends when its answer changes, and re-checks every 250 ms. The likely failure is that this on/off switch gets stuck.

**Ruled out (2026-11-05):** each was tested on the dev machine with a throwaway Playwright spec that moved the real cursor. The click handling recovered every time:

- The main process freezing for 3 s while the mouse moves (Windows can drop a stalled app's mouse hook). Forwarded moves kept arriving.
- The GPU process being killed, which can happen after sleep or a driver hiccup.
- The overlay page crashing and auto-reloading. Forwarded moves still arrived, and the app still accepted the page's `overlay:mouse` requests (the `senderFrame` URL check passed).
- The overlay being resized, hidden and shown, minimized and restored, or having always-on-top toggled off and on. The window's `WS_EX_TRANSPARENT` flag stayed in sync with what the page asked for.

**Side finding (not the cause):** `extension/content/pet.js` has no `pointercancel` or `lostpointercapture` handler, so a lost `pointerup` leaves that pet's `press` set. This affects one pet briefly, not every pet and note until a restart.

**Next time it happens, answer these:**

1. Are the pets still moving?
2. When you click a pet, does the click land on whatever is behind it (a desktop icon gets selected, for example), or does nothing happen?
3. Does the pointer turn into a grab hand over a pet?
4. Did it start right after sleep, locking the screen, plugging in or unplugging a monitor, or a full-screen app or game?
5. Does tray → **Hide pets** then **Show pets** fix it?
6. Roughly how long had the app been running, and what were you doing just before?

**Answers:**

2026-11-05, while it was happening (the app process started at 2:48 PM; the answers came in around 10:50 PM):

1. Yes, the pets keep moving, but picking one up doesn't work.
2. Nothing happens. The click doesn't reach whatever is behind the pet either.
3. Yes, the grab hand shows over a pet.
4. Possibly right after waking the laptop from sleep. Not sure it happens every time.
5. No, Hide pets then Show pets doesn't fix it. The same pet works fine in the Studium window's habitat page.
6. Not sure. It seems to have started after waking from sleep.

**What the answers tell us:**

- The grab hand means the overlay window *is* receiving mouse moves and has switched to catching clicks. CSS cursors only apply when the window gets the mouse.
- Clicks not passing through matches that: the window takes the click but it never turns into a `pointerdown` on the pet.
- The pet code itself is fine, because the habitat (same `pet.js`, Studium window) works.
- Hide and show rebuilds the pets but doesn't fix it, so the stuck state is at the window or input level, not in a pet.
- Leading theory: after sleep, the overlay's Chromium input state is stuck (for example, it thinks a mouse button is still held, so a new press never fires `pointerdown` or `click`). Not confirmed.

**Live inspection (2026-11-05, while stuck):** only the taskbar sits above the overlay in z-order, so no hidden window is covering it. The overlay has no mouse capture. Its extended style with the pointer elsewhere was `0x08280028` (click-through, as expected).

**Live inspection (2026-11-09, same stuck process, running since 2026-11-05 2:48 PM):** a debugger was attached to the running app's main process (`process._debugProcess`), and a temporary event logger was added to the overlay page.

- **Windows side works.** Sampling `WindowFromPoint`, `GetGUIThreadInfo` and the overlay's extended style every 50 ms showed the switch flipping correctly. Over a pet the overlay is `0x08200008` (catching clicks) and is the window under the cursor. Off a pet it goes back to `0x08280028`. No window holds mouse capture. The left button presses were seen while the overlay was under the cursor.
- **The page never gets a press.** While the user clicked and tried to drag the pet, the page logged 1,050 `pointermove` events (all with `buttons: 0`) and three `pointerup`/`mouseup`, but **zero `pointerdown`, `mousedown` or `click`**. Without a `pointerdown`, `pet.js` never starts a click or drag.
- **The page and Chromium's internal input path are fine.** A click sent with `webContents.sendInputEvent` and one sent with DevTools `Input.dispatchMouseEvent` both produced the full `pointerdown` → `mousedown` → `pointerup` → `mouseup` → `click` sequence.
- **A fresh window in the same stuck process works.** A new 300×300 window with the overlay's options (transparent, non-focusable, always on top) got all 6 of the user's clicks.

- **Hiding and re-showing the stuck window doesn't help.** After `hide()` then `showInactive()` on the overlay, the user's clicks still reached the page only as `pointerup`/`mouseup`, never a press.

**Conclusion:** the overlay window's native mouse handling (Chromium's Windows message to input step for that one HWND) gets stuck dropping button-down messages while still passing moves. It's per-window and persists until the window is replaced. This is Electron/Chromium state, not app code. Probable trigger: sleep/wake (unconfirmed). Fix direction: replace the overlay window when this happens (for example on `powerMonitor` `resume`/`unlock-screen`), and add a tray **Reload pets** that recreates it.

**Fix (2026-11-09, `2c31743` on branch `fix/overlay-clicks`, not yet in an installer):** the app now builds a fresh overlay window and closes the old one:

- automatically, 2 seconds after the computer wakes or the screen unlocks (`powerMonitor` `resume`/`unlock-screen`, merged into one rebuild by `createRebuildTimer` in `desktop/src/main/overlayWindow.js`);
- on demand, from a new tray item, **Reload pets**.

Tests: unit tests for the tray item and the rebuild timer, and an e2e test showing that Reload pets and a simulated wake each leave exactly one new overlay that takes clicks on a pet. The stuck state itself can't be reproduced in a test, so this stays open until it's confirmed on the laptop: after a sleep and wake, pets should take clicks. If they ever stop again without a sleep, use **Reload pets** and note what happened here.

## Fixed

### Accounts: linking showed "Couldn't reach Studium's servers"

_Opened 2026-11-10. Fixed 2026-11-10 in 350c767 (PR #23)._

Right after linking, the app started listening to a new project's tasks before the server had saved the project, so the security rules refused it and the app showed a connection error. Its data still uploaded. It now waits for the server to confirm the project first.

# Studium roadmap

What's planned, in order. Each big item gets its own design (`docs/superpowers/specs/`) before any code.

## Before the final due date (December 3, 2026)

_Updated 2026-11-17. The demo is **30 minutes, desktop app only**. New features are done; the time left goes to making it presentation-ready. People in the room scan a QR code (`docs/demo/download-qr.png`) that opens <https://github.com/Rojas49098588/capstone/releases/latest>, so they can download it later._

**Focus: finish these**

1. **Shop: done 11/17** (branch `feature/shop-toys-window`). 6 new foods with flavors, a favorite flavor for each kind of pet, and cheap bland starters. Clothes are removed, and their buyers get their tokens back. Design: `docs/superpowers/specs/2026-11-17-shop-toys-window-design.md`.
2. **Toys and habitat:** the Window is **done 11/17**; the toys wait for the click-bug investigation (item 6). The Focus Ball (throw and fetch) and the Robo Mouse (the pet plays by itself) on the desktop pets. A Window decor item that follows the computer's clock and dims the room at night. Placeholder art for everything new. Same design.
3. **Assets:** the placeholder decor art (`web/public/decor/*.svg`), and anything else still a placeholder (to list).
4. **Sounds:** replace the generated stand-in pet sounds (`desktop/scripts/makeSounds.js` → `extension/assets/sounds/*.wav`) with copyright-free recordings.

**Still needed for the demo**

5. **The final installer must be published as the latest release** (not a pre-release). The QR code opens `/releases/latest`, which today still points to 0.10.0. Bump the version before building.
6. **Overdue bug:** "Desktop: pets and sticky notes stop responding to clicks" (`bugs.md`, opened 11/05). It can't be reproduced yet. Worth a look, since it would show in a live demo.
7. **A demo account with good example data,** and a 30-minute script.

**Done:** signed Mac installer (0.11.0, PR #24); Linux `.deb` (PR #25); accounts and sync (PR #23); pending tasks and due dates (0.12.0 draft); the companion phone app (PRs #26 to #28, working on the owner's iPhone). The phone app is **not in the demo**; its remaining work moves to "After December 3".

## Schedule to December 3

| When | What |
|---|---|
| **Tue 11/17** | Go through the 0.11.0 tester reports and fix anything blocking. Write down exactly what "finished" means for the shop and the habitat. Merge PR #29. |
| **Wed 11/18 – Sun 11/22** | **Shop and habitat logic.** |
| **Mon 11/23 – Wed 11/25** | **Assets and sounds:** final decor art and copyright-free sounds. |
| **Thu 11/26 – Sun 11/29** | Thanksgiving: buffer. Click bug. Desktop polish that shows in the demo. |
| **Mon 11/30** | **Final installer** (bump the version), published as the **latest release**. Scan the QR code with a phone to check it opens that release. Code freeze. |
| **Tue 12/1** | Set up the demo account and example data. Write the 30-minute script, including what to show first if time runs short. Print the QR code or put it on a slide. |
| **Wed 12/2** | Rehearse twice with a timer, on the computer used for the demo. |
| **Thu 12/3** | Final demo. |

## Small follow-ups (from the companion app reviews, 2026-11-15)

Found in the whole-branch reviews of the companion app work; none blocks the demo. The phone items wait until after December 3. Tick them off here as they're done.

**Phone app (`mobile/`)**
- [x] Quick add failed on phones ("crypto doesn't exist"): fixed in PR #28.
- [x] Pull to refresh gave no visible feedback: spinner and "Up to date", PR #28.
- [ ] The sign-in screen flashes on a cold start before Firebase restores the session: keep the splash screen up until the first sign-in check.
- [ ] "Your account's data changed on another device…" and Today's "Added to…" note never go away until sign-out: clear them on the next successful sync or on tap.
- [ ] A pending task ticked off that isn't on today's plan disappears, so it can't be unticked on the phone.
- [ ] Accessibility: the task checkbox has no check mark and a small target; a pet card's screen-reader label skips its "looks after" and meal lines; mood chip text contrast isn't checked.
- [ ] Offline "Also add to today" can undo plan or settings changes made on the desktop meanwhile (sync merges whole records; today's plan shares the settings record). Real fix: give today's plan its own record.
- [ ] The 30-second reconnect timer can't be cleared except by signing out (Jest warns a worker didn't exit).
- [ ] `mobile/metro.config.js`: the `startsWith(webRoot)` check also matches a folder like `web-foo` and is case-sensitive on Windows.
- [ ] `mobile/src/phoneStudium.test.ts` repeats helpers that live in `src/testing/phoneFixture.ts`.
- [ ] Replace Expo's placeholder app icon with a Studium icon.

**Desktop and web (pending tasks and due dates)**
- [ ] Ticking off a pending task on the desktop says "You estimated 0 min" and shows the unlinked-task message.
- [ ] Every task-form save records an empty due date in the task's history, even when nothing changed.
- [ ] The due-date hint says "requirement's due date" even when Unlinked is chosen (the limit is then the project deadline).
- [ ] Pending section: heading level, and keyboard focus after Add details, Save or Delete.
- [ ] "Save details" closes without a message if the save is refused (e.g. the requirement was deleted meanwhile).
- [ ] Import order in `web/src/components/RequirementCard.tsx`.

**Food and the window (from the 2026-11-17 review)**
- [ ] The refund notice says "Clothes" even when only the Puzzle Cube was refunded.
- [ ] Feeding a weaker meal (Plain Rice) while a stronger boost runs uses up the pet's meal for nothing, with no warning.
- [ ] The phone's meal suggestion always names Power Bento (× 1.1 for 4 hours).
- [ ] The snack-rule test checks a fixed 2.5 h instead of the shortest wait in the food catalog.
- [ ] A browser habitat without the extension shows no ♥ for a favorite food (the desktop is fine).

## After December 3

Each of these builds on accounts.

- **Payments and paid currency.** Real-money purchases tied to the account and restorable on any device. Includes the **link bonus**: paid currency for everyone who linked an account, including people who linked before the currency existed. Needs the Firebase Blaze plan, for the server code that confirms payments.
- **Collab mode.** Share a project and its pet with someone else and work on it together. Open questions: inviting, who can edit, and how the pet's mood works with two people.
- **Pet personalities and hidden favorite foods.** Each pet gets its own likes and dislikes, so two pets of the same kind can want different foods. The favorite is then **hidden**: the habitat's "Loves … food" line and the "♥ Favorite" marks go away, and people find a pet's favorite by trying foods and watching for the ♥. For now (Dec 3 demo), every pet of a kind shares one favorite and it is shown (`FAVORITE_FLAVOR` in `web/src/planner/foods.ts`; owner's decision 2026-11-17).
- **Companion phone app, continued.** Google sign-in on the phone (for now a Google account needs a password added with "Forgot password?"), tester builds (TestFlight and an Android `.apk`, needs an Expo account), the phone follow-ups above, and the formal two-device sync checks in `HANDOFF.md`. Then notifications (due-date and pet-care reminders) and the App Store. Also tapping a project on the phone to see its requirements and tasks. On iPhone with Google sign-in, the App Store also needs Sign in with Apple (planned in accounts) and an in-app Delete account option (also planned). Maybe a watch app later.

## Older ideas not built yet (check before starting; some may be done)

These are from earlier designs (`2026-10-28-setup-and-project-types-design.md`, Non-goals; `HANDOFF.md`):

- optional deadlines and time estimates;
- mood based on consistency;
- pausing a project;
- progress photos;
- different pet behaviour or Shop items per project type;
- using food, clothes and toys, and sprite animation frames.

# Studium roadmap

What's planned, in order. Each big item gets its own design (`docs/superpowers/specs/`) before any code.

## Before the final due date (December 3, 2026)

_Status as of 2026-11-16._

1. **Signed Mac installer: done; tester check today (11/16).** Signed and notarized since 0.11.0 (PR #24); published as the 0.11.0 pre-release. The tester checks there's no "Open Anyway" step.
2. **Linux installer: built (a `.deb`, PR #25); tester check today (11/16).** A person checks the see-through pet overlay on a real Linux desktop, which may act differently there, especially under Wayland. No AppImage: on Ubuntu 24.04+ it would only start with Electron's sandbox off.
3. **Accounts and sync: built and published (PR #23, site and rules deployed 11/10).** Linking checked by hand on the web and Windows apps. Left: the formal two-device checks in `HANDOFF.md` (offline double completion, delete vs edit, sign out → picker, a second account on one computer).
4. **Companion phone app: built (PRs #26, #27, #28); checked on the owner's iPhone 11/16.** Quick add reaches the desktop's Pending section; pull to refresh shows a spinner and "Up to date". Left before Dec 3: **Google sign-in on the phone** (the owner and most testers use Google; for now a Google account needs a password added with "Forgot password?"), **tester builds** (TestFlight and an Android `.apk`, needs an Expo account), and **publishing 0.12.0** (phone quick adds only show in the Pending section from 0.12.0 on). Notifications come after December 3. Design: `docs/superpowers/specs/2026-11-15-companion-app-design.md`.
5. **Overdue bug:** "Desktop: pets and sticky notes stop responding to clicks" (`bugs.md`, opened 11/05). Can't be reproduced yet; testers should note when it happens.
6. **Replace the stand-in pet sounds** (generated placeholders, `desktop/scripts/makeSounds.js`) with copyright-free recordings, if time allows.

## Schedule to December 3

| When | What |
|---|---|
| **Mon 11/16** | Mac and Linux testers install 0.11.0 and report (release page has a "please report" list). Merge PR #29 (install steps). |
| **Tue 11/17 – Wed 11/18** | Fix anything the testers found. Publish **0.12.0** as a pre-release (rebuild first if fixes landed). Owner: make an Expo account. |
| **Thu 11/19 – Sat 11/21** | **Google sign-in on the phone** (design first: Expo Go limits how a sign-in can return to the app). Phone tester builds: TestFlight for iPhone, an `.apk` for the Android tester. |
| **Sun 11/22 – Tue 11/24** | Phone follow-ups that show in a demo: the sign-in flash on start, messages that never clear, ticked pending tasks disappearing, the checkbox's check mark, a Studium app icon. Formal two-device sync checks. |
| **Wed 11/25 – Sun 11/29** | Thanksgiving week: buffer. Stand-in sounds if time allows. Look at the overdue click bug again if testers saw it. |
| **Mon 11/30 – Tue 12/1** | Final installer (bump the version), published as the latest release. Code freeze after this. |
| **Wed 12/2** | Rehearse the one-hour demo end to end: desktop, web, phone (Expo Go or TestFlight), with a test account holding good example data. |
| **Thu 12/3** | Final demo. |

## Small follow-ups (from the companion app reviews, 2026-11-15)

Found in the whole-branch reviews of the companion app work; none blocks the demo. Tick them off here as they're done.

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

## After December 3

Each of these builds on accounts.

- **Payments and paid currency.** Real-money purchases tied to the account and restorable on any device. Includes the **link bonus**: paid currency for everyone who linked an account, including people who linked before the currency existed. Needs the Firebase Blaze plan, for the server code that confirms payments.
- **Collab mode.** Share a project and its pet with someone else and work on it together. Open questions: inviting, who can edit, and how the pet's mood works with two people.
- **Companion app notifications** (due-date and pet-care reminders), then the App Store. Also tapping a project on the phone to see its requirements and tasks (nice to have in the design). On iPhone with Google sign-in, the App Store also needs Sign in with Apple (planned in accounts) and an in-app Delete account option (also planned). Maybe a watch app later.

## Older ideas not built yet (check before starting; some may be done)

These are from earlier designs (`2026-10-28-setup-and-project-types-design.md`, Non-goals; `HANDOFF.md`):

- optional deadlines and time estimates;
- mood based on consistency;
- pausing a project;
- progress photos;
- different pet behaviour or Shop items per project type;
- using food, clothes and toys, and sprite animation frames.

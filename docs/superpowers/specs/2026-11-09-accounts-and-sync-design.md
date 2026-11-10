# Accounts and sync

Date: 2026-11-09. Due: before the final project deadline, **December 3, 2026**.

## Why

Studium saves everything on one device today: the web app and the desktop app keep it in browser storage, and the extension copies it from the Studium page. Accounts are the foundation for four things the user wants:

1. **Projects and pets follow you.** Sign in on another computer, or in the web app, and your projects, pets and tokens are there.
2. **Restoring purchases.** Paid features come later; a purchase must belong to an account so it survives a reinstall or a new computer.
3. **A companion app, maybe a watch app, later.** It signs in to the same account.
4. **Collab mode later.** A project and its pet are shared between people.

This round builds accounts and sync only. Payments, collab mode and the companion app are separate projects (see `docs/ROADMAP.md`). This design must leave room for them.

## Goals

- **Guest first.** Studium works fully without an account, exactly as today. Nobody is made to sign up.
- **Link an account at any time.** Linking keeps everything already on the device and starts syncing it. Nothing is lost.
- **Sync across the web app, Windows and Mac.** Changes on one show up on the others, and it works offline and catches up when back online.
- **A clear choice when two saves meet.** If a device has its own projects and the account already has different ones, the user picks which to keep, on a screen like a game's "found another save" prompt (below).
- **Room for later:** a link bonus in paid currency, purchases tied to the account, projects owned by more than one person, and a companion app reading the same data.

## Non-goals (this round)

- Payments, paid currency and the Shop changes they need.
- Collab mode: sharing, inviting, or permissions.
- The companion or watch app.
- Merging two saves into one. The user picks one; the other becomes a backup.
- Syncing the browser extension separately. It keeps getting projects from the Studium page, as today. The only change is the page's new address; see "Platforms this round".

## Anti-goals (would make this a failure even if it works)

- **Someone loses projects or pets** by linking, signing out, signing in on a new device, or choosing a save. Every path that replaces data on a device first keeps a backup of what was there.
- **A guest is nagged.** No pop-ups asking you to sign up. Studium asks only when you try something that needs an account.
- **Studium stops working offline,** or waits for the network before showing your projects.
- **Two devices quietly overwrite each other's work,** for example a task checked off on the laptop comes back unchecked because the desktop saved later.
- **One user can read or change another user's data.**

## Decisions made with the user

### Platform

- **Firebase:** Firebase Auth for accounts and Cloud Firestore for the data. The user has two free Supabase projects already in use, and prefers Firebase for its built-in offline sync.
- Stay on the free **Spark** plan this round. Payments later will need Cloud Functions, which means moving to the pay-as-you-go **Blaze** plan with a card on file. That is expected and fine.

### Sign-in methods

- **Email and password,** with a "Forgot password?" reset email.
- **Continue with Google.**
- **Continue with Apple.** The user has an Apple Developer account. Apple requires this option once the companion app is on iPhone with Google sign-in.

### Guest first, link later

- Without an account you are a **guest**. Everything works and is saved on the device, as today.
- **Settings → Account** has a **Link account** button. Until linked, it mentions the bonus: "Link an account to save your progress and get a bonus later." Once linked, it shows the email, "Last synced …", **Sign out**, and **Delete account**. Today that section reads "Your account details will show here once accounts are added."
- **Link bonus.** Linking will be rewarded with paid currency. That currency doesn't exist yet, so this round only records **when** the account was first linked. The payments project grants the bonus to every account linked by then, including accounts linked before the currency existed.
- **When Studium asks you to link:** only when you try something that needs an account:
  - connecting the companion app;
  - buying something;
  - starting or joining a collab project.

  Each prompt says why and mentions the bonus. None of these exist yet, so this round builds the prompt as a reusable piece, and the Settings button is its only use.

### Two saves: the picker (option A)

Shown once, when you link or sign in on a device that has its own projects while the account already has **different** ones. The user chose option A, side by side with details:

- Title "You have two saves". Explanation: this computer and your account have different projects; pick one to keep, and Studium will use it on every device you sign in on.
- Two cards: **On this computer** and **In your account**. Each shows:
  - when it was last saved (date and time), and for the account, which device saved it;
  - counts: projects, tokens, tasks done, pets grown up;
  - a few pets with their names and stages (adult, baby, egg), then "+ N more".
- The card with more progress gets a **More progress** tag.
- Buttons: **Keep this computer's** and **Keep my account's**.
- Footer: "The one you don't keep is saved as a backup file on this computer, just in case."

A mockup is in `.superpowers/brainstorm/209-1794264298/content/save-picker.html`. It isn't committed, since `.superpowers/` is ignored.

When there's no real conflict, there's no picker:
- If the device has no projects of its own (new install, or only the untouched example data), it takes the account's data.
- If the account is empty (first link), the device's data is uploaded.

### Signing in on a new device

*(My call.)* First-run setup gets an **"Already use Studium? Sign in"** link on its first step. Signing in there loads the account's data and its synced settings (nickname, pet involvement) and skips the rest of setup. Settings → Account also offers **Sign in** next to **Link account**. Both use the same sign-in box: with an existing account, Studium signs in; with a new email, it creates the account.

### Signing out

- Everything stays on the device, and Studium carries on as a guest there. Changes after signing out are saved only on the device, not to the account.
- **Signing back in:** if nothing changed while signed out, the device simply rejoins the account. If something changed, the two-saves picker appears.
- **A different account signs in** *(my call)*. The device remembers which account its data came from. If someone else signs in, for example on a shared computer, that data is never uploaded to their account or offered in the picker. It's saved as a backup file, and the device takes the new account's data. Only data made as a guest, never linked to any account, can be uploaded or offered in the picker.

### What syncs, and what stays on each device

**Synced** (part of the account):
- projects, requirements, tasks, the event history, and the "today" list;
- habitat decor, and the token balance (it is worked out from the event history and the starting tokens);
- the nickname, how much pets interact, and pets-on-screen order;
- Shop purchases, to the extent they live in the data above.

**Stays on each device** (a laptop can be muted while the desktop isn't):
- the theme;
- Pet sounds, volume and sound bubbles;
- how many pets show on screen;
- Start with computer and Start quietly;
- tutorial-done flags;
- the desktop app's runtime pet state (`petAway` naps, check-ins, sticky-note timing, overlay positions).

How many pets show is per device because screens differ. *(My call; the user may move it.)*

### When two devices disagree *(my calls)*

These go beyond "a checked-off task must not come back unchecked":

- **The same task is completed on two devices while offline.** It counts once and pays tokens once. Merging must recognise the duplicate completion.
- **A task is reopened on one device and completed on another.** The later action wins, by when it happened, not when it synced.
- **Something is deleted on one device and edited on the other.** The delete wins: a deleted project, requirement or task stays deleted. Deletes must therefore leave a marker that syncs, not simply vanish.
- **Tokens are spent on two devices while offline,** so the merged balance goes below zero. Both purchases are kept. The balance shows the true (negative) number, and the Shop blocks spending until it's positive again. Nothing bought is taken back.
- **Everything else** (names, deadlines, colours, decor positions): the most recent edit to that record wins.

### Delete account

- **Settings → Account → Delete account,** with a confirmation step.
- It removes the account and all its cloud data. The device keeps its copy and becomes a guest.
- Apple requires this for any App Store app that lets you create an account, so the companion app will need it anyway.

### Ready for later

- **Collab:** store each project so it can belong to more than one person later, with a list of members, not simply "inside one user's folder". Only one member (the owner) exists this round.
  - **Tokens are personal (the user chose this).** In a shared project, only the person who checks off a task earns its tokens, into their own balance. Each user has their own token balance and Shop purchases.
  - **The pet is shared.** A project's pet mood and growth come from everyone's work on that project.
  - **What this means for the layout:** a task completion records who did it. Data about a project (its requirements, tasks, pet, and the events that drive its mood) belongs with the project. A person's balance, spending and purchases belong to that person.
  - **Habitat decor** *(my call)*: it belongs with the project's habitat, so both members see the same room, but whoever bought an item paid for it from their own balance.
- **Purchases:** keep an account-level place for future purchase records, which only server code may write. That place stays empty this round.
- **Link date** *(my call)*. Use the account's creation time from Firebase Auth. Studium can't change it and it needs no server code, which suits the free plan. A deleted and re-created account counts as a new link. Accepted for now; the payments project can tighten this if needed.
- **Companion app:** nothing extra; it will read the same Firestore data with the same sign-in.

### Setup the user does, and what to cut first

- **No Firebase project exists yet.** The user does the console steps (Firebase, Google Cloud, Apple Developer) with step-by-step instructions from the builder, given when each one is needed:
  - creating the project, email and Google sign-in, Firestore, and Hosting, at the start;
  - Apple sign-in and the desktop Google hand-off, later.
- **If time runs short, cut in this order** (the user agreed):
  1. Sign in with Apple.
  2. Google sign-in in the desktop apps.

  Email and password, sync, the two-saves picker and Delete account always stay.

### Platforms this round

- **Web app.** It needs to be hosted somewhere other than localhost for sign-in to work for testers. Firebase Hosting is the natural choice, and is free.
- **Windows and Mac desktop apps.** Google and Apple sign-in can't run inside the app's own window, so the desktop app opens the user's normal browser to sign in, then returns to the app. Email and password can stay in the app.
- **Browser extension.** It still reads from the Studium page. *(My call:)* point its `HOMEPAGE_URL` (`extension/content/logic.js`) at the hosted web app, with localhost kept for development, since hosting changes where the Studium page lives.

## Constraints and facts about the current code

- **Data today.** `StudiumData` (`web/src/planner/types.ts`) is one JSON bundle in `localStorage` under `studium-data-v1` (`web/src/store/storage.ts`, with validation and backups). Settings are saved separately under `studium-settings-v1`, and pet statuses under `studium-pets-v1`. The desktop app loads the same web app over `studium://app/`, so its data is also in that window's `localStorage`. The desktop's own pet state is in `desktop/src/main/store.js`.
- **Events are append-only.** That makes them easy to merge from several devices. Projects, requirements and tasks are edited in place, so they need per-record conflict handling. Last write wins per record is acceptable, but must not lose a checked-off task (see anti-goals).
- **Firestore limits.** A single document is capped at 1 MiB, and the event history grows without limit. Don't store the whole bundle as one document; split it into records.
- **Keep validation.** The app already validates loaded data (`storage.ts`). Data coming from the cloud must go through the same checks.
- **Tests.** The project is test-first: Vitest for web and desktop units, Playwright for desktop end to end. Sync code needs tests that run without a real Firebase project, using the Firebase emulator or a fake.
- **Security rules.** A user can read and write only their own account data and projects they are a member of. Rules must be written and tested.
- **Versions and installers.** Bump the desktop version before every installer build. Mac signing and notarization are due for the next build, by **Monday 11/16**. That is separate from this project and should happen first.

## Left to the builder

- How the data is laid out in Firestore (collections, IDs), within the constraints above.
- How the local data and Firestore stay in step: Firestore's offline cache, or the existing `localStorage` plus a sync layer. Both are fine if the anti-goals hold.
- The exact wording, layout and styling of the Account section, the sign-in box and the picker, following the existing design system (`HANDOFF.md`, "Design system").
- How the desktop app's browser sign-in hands back to the app (custom `studium://` link or a local port).
- Where backups of the unchosen save are written, and how the user finds one if needed.

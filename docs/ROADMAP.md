# Studium roadmap

What's planned, in order. Each big item gets its own design (`docs/superpowers/specs/`) before any code.

## Before the final due date (December 3, 2026)

1. **Signed Mac installer, by Monday 11/16.** Sign and notarize the Mac `.dmg` with the Apple Developer account, so testers don't need System Settings → Privacy & Security → Open Anyway.
2. **Accounts and sync: built; publishing and two-device checks pending.** Guest first, link an account later, and sync across the web and desktop apps. Design: `docs/superpowers/specs/2026-11-09-accounts-and-sync-design.md`.

## After December 3

Each of these builds on accounts.

- **Payments and paid currency.** Real-money purchases tied to the account and restorable on any device. Includes the **link bonus**: paid currency for everyone who linked an account, including people who linked before the currency existed. Needs the Firebase Blaze plan, for the server code that confirms payments.
- **Collab mode.** Share a project and its pet with someone else and work on it together. Open questions: inviting, who can edit, and how the pet's mood works with two people.
- **Companion app, maybe a watch app.** Signs in to the same account and shows your projects and pets. If it's on iPhone with Google sign-in, it also needs Sign in with Apple (planned in accounts), and an in-app Delete account option (also planned).

## Older ideas not built yet (check before starting; some may be done)

These are from earlier designs (`2026-10-28-setup-and-project-types-design.md`, Non-goals; `HANDOFF.md`):

- optional deadlines and time estimates;
- mood based on consistency;
- pausing a project;
- progress photos;
- different pet behaviour or Shop items per project type;
- using food, clothes and toys, and sprite animation frames.

# Studium companion (phone app)

Expo SDK 58 (React Native 0.88), expo-router. See your pets and today's plan away from the computer, tick tasks off, and quick-add tasks that wait in Pending on the desktop. Design: `docs/superpowers/specs/2026-11-15-companion-app-design.md`; plan: `docs/superpowers/plans/2026-11-15-companion-plan-2-phone-app.md`.

It uses the web app's own code from `../web/src` through the `@shared/*` alias, so moods and lists match the desktop. `metro.config.js` makes every package those files import come from `mobile/node_modules` (one Firebase).

## Run it on your phone (no store, no build service)

1. Install **Expo Go** from the App Store (or Google Play).
2. In this folder: `npm install` (first time), then `npx expo start`.
3. Scan the QR code with the iPhone camera (Android: from Expo Go). Phone and computer on the same Wi-Fi; if that doesn't connect, `npx expo start --tunnel`.
4. Sign in with your Studium email and password.

**Check by hand** with the desktop app open on the same account:
- Pets: each pet's mood and meal line match its habitat on the desktop.
- Quick add a task with "Also add to today" on: within a few seconds it's in the desktop's Today and Pending.
- Tick a task on the phone: it's ticked on the desktop, with the same tokens. Tick one on the desktop: it shows on the phone (pull down to refresh if needed).
- Close and reopen the app: still signed in.

## Builds for testers (needs the owner: an Expo account, and App Store Connect for iPhone)

- `npx eas-cli login` (make a free Expo account first if needed), then `npx eas-cli init` once to link the project.
- **Android tester:** `npx eas-cli build -p android --profile preview`. It ends with a link to an `.apk` to send them.
- **iPhone testers (TestFlight):** `npx eas-cli build -p ios --profile production`, then `npx eas-cli submit -p ios`. EAS asks to sign in with the Apple Developer account and makes the certificates. Then in App Store Connect → the app → TestFlight, add testers by email.
- The App Store itself waits for Sign in with Apple (see the spec).

## Checks

- Tests: `npx jest`. Type check: `npx tsc --noEmit`. Bundle check: `npx expo export --platform ios --output-dir dist`.

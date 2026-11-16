# Studium companion (phone app)

Expo SDK 58 (React Native 0.88), expo-router. It uses the web app's own code from `../web/src` through the `@shared/*` alias (see `metro.config.js`), so moods and lists match the desktop.

- Run on a phone: `npx expo start`, then open it in Expo Go.
- Tests: `npx jest`. Type check: `npx tsc --noEmit`.

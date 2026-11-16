# Companion app, Plan 2: the phone app (phase 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An iPhone and Android app that signs in to a Studium account and shows every pet (mood, what it looks after, meal info, "Needs you on the desktop"), today's plan (tick off, reopen, quick add to Pending), and a Settings tab with sign-out.

**Architecture:** A new Expo (React Native) app in `mobile/`. All logic the phone shows or changes comes from the web app's own code in `web/src` (planner, `store/actions.ts`, and the sync engine), imported directly through Metro, so moods and lists match the desktop exactly. What the phone screens show is worked out by a new, plain-TypeScript module `web/src/companion/view.ts`, tested with the web app's Vitest. The phone is just another syncing device: it starts with empty data, the sync engine's link decision "takes" the account's save, and every write goes through the engine (save labels included).

**Tech Stack:** Expo (current SDK at setup), React Native, TypeScript, expo-router tabs, Firebase JS SDK (same major as `web/`: `^13.2.0`), `@react-native-async-storage/async-storage`, Jest with `jest-expo` and `@testing-library/react-native`; Vitest for `web/src/companion`.

**Spec:** [docs/superpowers/specs/2026-11-15-companion-app-design.md](../specs/2026-11-15-companion-app-design.md). Plan 1 (merged, PR #26) added `createPendingTask`, `finishTaskDetails`, `isPending`, `Task.dueDate`, `taskDueDate`.

## Global Constraints

- Deadline **December 3, 2026** (live demo). Priorities, in order: (1) quick add on the phone works and shows up on the desktop; (2) pet and project information matches the desktop.
- **No notifications** in this plan (phase 2).
- The phone **never** shows or edits habitats, and does no pet care (feeding, medicine, Shop, eggs). It writes only: task completed, task reopened, new pending task (and the events those make).
- Moods, meal state and lists come from `web/src` functions, never re-implemented on the phone.
- Sign-in: **email and password must work.** Google sign-in is out of this plan (stretch, later).
- Tabs: **Pets**, **Today**, **Settings**, in that order.
- Quick add: name, project, and **"Also add to today"**, which starts **off**.
- Ticking off shows **"How long did it take?"** prefilled with the estimate, with a **Skip** (actual minutes left empty), then the tokens earned, as the desktop does. A pending task can be ticked off and earns nothing.
- App name **Studium**; bundle id / package **`edu.smu.studium.companion`** (the desktop's appId is `edu.smu.studium`).
- Look: colours and fonts from `web/src/index.css` (background `#f7f5f2`, card `#ffffff`, primary `#2d3a8c`, accent `#c9501a`, border `#d8d4cc`, muted text `#8a8680`; DM Serif Display for headings, Inter for text). Pet art: `web/public/pets/{cat,dog,frog,pigeon,turtle,egg}.png`.
- Work on branch `feature/companion-phone-app`. Commit trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. No push, merge, deploy, store upload or build-service run without the owner.

## Review Focus

1. **A signed-in phone with no network, then back online**: queued ticks and quick adds reach the desktop; nothing is lost silently. (Task 4 test with `FakeRemote` going offline.)
2. **The account's save was replaced elsewhere ("Keep this computer's") while the phone had a write queued**: the phone's write is refused, the phone takes the new save, and the user sees a message rather than a silent loss. (Task 4 test.)
3. **An account with no projects yet** (signed up on the web, never used): Pets says "No pets yet. Create a project in Studium on your computer." and quick add is disabled with the same hint, instead of a crash. (Tasks 1 and 5 tests.)
4. **Time passing while the app stays open** (a meal boost runs out, a new day starts): the screens refresh the clock at least every minute and on returning to the foreground, so "for 2h 40m more" and today's list don't go stale. (Task 5 test with a moved clock.)
5. **A pet whose requirement was deleted, or a project with only an egg**: cards still render ("Looks after the whole project"; egg card), no crash. (Task 1 tests.)

---

### Task 1: What the phone shows (shared view model)

**Files:**
- Create: `web/src/companion/view.ts`, `web/src/companion/view.test.ts`

**Interfaces:**
- Consumes: `petsOf`, `petMood`, `suggestedPetName` (`planner/pets.ts`); `projectMood` (`planner/mood.ts`); `mealBoostUntil`, `snackLiftUntil`, `canFeed` (`planner/food.ts`); `todayTaskIds` (`planner/suggest.ts`); `isPending` (`store/actions.ts`); `taskDueDate` (`planner/dueDates.ts`); `formatDate`, `durationLabel` (`ui/format.ts`); `MEAL_TOKEN_MULTIPLIER`, `MEAL_HOURS` (`planner/tuning.ts`).
- Produces:
  - `type PetCard = { petId: string; projectId: string; name: string; kind: PetKind | "egg"; looksAfter: string; mood: Mood | null; recovering: boolean; food: string | null }`
  - `type PetGroup = { projectId: string; heading: string; color: string; pets: PetCard[] }` — `heading` is `"<project name> · due <formatDate(deadline)>"`.
  - `petGroups(data: StudiumData, now: Date): PetGroup[]` — projects in `data.projects` order; pets in `petsOf` order.
  - `type NeedsYou = { kind: "sick" | "upset" | "meal"; petId: string; text: string }`
  - `needsYou(data: StudiumData, now: Date): NeedsYou[]` — all sick first, then upset, then meals.
  - `type TodayRow = { taskId: string; title: string; projectName: string; color: string; estimateMin: number; due: string | null; done: boolean; pending: boolean; blocked: boolean }`
  - `todayRows(data: StudiumData, now: Date): TodayRow[]` (today's plan, in order) and `pendingRows(data: StudiumData): TodayRow[]` (pending and not done, not already on today's plan).

**Copy (exact):**
- `looksAfter`: `"Looks after the whole project"`, or `Looks after "<requirement title>" · due <formatDate(requirement due or project deadline)>`; an egg: `"Hatches as you work on <project name>"`. A pet whose requirement is gone: the whole-project text.
- `food`: while a meal boost runs, `Meal: × <MEAL_TOKEN_MULTIPLIER> tokens for <durationLabel(left)> more`; else if it has eaten today, `Next meal tomorrow`; while a snack lifts its mood, `Snack: lifting mood for <durationLabel(left)>` (meal line wins if both); otherwise `null`. Eggs: `null`.
- `needsYou` texts: sick `"<name> is sick: give medicine."`; upset `"<name> is upset: it hasn't seen work on \"<idle requirement>\" in <n> days."` (or `"<name> is upset."` with no idle requirement); meal, one per project that has no boost running and whose first hatched pet `canFeed(..., "meal")` is ok or refused only for `"none-owned"`: `"<project short name> hasn't had a meal today: × <MEAL_TOKEN_MULTIPLIER> tokens for <MEAL_HOURS> hours."`
- `due` in `TodayRow`: `formatDate(taskDueDate(task, data))` only when the task has its own `dueDate`, else `null`.

- [ ] **Step 1: Write the failing tests** (`view.test.ts`, builders from `planner/testData.ts`; `fed` events as in `components/Habitat.test.tsx`):
  - groups follow project order; a project with an extra pet (`makePet`) gives two cards, the project's own first, each with its own mood (make the extra pet care for an idle requirement so its mood differs).
  - an egg project gives a card with `kind: "egg"`, `mood: null`, the hatch text.
  - a pet caring for a deleted requirement shows the whole-project text.
  - meal boost 3 hours ago (`MEAL_HOURS` 4) → `"Meal: × 1.1 tokens for 1h 0m more"`; a meal 5 hours ago today → `"Next meal tomorrow"`; a snack lifting → the snack line.
  - `needsYou` orders sick, upset, meal and uses the exact texts; a project with a boost running gets no meal item; an empty account gives `[]` from all four functions.
  - `todayRows` keeps today's order, marks pending and blocked tasks, shows `due` only for tasks with their own date (capped); `pendingRows` leaves out done ones and ones already on today's plan.
- [ ] **Step 2: Run** `cd web && npx vitest run src/companion` → FAIL (module missing).
- [ ] **Step 3: Implement** `view.ts`. Use `petMood(pet, data, now) ?? projectMood(pet.projectId, data, now)` as `store/petStatus.ts` does; name with `pet.name ?? suggestedPetName(project, pet.kind)`.
- [ ] **Step 4: Run** the tests → PASS; then `npm test && npm run typecheck` in `web/` → all pass.
- [ ] **Step 5: Commit** — `feat(companion): what the phone shows, from the planner's own code`

---

### Task 2: Firestore settings a phone can use

**Files:**
- Modify: `web/src/sync/firestoreRemote.ts` (`createFirestoreRemote`)
- Test: `web/src/sync/firestoreRemote.test.ts` (create if missing)

**Interfaces:**
- Produces: `createFirestoreRemote(app, opts: { emulator?: {host; port}; phone?: boolean })`. With `phone: true`: memory cache (phones have no IndexedDB) and `experimentalAutoDetectLongPolling: true` (React Native's networking). Exported pure helper `firestoreSettings(opts): FirestoreSettings` that `createFirestoreRemote` passes to `initializeFirestore`.

- [ ] **Step 1: Failing test:** `firestoreSettings({})` uses the persistent cache (as now); `firestoreSettings({ phone: true })` has a memory cache and `experimentalAutoDetectLongPolling: true`; both keep `ignoreUndefinedProperties: true`. (Compare cache `kind` fields: `"persistent"` / `"memory"`.)
- [ ] **Step 2: Run** `npx vitest run src/sync/firestoreRemote.test.ts` → FAIL.
- [ ] **Step 3: Implement**; the web app's behaviour must not change.
- [ ] **Step 4: Run** `npm test && npm run typecheck && npm run test:emulator` in `web/` → all pass.
- [ ] **Step 5: Commit** — `feat(sync): Firestore settings for phones`

---

### Task 3: The Expo app, wired to the shared code

**Files:**
- Create: `mobile/` (from `npx create-expo-app@latest mobile --template tabs`), then: `mobile/metro.config.js`, `mobile/tsconfig.json` (path alias), `mobile/jest.config.js`, `mobile/app.json` edits, `mobile/src/shared.test.ts`
- Modify: root `.gitignore` (`mobile/node_modules`, `mobile/.expo`, `mobile/dist`)

**Interfaces:**
- Produces: the import alias **`@shared/*` → `../web/src/*`**, working in Metro, TypeScript and Jest. Metro resolves every package (including `firebase` imported from `web/src` files) from **`mobile/node_modules` only** (`resolver.nodeModulesPaths = [mobile/node_modules]`, `resolver.disableHierarchicalLookup = true`, `watchFolders = [../web/src]`), so there is one Firebase instance.
- `app.json`: name `Studium`, slug `studium-companion`, `ios.bundleIdentifier` and `android.package` `edu.smu.studium.companion`, icon from the desktop's icon if present (`desktop/build/icon.png`), splash background `#f7f5f2`.

- [ ] **Step 1: Scaffold** with the tabs template; remove its example screens; install `firebase@^13.2.0`, `@react-native-async-storage/async-storage`, `@testing-library/react-native`, fonts via `@expo-google-fonts/dm-serif-display` and `@expo-google-fonts/inter`. Record the Expo SDK version in `mobile/README.md` (one line).
- [ ] **Step 2: Failing test** `mobile/src/shared.test.ts`: imports `petGroups` from `@shared/companion/view` and `emptyData` from `@shared/store/seed`; `petGroups(emptyData(new Date()), new Date())` equals `[]`. Run `cd mobile && npx jest src/shared.test.ts` → FAIL (alias not configured).
- [ ] **Step 3: Configure** Metro, TypeScript (`paths`) and Jest (`moduleNameMapper`) for the alias.
- [ ] **Step 4: Verify** `npx jest` → PASS; `npx tsc --noEmit` → no errors; `npx expo export --platform ios --output-dir dist` and `--platform android` → both bundle without errors (proves Metro resolves `web/src` and Firebase).
- [ ] **Step 5: Commit** — `feat(mobile): Expo app that uses the web app's code`

---

### Task 4: Signing in and syncing on the phone

**Files:**
- Create: `mobile/src/phoneStorage.ts`, `mobile/src/phoneStudium.ts`, `mobile/src/firebase.ts`, tests `mobile/src/phoneStorage.test.ts`, `mobile/src/phoneStudium.test.ts`

**Interfaces:**
- Consumes: `createSyncEngine`, `EngineDeps` (`@shared/sync/syncEngine`); `createFirebaseAuth`, `AuthClient` (`@shared/sync/...`); `createFirestoreRemote(app, { phone: true })` (Task 2); `FIREBASE_CONFIG` (`@shared/sync/config`); `emptyData`, `isValidData`, `normalizeData`, `completeTask`, `reopenTask`, `createPendingTask`; test fakes `FakeRemote` (`@shared/test/fakeRemote`) and `FakeAuth` (`@shared/test/fakeAuth`).
- Produces:
  - `loadPhoneStorage(): Promise<Storage>` — a synchronous `Storage` (what the engine needs) backed by AsyncStorage: reads every Studium key once at start, writes through.
  - `createPhoneStudium(deps: { auth: AuthClient; remote: RemoteStore; storage: Storage; clock: () => Date }): PhoneStudium` where
    `PhoneStudium = { state(): PhoneState; subscribe(cb: () => void): () => void; signIn(email: string, password: string): Promise<void>; signOut(): Promise<void>; complete(taskId: string, actualMin: number | null): Payout | null; reopen(taskId: string): void; quickAdd(input: PendingTaskInput): void }`
    and `PhoneState = { account: Account | null; data: StudiumData; syncing: boolean; message: string | null; now: Date }`.
  - `mobile/src/firebase.ts`: builds the real `auth` (`initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })` **before** `createFirebaseAuth(app)`, so it signs back in after a restart) and `remote`.

- [ ] **Step 1: Failing tests**
  - `phoneStorage`: values set are read back synchronously and are in AsyncStorage (jest's AsyncStorage mock); a fresh `loadPhoneStorage()` sees them.
  - `phoneStudium` with `FakeRemote` + fake auth, the account already holding projects (from `buildSeed`): signing in "takes" the account's save (the phone's projects equal the account's; no picker); `quickAdd` → after `flush`, a second engine device sees the pending task; `complete` on a task returns the same payout `completeTask` gives and the account gets the `task_completed` event; `reopen` reverses it.
  - **Review Focus 1:** remote offline (`FakeRemote` refusing/holding writes) during a quick add, then online → the task reaches the account.
  - **Review Focus 2:** another device replaces the save (`replaceAll`) while the phone has a quick add queued → the phone ends on the new save and `state().message` is `"Your account's data changed on another device, so this phone took the newest copy."`
  - an account with no projects → `state().data.projects` is `[]`, no throw.
  - `signOut` clears the phone's data back to `emptyData` (the phone keeps nothing of an account once signed out).
- [ ] **Step 2: Run** `cd mobile && npx jest src/phoneStorage.test.ts src/phoneStudium.test.ts` → FAIL.
- [ ] **Step 3: Implement.** The phone has no picker: if `connect` ever returns `"picker"`, choose the account's save (`choose("account")`), since the phone can't make projects. Device name for the engine: `"Phone"`. Call `engine.localChanged()` after each write.
- [ ] **Step 4: Run** `npx jest && npx tsc --noEmit` → all pass.
- [ ] **Step 5: Commit** — `feat(mobile): sign in and sync as another Studium device`

---

### Task 5: The screens

**Files:**
- Create: `mobile/app/_layout.tsx` (fonts, `PhoneStudium` context, sign-in gate), `mobile/app/sign-in.tsx`, `mobile/app/(tabs)/_layout.tsx`, `mobile/app/(tabs)/index.tsx` (Pets), `mobile/app/(tabs)/today.tsx`, `mobile/app/(tabs)/settings.tsx`, `mobile/src/ui/` (theme, `PetCard`, `TaskRow`, `QuickAdd`, `CompletionSheet`), screen tests in `mobile/src/ui/__tests__/`

**Interfaces:**
- Consumes: `PhoneStudium` (Task 4); `petGroups`, `needsYou`, `todayRows`, `pendingRows` (Task 1); `formatMinutes`, `payoutMessage` (`@shared/ui/format`); pet art `web/public/pets/*.png` via `require` (Metro's `watchFolders` must include `../web/public/pets`).

**Screens (match `docs/companion/mockups/companion-screens.png`):**
- **Sign in:** email, password, "Sign in" button; errors in words from the shared `AuthError` codes ("Wrong email or password." etc. as the web's `SignInDialog.tsx` words them); a line "No account yet? Make one in Studium on your computer, under Settings → Account."
- **Pets:** "Your pets"; the "Needs you on the desktop" box when `needsYou` isn't empty; project headers; pet cards with art, name, looks-after, mood chip (colours as the web's `MOOD_COLORS`, plus "Recovering" when `recovering`), food line. Empty account: "No pets yet. Create a project in Studium on your computer." Pull to refresh reconnects.
- **Today:** "Today" and the date; rows from `todayRows` (checkbox, title, project dot and name, estimate, "due …" when set, "Pending" tag); blocked rows can't be ticked and say "Waiting on another task". Ticking opens **CompletionSheet**: "How long did it take?" with the estimate prefilled (minutes stepper using the desktop's estimate choices), "Done" and "Skip", then a toast with `payoutMessage`. Ticked rows can be unticked (reopen). Then "Pending: add details on the desktop" with `pendingRows`. Then "+ Quick add": name, project picker, "Also add to today" switch (off), "Add". With no projects: disabled, with the empty-account line.
- **Settings:** signed-in email, "Sign out", and the app version.
- The clock (`state().now`) refreshes every 60 seconds and when the app returns to the foreground (`AppState`).

- [ ] **Step 1: Failing tests** (`@testing-library/react-native`, a `PhoneStudium` built on `FakeRemote` + fake auth + `buildSeed`):
  - Pets shows each project header and one card per pet with the mood text from `petGroups`.
  - Needs-you box appears only when there's something, in order.
  - Today: tick a task → sheet → "Skip" → the account has the completion with `actualMin: null`; "Done" with the prefilled estimate records it.
  - Quick add: name + project + switch on → the task is in Pending **and** today; switch left off → Pending only. Empty name → "Give the task a name." and nothing added.
  - **Review Focus 3:** empty account → both empty-state lines; quick add disabled.
  - **Review Focus 4:** advance the injected clock past a meal boost's end and fire the 60-second refresh → the food line changes to "Next meal tomorrow".
  - Sign out → back to Sign in.
- [ ] **Step 2: Run** `cd mobile && npx jest src/ui` → FAIL.
- [ ] **Step 3: Implement** the screens.
- [ ] **Step 4: Run** `npx jest && npx tsc --noEmit && npx expo export --platform ios --output-dir dist` → all pass.
- [ ] **Step 5: Commit** — `feat(mobile): Pets, Today and Settings`

---

### Task 6: On real phones, then testers

**Files:**
- Create: `mobile/eas.json`, `mobile/README.md` (how to run and build)
- Modify: `HANDOFF.md`, `docs/ROADMAP.md`

- [ ] **Step 1: The owner's phone (no store, no build service):** `cd mobile && npx expo start`, open in **Expo Go** on the iPhone (same Wi-Fi; or `--tunnel`). Check by hand, with the desktop app open on the same account: sign in; the Pets moods and meal lines match the desktop's habitats; quick add a task with "Also add to today" → it appears on the desktop's Today and Pending within a few seconds; tick a task on the phone → it's ticked on the desktop and the tokens match; tick one on the desktop → it shows on the phone. Note results in `mobile/README.md`. This is enough for the December 3 demo.
- [ ] **Step 2: `eas.json`** with a `preview` profile (Android `apk`, iOS internal distribution) and a `production` profile (iOS for TestFlight). `npx eas-cli build --profile preview --platform android --non-interactive --dry-run` style checks only: **real builds and uploads need the owner** (an Expo account login, and App Store Connect for TestFlight). Write the exact owner steps in `mobile/README.md`: `npx eas-cli login`; `npx eas-cli build -p android --profile preview` (gives an `.apk` link for the Android tester); `npx eas-cli build -p ios --profile production` then `npx eas-cli submit -p ios` (TestFlight; add testers in App Store Connect → TestFlight).
- [ ] **Step 3: Docs:** HANDOFF section (where the app lives, the `@shared` alias and why Metro must resolve packages from `mobile/node_modules` only, the phone as a sync device, Firestore phone settings, how to run and build); ROADMAP item 4 updated.
- [ ] **Step 4: Full check:** `cd web && npm test && npm run typecheck && npm run build`; `cd mobile && npx jest && npx tsc --noEmit`.
- [ ] **Step 5: Commit** — `docs(mobile): run it on a phone, build it for testers`

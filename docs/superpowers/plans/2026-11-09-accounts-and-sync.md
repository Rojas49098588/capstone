# Accounts and Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Optional Studium accounts (email and password, Google, Apple) that sync projects, pets and tokens through Firebase across the web app and the Windows and Mac apps. Guests keep working exactly as today.

**Architecture:** The app keeps reading and writing its one `StudiumData` bundle in `localStorage`, unchanged. A new `web/src/sync/` layer sits beside it:
- it splits the bundle into records (projects, requirements, tasks, events, a user document);
- it notices which records changed since the last sync, using a hash per record;
- it pushes those changes to Firestore;
- it merges records arriving from Firestore back in, with the most recent change per record winning. Deletes leave a marker that syncs, and events are combined from both sides.

The record and merge logic is pure functions, and the whole layer reaches Firebase only through two small interfaces, `AuthClient` and `RemoteStore`. Unit tests use in-memory fakes; the Firestore security rules are tested against the Firebase emulator.

**Tech Stack:**
- `firebase` JS SDK v11+: `firebase/app`, `firebase/auth`, `firebase/firestore` with `persistentLocalCache`;
- React 19, TypeScript, Vitest;
- `firebase-tools` and `@firebase/rules-unit-testing` for the emulator rules tests (Java 24 is installed);
- Electron for the desktop browser sign-in;
- Playwright for desktop end-to-end tests.

**Spec:** `docs/superpowers/specs/2026-11-09-accounts-and-sync-design.md`. Read it first: the decisions, anti-goals and "my call" items are binding.

## Global Constraints

- **Guests are never pushed.** No pop-ups. Accounts show up only in Settings → Account, in setup's "Already use Studium? Sign in" link, and in the reusable link prompt.
- **Studium works with no Firebase config.** If the config is empty, every account entry point is hidden and the app behaves exactly as today. The tests must pass without network access.
- **Nothing is lost.** Every path that replaces data on a device first writes a backup with the existing `BACKUP_PREFIX` (`studium-data-backup-<ISO time>`, `web/src/store/storage.ts`).
- **Validate cloud data.** Data assembled from Firestore goes through `isValidData` and `normalizeData` (`web/src/store/storage.ts`) before the app sees it. Invalid records are skipped, never applied.
- **Synced settings:** `nickname`, `petInvolvement`, `petOrder`. Every other setting stays on the device.
- **Link-bonus date:** `user.metadata.creationTime` from Firebase Auth. No field written by the client.
- **Tokens are personal.** Project events record `by: <uid>` in Firestore. This round has one member per project.
- **Bump `desktop/package.json`** before any installer build. Mac signing (the separate 11/16 work) happens before this plan's installer.
- **Copy:**
  - Account section heading: "Account".
  - Link button: "Link account".
  - Bonus line: "Link an account to save your progress and get a bonus later."
  - Setup link: "Already use Studium? Sign in".
  - Picker title: "You have two saves".
  - Picker buttons: "Keep this computer's" and "Keep my account's".
  - Picker tag: "More progress".
  - Picker footer: "The one you don't keep is saved as a backup file on this computer, just in case."
- **If time runs short, cut in this order:** first Apple sign-in (Task 12), then desktop Google sign-in (Task 11). Everything else stays.

## Review Focus

1. **A record changed on both devices while offline.** The change that happened later wins, judged by its `updatedAt`, not by which arrived last. Test: `merge.test.ts` "a later local edit beats an older remote one that arrives after it".
2. **Someone else's synced data on a shared computer.** It must never reach the new account. Test: `linkDecision.test.ts` "another account's data is backed up, never uploaded or offered".
3. **Cloud data that fails validation** (an old app version, a hand-edited document). It's skipped, and local data is untouched. Test: `syncEngine.test.ts` "an invalid remote task is ignored and local data stays".
4. **Firestore's 500-write batch limit** on the first upload of a large save. Test: `firestoreRemote` splits writes into batches of at most 450; `firestoreRemote.test.ts` "a first upload of 1,200 records uses 3 batches".
5. **Signing out mid-sync, or a remote snapshot arriving after sign-out.** It must not write to the account or change local data. Test: `syncEngine.test.ts` "after stop(), late remote snapshots are ignored".

---

## File structure

```
firebase.json, .firebaserc, firestore.indexes.json       Firebase project files (repo root)
firebase/firestore.rules                                   security rules
firebase/package.json, firebase/rules.test.js              rules tests against the emulator
web/src/sync/
  config.ts           Firebase web config, or null (accounts off)
  records.ts          StudiumData <-> records, event ids, record hashes
  merge.ts            merging local and remote records
  syncState.ts        per-device sync bookkeeping in localStorage ("studium-sync-v1")
  linkDecision.ts     what to do when an account connects: upload, take, rejoin, picker, backup-and-take
  saveSummary.ts      the picker's numbers for one save
  remote.ts           RemoteStore interface + types
  firestoreRemote.ts  RemoteStore on Firestore
  auth.ts             AuthClient interface + types
  firebaseAuth.ts     AuthClient on Firebase Auth (web popup; desktop via the browser hand-off)
  syncEngine.ts       ties it together: start/stop, push local changes, apply remote ones
  AccountProvider.tsx React context: account state + actions for the UI
web/src/test/fakeRemote.ts, web/src/test/fakeAuth.ts      in-memory fakes
web/src/components/
  AccountSection.tsx  Settings → Account
  SignInDialog.tsx    the sign-in box (also the reusable link prompt)
  SavePicker.tsx      "You have two saves" (option A)
web/desktop-sign-in.html + web/src/desktopSignIn.tsx      hosted page that the desktop's browser sign-in opens
desktop/src/main/browserSignIn.js                          the local callback server for the hand-off
```

Modified:
- `web/src/store/useStudium.tsx`: `replaceData`;
- `web/src/components/Settings.tsx` and `Setup.tsx`;
- `web/src/App.tsx`: the providers;
- `web/vite.config.ts`: the second page;
- `desktop/src/preload/studium.js`;
- `desktop/src/main/main.js`;
- `extension/content/logic.js`: `HOMEPAGE_URL`;
- `README.md` and `HANDOFF.md`.

---

### Task 1: Firebase project, rules and their tests

The user does the console steps; the builder gives them these steps word for word and waits.

**User steps (Firebase console, about 15 min):**
1. Go to console.firebase.google.com and click **Create a project**, named `studium`. Google Analytics is optional; off is fine.
2. Under **Build → Authentication → Get started → Sign-in method**, enable **Email/Password** and **Google**.
3. Under **Build → Firestore Database → Create database**: **production mode**, location `nam5 (us-central)`.
4. Under **Project settings → General → Your apps**, click **Web (</>)**, nickname `Studium web`, and tick **Firebase Hosting**. Copy the `firebaseConfig` object it shows and paste it to the builder.
5. Install the CLI with `npm i -g firebase-tools`, then run `firebase login`.

**Files:**
- Create:
  - `firebase.json` (hosting `public: web/dist`, SPA rewrite to `/index.html`; firestore rules `firebase/firestore.rules`; emulators firestore port 8080);
  - `.firebaserc` (default = the user's project ID);
  - `firestore.indexes.json` (empty);
  - `firebase/firestore.rules`;
  - `firebase/package.json` (devDeps `firebase-tools`, `@firebase/rules-unit-testing`, `vitest`; script `"test": "firebase emulators:exec --only firestore --project demo-studium \"vitest run\""`).
- Test: `firebase/rules.test.js`

**Data layout (Firestore). Later tasks rely on these exact paths and fields:**
- `users/{uid}`: `{ updatedAt: string, savedAt: string, savedBy: string, startingTokens: number, defaultBeds: boolean, today: {date, taskIds}, settings: {nickname, petInvolvement, petOrder} }`
- `users/{uid}/events/{eventId}`: `{ event: StudiumEvent }` (personal events: `purchase`).
- `projects/{projectId}`: `{ members: string[], owner: string, updatedAt: string, deleted: boolean, project: Project | null, decor: Record<habitatId, HabitatDecor> }`
- `projects/{projectId}/requirements/{id}` and `.../tasks/{id}`: `{ updatedAt: string, deleted: boolean, data: Requirement | Task | null }`
- `projects/{projectId}/events/{eventId}`: `{ event: StudiumEvent, by: string }`

**Interfaces:**
- Produces: the rules, and the layout above.

- [ ] **Step 1: Write the failing rules tests** in `firebase/rules.test.js` using `initializeTestEnvironment({ projectId: 'demo-studium', firestore: { rules } })`:
  - `"a user reads and writes only their own user doc and events"`: alice can set `users/alice` and `users/alice/events/e1`; bob is denied both, reading and writing.
  - `"a project is created only with yourself as owner and only member"`: alice can create `projects/p1` with `{members:['alice'], owner:'alice'}`. Denied: `members:['alice','bob']` with `owner:'bob'`, and `owner:'alice'` when the request comes from bob.
  - `"only members read or write a project and its subcollections"`: bob is denied get/set on `projects/p1`, `projects/p1/tasks/t1` and `projects/p1/events/e1`, and alice is allowed.
  - `"members and owner can't be changed by an update"`: alice updating `members` to `['alice','bob']` is denied. That change is collab's job later.
  - `"signed-out requests are denied everywhere"`.
- [ ] **Step 2:** Run `cd firebase && npm install && npm test`. Expected: FAIL. With no rules file yet, the rules default to deny-all, so the "allowed" cases fail.
- [ ] **Step 3: Write `firebase/firestore.rules`.**
  - `users/{uid}/{document=**}`: allowed when `request.auth.uid == uid`.
  - `projects/{pid}`:
    - create when `request.resource.data.owner == request.auth.uid && request.resource.data.members == [request.auth.uid]`;
    - read and delete when `request.auth.uid in resource.data.members`;
    - update when the user is a member and `request.resource.data.members == resource.data.members && request.resource.data.owner == resource.data.owner`.
  - `projects/{pid}/{sub}/{id}`: allowed when `request.auth.uid in get(/databases/$(database)/documents/projects/$(pid)).data.members`.
- [ ] **Step 4:** Run `npm test`. Expected: all 5 pass.
- [ ] **Step 5:** Run `firebase deploy --only firestore:rules` (the user's project). Expected: "Deploy complete".
- [ ] **Step 6: Commit:** `feat(firebase): project files and Firestore rules with emulator tests`.

---

### Task 2: Records: splitting the bundle, event ids, hashes

**Files:**
- Create: `web/src/sync/records.ts`
- Test: `web/src/sync/records.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type RecordKey = string; // "project:<id>" | "requirement:<id>" | "task:<id>" | "event:<id>" | "user"
  export type UserRecord = { startingTokens: number; defaultBeds: boolean; today: StudiumData["today"]; settings: SyncedSettings };
  export type SyncedSettings = { nickname: string; petInvolvement: PetInvolvement; petOrder: PetOrder };
  export type Records = {
    user: UserRecord;
    projects: Record<string, { project: Project; decor: Record<string, HabitatDecor> }>;
    requirements: Record<string, Requirement>;
    tasks: Record<string, Task>;
    events: Record<string, StudiumEvent>; // by eventId
  };
  export function eventId(e: StudiumEvent): string;           // deterministic
  export function toRecords(data: StudiumData, settings: SyncedSettings): Records;
  export function fromRecords(r: Records): { data: StudiumData; settings: SyncedSettings };
  export function recordHashes(r: Records): Record<RecordKey, string>;
  export function habitatProject(data: Pick<StudiumData, "projects">, habitatId: string): string | null; // the project a habitat id (project id or extra-pet id) belongs to
  export function eventProject(e: StudiumEvent, data: Pick<StudiumData, "tasks" | "requirements">): string | null; // null = personal (purchase), or unknown
  ```

- [ ] **Step 1: Write the failing tests:**
  - `"eventId is the same for the same event and differs when any field differs"`: two equal `task_completed` objects with keys in different order give the same id, and changing `at` by 1 ms gives a different id. A `focus_session` uses `focus:<its id>`.
  - `"toRecords then fromRecords gives back the same data"`, using `buildSeed(NOW)` from `store/seed.ts` and settings `{nickname:"Abby", petInvolvement:"mild", petOrder:"project"}`. Assert `fromRecords(toRecords(d, s))` deep-equals `{data: normalizeData(d), settings: s}`. Events come back sorted by `at`, then by id.
  - `"decor is filed under the project its habitat belongs to"`: an extra pet `x1` in project `p1` with `decor: {x1: {...}}` gives `projects.p1.decor.x1`.
  - `"events go to their project, purchases are personal"`: `eventProject` gives `"p1"` for a `task_completed` of a task in p1, `"p1"` for `fed` with `projectId: "p1"`, and `null` for `purchase`.
  - `"a record's hash changes only when the record changes"`.
- [ ] **Step 2:** `cd web && npx vitest run src/sync/records.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement.**
  - `eventId`: FNV-1a 64-bit hex of the canonical JSON (keys sorted, recursively). `focus_session` → `focus:<id>`. Use the same function for `recordHashes`.
  - The `user` record holds `startingTokens` (default `LEGACY_STARTING_TOKENS` from `planner/history.ts` when missing), `defaultBeds === true`, `today`, and the settings.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5: Commit:** `feat(sync): split Studium's data into records`.

---

### Task 3: Merging local and remote records

**Files:**
- Create: `web/src/sync/merge.ts`
- Test: `web/src/sync/merge.test.ts`

**Interfaces:**
- Consumes: `Records` and `RecordKey` from Task 2.
- Produces:
  ```ts
  export type Stamped<T> = { updatedAt: string; deleted: boolean; value: T | null };
  export type StampedRecords = {
    user: Stamped<UserRecord>;
    projects: Record<string, Stamped<Records["projects"][string]>>;
    requirements: Record<string, Stamped<Requirement>>;
    tasks: Record<string, Stamped<Task>>;
    events: Record<string, StudiumEvent>; // events are never edited, only added
  };
  export function mergeRecords(local: StampedRecords, remote: StampedRecords): { merged: StampedRecords; pushToRemote: RecordKey[] };
  export function dedupeCompletions(events: StudiumEvent[]): StudiumEvent[];
  export function liveRecords(s: StampedRecords): Records; // drops deleted records
  ```

- [ ] **Step 1: Write the failing tests:**
  - `"a later local edit beats an older remote one that arrives after it"`: the local task has `updatedAt 10:05` and title "B"; the remote has `10:00` and "A". The merged title is "B", and `pushToRemote` contains `"task:t1"`.
  - `"a later remote edit wins"` (the mirror case). `pushToRemote` is empty.
  - `"a delete beats an edit, even an older delete"`. Local: deleted at 10:00. Remote: edited at 10:05. The merged record is deleted. *(The spec says delete wins.)*
  - `"a record only one side has is kept and, if local, pushed"`.
  - `"events from both sides are combined"`.
  - `"the same task completed on two devices offline pays once"`: completions of t1 at 10:00 and 10:02 with no `task_reopened` between them leave only the 10:00 one after `dedupeCompletions`. The token balance (`tokenBalance`) counts it once.
  - `"complete, reopen, complete keeps both completions"`: with the reopen in between, nothing is dropped.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - For each key on either side: if either side is deleted, the result is deleted, with the later `updatedAt` of the two. Otherwise the later `updatedAt` wins; on a tie, remote wins.
  - A key goes in `pushToRemote` when the merged value comes from local and differs from remote.
  - `dedupeCompletions`: sort by `at`, track an "open" flag per task, and drop a `task_completed` for a task that's already completed with no reopen since.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5: Commit:** `feat(sync): merge local and remote records`.

---

### Task 4: Per-device sync bookkeeping and the link decision

**Files:**
- Create: `web/src/sync/syncState.ts`, `web/src/sync/linkDecision.ts`
- Test: `web/src/sync/syncState.test.ts`, `web/src/sync/linkDecision.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // syncState.ts. localStorage key "studium-sync-v1"; parse never throws.
  export const SYNC_KEY = "studium-sync-v1";
  export type SyncState = {
    uid: string | null;        // signed in and syncing as
    owner: string | null;      // the account this device's data came from (null = guest data)
    stamps: Record<RecordKey, string>;   // updatedAt of each record as last synced or changed here
    hashes: Record<RecordKey, string>;   // recordHashes at the last sync
    tombstones: Record<RecordKey, string>; // deleted here, at
    changedWhileSignedOut: boolean;
  };
  export const EMPTY_SYNC_STATE: SyncState;
  export function loadSyncState(storage: Storage | null): SyncState;
  export function saveSyncState(storage: Storage | null, s: SyncState): void;
  export function stampLocalChanges(s: SyncState, current: Records, now: Date): SyncState; // compares hashes; new/changed → stamp now; vanished → tombstone now
  // linkDecision.ts
  export type LinkDecision = "upload" | "take" | "rejoin" | "picker" | "backup-and-take";
  export function decideLink(input: { uid: string; state: SyncState; localHasProjects: boolean; remoteHasProjects: boolean }): LinkDecision;
  ```

- [ ] **Step 1: Write the failing tests.**
  - `syncState`:
    - `"bad or missing saved state gives the empty state"`;
    - `"a changed record is stamped now, a removed one gets a tombstone, an unchanged one keeps its stamp"`;
    - `"saving and loading round-trips"`.
  - `linkDecision`, one test per row:

    | owner | uid | changedWhileSignedOut | local projects | remote projects | expected |
    |---|---|---|---|---|---|
    | null | u1 | – | yes | no | `upload` |
    | null | u1 | – | no | yes | `take` |
    | null | u1 | – | no | no | `upload` |
    | null | u1 | – | yes | yes | `picker` |
    | u1 | u1 | false | any | any | `rejoin` |
    | u1 | u1 | true | yes | yes | `picker` |
    | u1 | u1 | true | yes | no | `upload` |
    | u2 | u1 | any | any | any | `backup-and-take` |

    The last row is `"another account's data is backed up, never uploaded or offered"`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3: Implement** to match the table.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5: Commit:** `feat(sync): per-device sync state and what to do when an account connects`.

---

### Task 5: Interfaces, fakes, and `replaceData` on the store

**Files:**
- Create: `web/src/sync/remote.ts`, `web/src/sync/auth.ts`, `web/src/test/fakeRemote.ts`, `web/src/test/fakeAuth.ts`
- Modify: `web/src/store/useStudium.tsx`, adding `replaceData`
- Test: `web/src/store/useStudium.test.tsx` (adds tests)

**Interfaces:**
- Produces:
  ```ts
  // remote.ts
  export type RemoteChange =
    | { kind: "upsert"; key: RecordKey; updatedAt: string; value: unknown }
    | { kind: "delete"; key: RecordKey; updatedAt: string };
  export interface RemoteStore {
    load(uid: string): Promise<StampedRecords | null>;              // null = account has nothing yet
    write(uid: string, changes: RemoteChange[], meta: { savedAt: string; savedBy: string }): Promise<void>;
    subscribe(uid: string, onRemote: (r: StampedRecords) => void): () => void;
    replaceAll(uid: string, r: StampedRecords, meta: { savedAt: string; savedBy: string }): Promise<void>; // the picker chose this device: remote becomes exactly r
    deleteAll(uid: string): Promise<void>;
    savedInfo(uid: string): Promise<{ savedAt: string; savedBy: string } | null>;
  }
  // auth.ts
  export type Account = { uid: string; email: string | null; createdAt: string };
  export type AuthError = "wrong-password" | "no-account" | "email-in-use" | "weak-password" | "network" | "needs-recent-sign-in" | "cancelled" | "other";
  export interface AuthClient {
    current(): Account | null;
    onChange(cb: (a: Account | null) => void): () => void;
    signInEmail(email: string, password: string): Promise<Account>;
    createEmail(email: string, password: string): Promise<Account>;
    resetPassword(email: string): Promise<void>;
    signInGoogle(): Promise<Account>;
    signInApple(): Promise<Account>;
    signOut(): Promise<void>;
    deleteAccount(): Promise<void>;
  }
  // useStudium.tsx: added to the returned object
  replaceData(next: StudiumData): boolean; // validates, saves, sets state; false = invalid, nothing changed
  ```
  `FakeRemote` keeps an in-memory `StampedRecords` per uid and exposes `fake.push(uid, r)` to simulate another device. `FakeAuth` has `fake.signInAs(account)`, and `fake.fail(method, error)` makes the next call reject with `{code: AuthError}`.

- [ ] **Step 1: Write the failing tests:**
  - `"replaceData saves valid data and returns true"`;
  - `"replaceData refuses invalid data and changes nothing"`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3: Implement** `replaceData`. It uses `isValidData` + `normalizeData`, then the same path as the `storage` listener (`dataRef`, `setData`, `saveData`, `setNow`). Then write the interfaces and fakes.
- [ ] **Step 4:** Run the whole web suite. Expected: PASS.
- [ ] **Step 5: Commit:** `feat(sync): auth and remote interfaces, test fakes, replaceData`.

---

### Task 6: The sync engine

**Files:**
- Create: `web/src/sync/syncEngine.ts`, `web/src/sync/saveSummary.ts`
- Test: `web/src/sync/syncEngine.test.ts`, `web/src/sync/saveSummary.test.ts`

**Interfaces:**
- Consumes: Tasks 2–5.
- Produces:
  ```ts
  export type SaveSummary = { savedAt: string | null; savedBy: string | null; projects: number; tokens: number; tasksDone: number; petsGrownUp: number;
    pets: { name: string; kind: PetKind; stage: PetStage }[] }; // the first 3; `more` = the rest
  export function summarize(data: StudiumData, saved: { savedAt: string; savedBy: string } | null): SaveSummary & { more: number };
  export function hasMoreProgress(a: SaveSummary, b: SaveSummary): boolean; // tasksDone, then tokens, then projects

  export type EngineDeps = { remote: RemoteStore; storage: Storage | null; clock: () => Date; device: string;
    getLocal: () => { data: StudiumData; settings: SyncedSettings };
    applyLocal: (data: StudiumData, settings: SyncedSettings) => boolean; // replaceData + updateSettings
  };
  export type ConnectResult = { kind: "synced" } | { kind: "picker"; local: SaveSummary & {more:number}; account: SaveSummary & {more:number} };
  export function createSyncEngine(deps: EngineDeps): {
    connect(uid: string): Promise<ConnectResult>;           // runs decideLink and acts on it, except for the picker
    choose(uid: string, keep: "local" | "account"): Promise<void>; // picker answer; backs up the one not kept
    localChanged(): void;                                    // call after each local save
    stop(): void;                                            // sign-out: unsubscribe, uid = null
    lastSyncedAt(): string | null;
  };
  ```

- [ ] **Step 1: Write the failing tests**, with `FakeRemote`, `memoryStorage()` from `test/render.tsx`, and a fixed clock:
  - `"upload: a guest's data goes up on first link and owner becomes the account"`;
  - `"take: a fresh device gets the account's data"`;
  - `"rejoin: changes made elsewhere are merged in"`;
  - `"picker: both have projects → returns both summaries and changes nothing yet"`;
  - `"choose local: remote becomes this device's data; a backup of the account's data is written"`;
  - `"choose account: local becomes the account's; a backup of local is written under BACKUP_PREFIX"`;
  - `"backup-and-take: another account's data is backed up and replaced"`;
  - `"a local change is pushed with updatedAt = when it happened"`;
  - `"a deleted task is pushed as a delete and stays deleted after a remote snapshot"`;
  - `"an invalid remote task is ignored and local data stays"`;
  - `"after stop(), late remote snapshots are ignored"`;
  - `"changes while signed out set changedWhileSignedOut"`;
  - `"two offline purchases that overspend keep both, the balance shows negative, and the next purchase is refused"`. Use `tokenBalance`, then `A.purchase(...)`, which returns `ok: false`. Also check that the Shop shows the negative number rather than clamping it to 0; fix the display if it clamps.

  For `saveSummary`:
  - `"counts projects, tokens, done tasks and adult pets, lists 3 pets and how many more"`;
  - `"the save with more done tasks has more progress"`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - `connect` loads the remote, runs `decideLink`, and acts on the decision.
  - While connected, it subscribes. On each snapshot, it merges and drops any record that fails validation (checked by assembling with `fromRecords` and running `isValidData`). If the result differs, it calls `applyLocal`. Then it writes `pushToRemote` and updates the stamps and hashes.
  - `localChanged`: debounce 1 s, run `stampLocalChanges`, and write the changed keys. While signed out, it only sets `changedWhileSignedOut` when `owner` is set.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5: Commit:** `feat(sync): sync engine and save summaries`.

---

### Task 7: Firestore and Firebase Auth adapters

**Files:**
- Create: `web/src/sync/config.ts`, `web/src/sync/firestoreRemote.ts`, `web/src/sync/firebaseAuth.ts`
- Modify: `web/package.json` (dependency `firebase`)
- Test: `web/src/sync/firestoreRemote.test.ts`

**Interfaces:**
- Consumes: the layout from Task 1, and `RemoteStore` and `AuthClient` from Task 5.
- Produces:
  ```ts
  export const FIREBASE_CONFIG: FirebaseOptions | null; // config.ts: the object the user pasted in Task 1
  export function createFirestoreRemote(app: FirebaseApp): RemoteStore;
  export function createFirebaseAuth(app: FirebaseApp, opts: { browserSignIn?: (provider: "google" | "apple") => Promise<{ idToken: string; accessToken?: string; rawNonce?: string }> }): AuthClient;
  export function batchChanges<T>(changes: T[], size?: number): T[][]; // default 450
  ```

- [ ] **Step 1: Write the failing tests:**
  - `"a first upload of 1,200 records uses 3 batches"` (`batchChanges`);
  - `"record keys map to the right document paths"`, using a pure helper `docPath(uid, key, data)` that is exported for the test:
    - `task:t1` of project p1 → `projects/p1/tasks/t1`;
    - a purchase event → `users/u1/events/<id>`;
    - `user` → `users/u1`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Firestore: use `initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })`. Project docs are created with `members: [uid], owner: uid`. Every project event gets `by: uid`.
  - `subscribe`: listen to `users/{uid}`, `users/{uid}/events`, `projects where members array-contains uid`, and each project's three subcollections. Rebuild `StampedRecords` after any change, debounced 300 ms.
  - Auth:
    - map Firebase error codes to `AuthError`;
    - `createdAt` = `user.metadata.creationTime`;
    - Google and Apple use `signInWithPopup` on the web, or `browserSignIn` + `signInWithCredential` when it's provided.
- [ ] **Step 4:** Run. Expected: PASS. Then run `npx tsc --noEmit`. Expected: clean.
- [ ] **Step 5: Commit:** `feat(sync): Firestore and Firebase Auth adapters`.

---

### Task 8: Account context, sign-in dialog, Settings → Account, and the picker

**Files:**
- Create: `web/src/sync/AccountProvider.tsx`, `web/src/components/SignInDialog.tsx`, `web/src/components/AccountSection.tsx`, `web/src/components/SavePicker.tsx`
- Modify:
  - `web/src/components/Settings.tsx`: replace the Account section's "Email / Not set yet" with `<AccountSection/>`;
  - `web/src/App.tsx`: wrap in `<AccountProvider>`;
  - `web/src/ui/format.ts`: the copy from Global Constraints.
- Test: `web/src/components/AccountSection.test.tsx`, `SignInDialog.test.tsx`, `SavePicker.test.tsx`

**Interfaces:**
- Consumes: `createSyncEngine`, `AuthClient`, `RemoteStore`.
- Produces:
  ```ts
  export function AccountProvider(props: { children: ReactNode; auth?: AuthClient | null; remote?: RemoteStore | null }): JSX.Element; // defaults built from FIREBASE_CONFIG; null config → accounts off
  export function useAccount(): {
    enabled: boolean; account: Account | null; lastSyncedAt: string | null;
    picker: null | { local: SaveSummary & {more:number}; account: SaveSummary & {more:number} };
    openSignIn(reason?: "link" | "companion" | "purchase" | "collab"): void;
    choose(keep: "local" | "account"): Promise<void>;
    signOut(): Promise<void>; deleteAccount(): Promise<void>;
  };
  ```
  `SignInDialog` has tabs or a toggle for **Sign in** and **Create account**, plus **Forgot password?**, **Continue with Google** and **Continue with Apple**. The reason line comes from `reason`, and the bonus line is shown each time.

- [ ] **Step 1: Write the failing tests**, rendering with `FakeAuth` and `FakeRemote`:
  - `"with accounts off, the Account section shows no Link account button"`;
  - `"a guest sees Link account and the bonus line; signing in with email links and shows the email and Last synced"`;
  - `"wrong password shows 'That password isn't right.' and stays open"`;
  - `"Forgot password sends the reset email and says so"`;
  - `"both devices have projects → the picker shows both cards with counts, pets, saved time and the More progress tag on the right one"`;
  - `"Keep my account's replaces local data and leaves a backup"`;
  - `"Sign out keeps the projects on screen and shows Link account again"`;
  - `"Delete account asks to confirm, then removes cloud data and leaves the device as a guest"`;
  - `"Delete account that needs a recent sign-in asks to sign in again"`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Follow the existing components' styles (`ui/styles.ts`: CARD, BUTTON_PRIMARY, SERIF), and lay the picker out as in mockup option A.
  - Call `engine.localChanged()` from an effect on `studium.data` and the synced settings.
  - `deleteAccount` = `remote.deleteAll(uid)`, then `auth.deleteAccount()`, then sync state `uid = null, owner = null`.
- [ ] **Step 4:** Run the whole web suite plus `npx tsc --noEmit`. Expected: PASS and clean.
- [ ] **Step 5: Commit:** `feat(accounts): sign in, link, sign out, delete, and the two-saves picker`.

---

### Task 9: "Already use Studium? Sign in" in setup

**Files:**
- Modify: `web/src/components/Setup.tsx`
- Test: `web/src/components/Setup.test.tsx`

- [ ] **Step 1: Write the failing tests:**
  - `"with accounts on, step 1 offers 'Already use Studium? Sign in'"`;
  - `"signing in there loads the account, sets setupDone and tutorialDone, and finishes setup"`;
  - `"with accounts off, the link isn't shown"`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3: Implement.** After a successful sign-in from setup, once `connect` resolves (or the picker is answered), call `s.updateSettings({ setupDone: true, tutorialDone: true, shopTutorialDone: true })`, then `onFinish()`.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5: Commit:** `feat(accounts): sign in from first-run setup`.

---

### Task 10: Hosting, and pointing the extension at it

**Files:**
- Modify:
  - `extension/content/logic.js`: `HOMEPAGE_URL` becomes `https://<projectId>.web.app/`. Keep `http://localhost:5173/` recognised by `isStudiumUrl` for development.
  - `extension` logic tests in `web/src/extension/petLogic.test.ts`.
  - `README.md`: the web app's address.
- Test: `web/src/extension/petLogic.test.ts`

- [ ] **Step 1: Write the failing test:** `"isStudiumUrl accepts the hosted app and localhost"`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3: Implement.** Then add the hosted domain under **Authentication → Settings → Authorized domains** if it isn't already there (the user does this; give them the step).
- [ ] **Step 4:** Run `cd web && npm run build && cd .. && firebase deploy --only hosting`. Expected: the hosted URL loads Studium. Then by hand: link an account there, then open the local dev app, sign in, and see the same projects.
- [ ] **Step 5: Commit:** `feat(web): host Studium on Firebase and point the extension at it`.

---

### Task 11: Desktop sign-in through the browser (Google)

**Files:**
- Create:
  - `desktop/src/main/browserSignIn.js`;
  - `web/desktop-sign-in.html` and `web/src/desktopSignIn.tsx` (a second Vite input in `web/vite.config.ts`).
- Modify:
  - `desktop/src/preload/studium.js`: expose `signInWithBrowser(provider)` on `studiumDesktop`;
  - `desktop/src/main/main.js`: the `ipcMain.handle('auth:browser', ...)` handler;
  - `web/src/vite-env.d.ts`;
  - `web/src/sync/AccountProvider.tsx`: pass `browserSignIn` when `window.studiumDesktop?.signInWithBrowser` exists.
- Test: `desktop/test/browserSignIn.test.js`, `desktop/e2e/account.spec.js`

**Interfaces:**
- Produces:
  ```js
  // browserSignIn.js
  function startBrowserSignIn({ provider, hostedUrl, openExternal, timeoutMs = 300000 }) // → Promise<{ idToken, accessToken?, rawNonce? }>
  ```
  - It listens on `127.0.0.1:0` (a random port) and makes a random 32-byte hex `state`.
  - It opens `${hostedUrl}desktop-sign-in.html?provider=google&port=<port>&state=<state>`.
  - It resolves on `GET /callback?state=…&idToken=…`, and only when the state matches; the browser gets a "You can close this tab" page. It rejects with `"cancelled"` on timeout and closes the server either way.
  - The hosted page runs `signInWithPopup` and gets the credential with `GoogleAuthProvider.credentialFromResult`. Then it redirects to `http://127.0.0.1:<port>/callback?...`.

- [ ] **Step 1: Write the failing tests:**
  - `"resolves with the tokens when the callback has the right state"`;
  - `"ignores a callback with the wrong state"`;
  - `"rejects with cancelled after the timeout and stops listening"`.

  Use an injected `openExternal` that performs the callback `fetch` itself.
- [ ] **Step 2:** Run `cd desktop && npx vitest run test/browserSignIn.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.** Also add the e2e test `"Settings shows Link account in the desktop app"`, which only checks that the button is there; there's no network in e2e.
- [ ] **Step 4:** Run the desktop unit tests, then `npm run test:e2e`. Expected: PASS. Then by hand: in `npm start`, Continue with Google opens the browser, and the app shows the account after approving.
- [ ] **Step 5: Commit:** `feat(desktop): Google sign-in through the browser`.

---

### Task 12: Sign in with Apple (first to cut)

The user's steps in the Apple Developer account and Firebase, given to them word for word:
1. Under **Certificates, IDs & Profiles → Identifiers**, add a **Services ID**, `com.studium.signin`, and enable **Sign in with Apple**. Configure it with:
   - domain `<projectId>.firebaseapp.com`;
   - return URL `https://<projectId>.firebaseapp.com/__/auth/handler`.
2. Under **Keys**, make a new key with **Sign in with Apple**, download the `.p8`, and note the Key ID and Team ID.
3. In Firebase, under **Authentication → Sign-in method**, enable **Apple** and fill in the Services ID, Team ID, Key ID and the `.p8` contents.

**Files:**
- Modify:
  - `web/src/sync/firebaseAuth.ts`: `signInApple`, with `OAuthProvider('apple.com')`, scopes `email` and `name`;
  - `web/src/desktopSignIn.tsx`: `provider=apple`.
- Test: `web/src/components/SignInDialog.test.tsx` (`"Continue with Apple signs in"` with FakeAuth)

- [ ] **Step 1: Write the failing test.** Run it. Expected: FAIL. Implement it, then run it again. Expected: PASS.
- [ ] **Step 2:** By hand: Apple sign-in on the hosted web app, then in the desktop app.
- [ ] **Step 3: Commit:** `feat(accounts): Sign in with Apple`.

---

### Task 13: Docs, version, installer

**Files:**
- Modify:
  - `README.md`: "Accounts and sync": optional, how to link, what syncs, where backups go;
  - `HANDOFF.md`: the sync layer's map, the Firestore layout, and the rules tests command;
  - `desktop/package.json`: bump the minor version;
  - `docs/ROADMAP.md`: mark accounts done.

- [ ] **Step 1:** Run everything:
  - `cd web && npx vitest run && npx tsc --noEmit`;
  - `cd firebase && npm test`;
  - `cd desktop && npx vitest run && npm run test:e2e`.

  Expected: all pass.
- [ ] **Step 2:** Check by hand across two devices: the web app plus the Windows app.
  - Link on one, then see the projects on the other.
  - Complete the same task on both while offline, then reconnect. It's paid once.
  - Delete a task on one and edit it on the other. It stays deleted.
  - Sign out, change something, then sign in. The picker appears.
  - A second account on the same computer gets no data from the first.
- [ ] **Step 3:** Bump the version, run `npm run dist`, and run `STUDIUM_PACKAGED=1 npx playwright test e2e/packaged.spec.js`. Expected: pass.
- [ ] **Step 4: Commit:** `docs: accounts and sync`, and `chore(desktop): version <x>`.

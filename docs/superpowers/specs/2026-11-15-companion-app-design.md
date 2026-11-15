# Studium companion phone app: design

_Approved by the owner 2026-11-15. Written 2026-11-15 from a brainstorm with the project owner. Mockups:
[companion-screens.png](../../companion/mockups/companion-screens.png),
[pets-tab-choice.png](../../companion/mockups/pets-tab-choice.png)._

## Why

Studium lives on the computer: the web app, the desktop app with its pets on the screen, the browser
extension. Away from the computer there's no way to see how your pets are doing, check today's list,
or jot down a task the moment you think of it. The companion app is a small phone app for exactly
that: **check on your pets and projects at a glance, and work with today's to-do list.** Later it
also sends reminders.

It is a companion, not a second Studium. The desktop stays where you plan, decorate and care for pets.

## Deadline and what success looks like

- **December 3, 2026**: capstone final, about a one-hour slot with a live demo.
- Success on December 3 (in the owner's order of importance):
  1. **Adding a task on the phone works**, and it shows up on the desktop.
  2. **Pet and project information on the phone is accurate**: it matches what the desktop shows.
- **Notifications are not part of December 3.** They can't be demoed well in an hour. They are
  phase 2 (below) and come after.
- Work starts now (Nov 15).

## Goals (phase 1, by Dec 3)

1. Sign in to the same Studium account as the desktop and web app, and stay signed in.
2. **Pets tab**: every pet, grouped by project, each with its own mood, what it looks after, and its
   meal info. A "Needs you on the desktop" list at the top.
3. **Today tab**: today's plan from the desktop; tick tasks off; quick add a task.
4. **Pending tasks**: a task added on the phone waits in a new Pending section on the desktop and web
   app until its details are filled in.
5. **Optional task due dates** on desktop and web (used for reminders in phase 2).
6. Runs on iPhone (most users, including the owner) and Android (the Linux tester).

## Phase 2 (after Dec 3)

- Phone notifications, in two types the user can switch on or off separately in Settings, **both on
  by default**:
  - **Due dates**: tasks with their own due date, requirements, and project deadlines. Two reminders
    by default: one a day or two before (user picks; default **2 days before**) and one on the day
    (user picks the time; default **9:00 AM**).
  - **Pet care**: a sick pet needs medicine; a pet hasn't had its meal today (a meal gives × 1.1
    tokens for 4 hours); snack suggestions for a struggling pet.
- The Settings tab already exists in phase 1 (sign-out, account), so phase 2 adds to it.

## Non-goals

- **No habitats on the phone**, and no decorating. That stays a desktop reason to open Studium.
- **No pet care on the phone**: no feeding, medicine, Shop, or eggs. The phone only shows what's
  needed and says to do it on the desktop.
- No creating or editing projects or requirements on the phone. No full task editing (requirement,
  estimate, blockers) on the phone: that's what Pending is for.
- No focus sessions or blocking on the phone.
- Not an App Store release by Dec 3 (see "Sign-in and the App Store").

## Anti-goals (would make it a failure even if it "works")

- The phone shows a mood, meal state or list that **differs from the desktop**. Accuracy beats
  features. The phone must work these out with the same code the web app uses, not a copy.
- A phone write that **breaks the account's data** or gets refused and lost silently (see Sync).
- Quick add that's slow or fiddly. It should take a few seconds: a name and a project.

## The screens

Three tabs: **Pets**, **Today**, **Settings**. (The owner chose a Pets tab over a Projects tab
because a project can have more than one pet, and each pet has its own mood.)

### Pets

- Pets are grouped under their project. The group header shows the project name and its deadline.
- One card per pet, in the order the desktop lists them (the project's own pet first, then pets
  bought in the Shop). Each card shows:
  - the pet's art (the real pet images from the desktop, not emoji) and its name;
  - **what it looks after**: "the whole project", or the requirement it cares for and that
    requirement's due date;
  - its **mood** (Proud, Delighted, Happy, Worried, Upset, Sick, with Recovering as the desktop shows
    it), worked out per pet, including a snack's lift;
  - **meal info, worded like the desktop's food panel**: while a meal boost runs, "Meal: × 1.1 tokens
    for 2h 40m more"; when it's been fed today, "Next meal tomorrow"; while a snack lifts its mood,
    that and how long is left.
  - An egg shows as an egg with "Hatches as you work on <project>".
- **Needs you on the desktop** (top of the tab, only when there's something): sick pets first
  ("Biscuit is sick: give medicine"), then upset pets, then meal suggestions for pets that can eat
  today. Tapping an item explains it; it doesn't do the care.
- Tapping a project header could show its requirements and tasks with due dates (owner liked this in
  the first mockup). **Nice to have for Dec 3**, not required.

### Today

- Today's plan (`data.today`, which already syncs), in the desktop's order. Each row: title, project
  colour and name, estimate, and its due date if it has one.
- **Ticking a task off** completes it the same way the desktop does (same tokens, mood and pet
  growth). Unticking reopens it.
- **Pending** section: tasks added on the phone that still need details.
- **Quick add**: a name, a project, and an **"Also add to today" choice** (owner's call; whether it
  starts on or off is my call: **off**). The task goes to Pending, and onto today's plan too if the
  user chose that, where it shows in the list like any other task, marked as pending.

### Settings

- Phase 1: the signed-in account and sign out.
- Phase 2: the notification switches and reminder timing above.

## Changes to the desktop and web app (do these first)

The phone depends on these, so they ship first, as a new desktop version (bump the version) and a web
deploy.

### Pending tasks

- A task added on the phone is **pending**: it has a title and a project, and no requirement or
  estimate yet.
- The desktop and web app show a **Pending** section listing them, where the user adds the
  requirement and estimate. Once both are set it's an ordinary task.
- While pending, a task **earns no tokens, doesn't count toward any mood, and Studium never
  suggests it for today's plan** (the user can still put it there, from the phone's quick add or by
  hand).
- A pending task can still be deleted on the desktop.

### Optional task due dates

- A task can have its own due date, or none. Without one it uses its requirement's date (which
  falls back to the project deadline), as now.
- **A task's due date can't be later than its requirement's due date.**
- Used **only for reminders**. It does not change mood, the plan, or tokens.
- Editable on the desktop and web app. Shown on the phone's Today rows.

### Older versions

Studium 0.11.0 is out with testers. A device on an older version must not damage pending tasks or
task due dates. Checked 2026-11-15: the current load check (`web/src/store/storage.ts`, the task
loop) ignores fields it doesn't know, and edits copy the task with `...t`, so a new optional field
survives an older version. Two things to keep it that way:

- A pending task must still pass the old check: `requirementId: null`, a number in `estimateMin`
  (e.g. 0), `blockedBy: []`, `priority`/`done` booleans, `actualMin: null`. An older version then
  shows it as an ordinary unlinked task, which is acceptable.
- The new fields are optional (missing = not pending, no due date), like `stage` and `type` on
  projects.

The builder confirms the Firestore side (`web/src/sync/records.ts`, `firestoreRemote.ts`) keeps
unknown task fields too.

## Sync

- The phone signs in to the same Firebase account and reads and writes the same Firestore data as
  the desktop and web app.
- It follows the existing rules: every document it writes carries the save label (`gen`) of the
  account's current save. A phone that was offline while the save was replaced must not have its
  queued writes lost silently: the same handling as the other devices (refused, then take the
  account's copy).
- The phone only writes: task completed / reopened, new pending task, and the events those already
  produce. Nothing else.
- The Firestore rules may need no change if the phone writes through the same code. If they do
  change, rules and hosting are deployed together, as before.

## Sign-in and the App Store

- Studium accounts use Google sign-in and email and password. Sign in with Apple exists but is
  switched off (`APPLE_SIGN_IN_ENABLED = false`).
- For Dec 3: **email and password must work.** Google sign-in on the phone too if time allows.
- **Apple requires an app that offers Google sign-in to also offer Sign in with Apple** before it can
  go on the App Store. That's why there's no App Store release by Dec 3. Testers install through
  **TestFlight** (iPhone; the owner has an Apple Developer account) and a **direct download**
  (Android). Setting up Sign in with Apple (already on the to-do list) comes before any App Store
  release.

## How it gets made

- **React Native with Expo**, one app for iPhone and Android. _My call, owner agreed:_ it uses the
  same language as the web app (TypeScript), so the phone can use the web app's planner and store
  code directly (`web/src/planner`, `web/src/store/actions.ts`), which is how moods and lists stay
  identical. That code doesn't depend on the web page.
- Phase 2 notifications are scheduled **on the phone** from the due dates and pet state it already
  has, so no server is needed and they arrive offline.
- Where the app lives in the repo, how the shared code is shared, and the build setup are the
  builder's call.

## Decided by me, not the owner (check these)

- Default early reminder **2 days before**, on-the-day time **9:00 AM** (owner said "a day or two").
- Order of the Needs-you list: sick, then upset, then meal suggestions.
- The project header's tap-through to requirements and tasks is nice to have, not required.
- Ticking a task off on the phone shows a small "How long did it take?" like the desktop's
  completion prompt (`CompletionPrompt.tsx`), prefilled, with a skip that leaves it empty. Then it
  shows the tokens earned, as the desktop does.
- A pending task can be ticked off on the phone (for something done straight away, like "email the
  TA"). It earns no tokens, since it has no requirement.
- Pending tasks show on the phone's Today tab as well as the desktop.
- Quick add's "Also add to today" starts **off**.
- Email and password sign-in is the must-have; Google sign-in is a stretch for Dec 3.

## Left to the builder

- Repo layout, how shared code is packaged, state management on the phone.
- How "pending" and the task due date are stored, as long as older versions don't damage them.
- Visual design, matching the desktop's look (colours and fonts in `web/src/index.css`).
- Test approach.

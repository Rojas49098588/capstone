# Hand-check checklist

Everything that has passed automated tests but still needs a person to try it. Tick each box as it passes. If something fails, write what happened next to it.

## Before you start (Studium desktop app)

- **Install once: `C:\Users\legit\StudiumBuilds\Studium Setup 0.7.0.exe`.** It includes Weeks 1–3, so you don't need the older installers. If Windows warns you, click "More info → Run anyway".
- **Use a project with a hatched pet.** For the pet family part, you need at least 400 tokens to buy an egg.
- **Speed-up settings** go in `%APPDATA%\Studium\pet-state.json`. Quit Studium from the tray first, then add them inside the top-level `{ }`:
  - `"petTimingOverride": { "napMinutes": 1 }` makes naps last 1 minute.
  - `"petTimingOverride": { "napMinutes": 1, "mischiefMinutes": 1 }` also makes mischief happen about every minute.
  - Remove them when you're done.

---

## 1. Window, tray and startup (Week 1)

- [ ] Studium opens after installing.
- [ ] Closing the window leaves the Studium icon in the tray.
- [ ] Tray → Open Studium brings the window back.
- [ ] Right-clicking the taskbar button shows Quit Studium, and it quits.
- [ ] Settings → "Start Studium when your computer starts" is on. After restarting the PC, Studium is running.
  - [ ] With "start quietly" chosen, it starts in the tray with no window.
  - [ ] With "open the window" chosen (the default), the window opens.
- [ ] After turning "Start Studium when your computer starts" off, the next restart doesn't open Studium.
- [ ] Tray → Quit ends the app: the tray icon is gone and no pets are left on the desktop.

## 2. Pets on the desktop (Week 2)

- [ ] With Studium closed to the tray, pets walk along the top of the taskbar.
- [ ] Desktop icons, the taskbar and other apps can be clicked right next to a pet.
- [ ] Typing in Word or a browser keeps going while you click or drag a pet.
- [ ] You can drag a pet and throw it over another app.
- [ ] Clicking a pet makes it hop and talk.
- [ ] Each right-click menu item works:
  - [ ] What should I work on?
  - [ ] Nap
  - [ ] Sleep 1 h
  - [ ] Open project
- [ ] The menu closes when you click elsewhere.
- [ ] A nap ends (with `napMinutes: 1`), the pet asks how it went, and your answer shows up in Studium.
- [ ] Completing a task in Studium makes that project's pet celebrate on the desktop.
- [ ] A project page shows its pet in the habitat, using its bed or furniture.
  - [ ] That pet isn't on the desktop until you close or minimize the window.
- [ ] Tray → Hide pets / Show pets works.
- [ ] Tray → Wake works.
- [ ] Settings → "Pets on screen at once" changes how many pets show.
- [ ] Settings → Minimal / Mild / Moderate changes how the pets behave.
- [ ] On Moderate, notes appear and close with ×.

## 3. Nap asks which task, and ends when the task is done

- [ ] Nap asks "What are you going to work on while I nap?" and lists that project's Today tasks, then up to 5 suggested ones, then "Just nap".
- [ ] Picking a task starts the nap, and the time shows as focus time on that task's project.
- [ ] "Just nap" starts a nap with no task.
- [ ] When a project has no open tasks, Nap starts right away without asking.
- [ ] Ignoring the question for 60 seconds makes it go away, and no nap starts.
- [ ] Checking off the nap's task in Studium wakes the pet early. It hops and says "Congrats! You finished <task>! 🎉" with a "Yay!" button.
- [ ] Checking off a different task, or a task during a "Just nap", doesn't wake it.

## 4. Mischief (Week 3)

Set Moderate and `"mischiefMinutes": 1` first.

- [ ] A note appears on the desktop, signed and in the project's color.
- [ ] Notes go away after 15 minutes. Remove the override to time this, or trust the test.
- [ ] Some notes are carried in from the edge of the screen.
- [ ] A pet chases the cursor and pounces when the cursor stops.
- [ ] Moving the cursor onto the taskbar ends the chase.
- [ ] With an Upset or Sick pet, Studium appears at its project while you type in Word.
  - [ ] The typing keeps going in Word.
  - [ ] A minimized Studium stays minimized.
- [ ] Clicking pets plays sounds, at most one every 30 seconds.
- [ ] Settings → "Pet sounds" off silences them.
- [ ] During a nap there are no notes, chases, sounds or Studium pop-ups.
- [ ] On Mild and Minimal, none of the mischief above happens.

## 5. Pet family in the Studium window (Part 1)

- [ ] An existing project's habitat looks the same as before.
- [ ] Shop → Pets shows five eggs.
- [ ] Buying an egg lowers your balance by 400.
- [ ] Buying is refused, with a reason, when a project already has 4 pets or already has an egg waiting.
- [ ] The project page shows a second habitat with the egg, plus the "Want another companion?" line below.
- [ ] Decor can be placed in the second habitat.
- [ ] Decor can be removed from the second habitat.
- [ ] The Inventory screen lets you pick which habitat to decorate.
- [ ] Finishing half of one requirement's tasks hatches the egg, with a toast.
- [ ] Naming the pet and choosing a requirement for it to care about updates its habitat header.
- [ ] A pet that cares about a requirement shows its own mood, based on that requirement.
- [ ] Medicine for that pet works on its own.
- [ ] When the requirement it cares about is finished or deleted, the pet goes back to caring about the whole project.
- [ ] Finishing half of the first pet's tasks grows it to full size, with a toast.

## 6. Pet family on the desktop (Part 2, version 0.7.0)

- [ ] After updating from 0.6.0, existing pets keep their spots and any nap in progress.
- [ ] A bought, hatched pet roams the desktop with its own name.
- [ ] Its right-click menu, naps and mischief all work.
- [ ] Bought pets count toward "Pets on screen at once".
- [ ] Napping it with a task adds the session to that project's focus time.
- [ ] Open project scrolls Studium to that pet's habitat.
  - [ ] It works for a bought pet.
  - [ ] It works for a first pet.
  - [ ] It works when Studium was closed or on another page.
- [ ] With the project page open, all of that project's pets are in their boxes and none are on the desktop.
- [ ] Minimizing the window sends them back to the desktop.
- [ ] A pet looking after a requirement suggests that requirement's tasks under "What should I work on?".
- [ ] That pet's nap list only offers that requirement's tasks.

---

## 7. Mustang Closet app (overdue bugs in `App Dev/bugs.md`)

These are for the other app. Once a list passes, move its bug to **Fixed** in `App Dev/bugs.md`.

### Supabase backend (opened 2026-09-30, 32 days old)

Use two devices, or a phone plus `npm run web`.

- [ ] A member flags an item, and it shows on the staff device's Sections/Inventory within a few seconds, without refreshing.
- [ ] Staff sets the halftime combo, and the member's Game Day updates live.
- [ ] Staff adds a combo with a photo, and it shows, with the photo, on the other device.
- [ ] In the SQL editor, run `update public.games set pre_game_combo_id = null where is_current;`. Game Day shows "No combo set" for Pre-game. Then restore it with `update public.games set pre_game_combo_id = '00000000-0000-4000-8000-000000000001' where is_current;`.
- [ ] In airplane mode, cached data shows with "Offline — showing data from HH:MM" above the tab bar.
  - [ ] Each of these shows the "You're offline" alert: Flag item, Save combo, Set for pregame, Update, Promote, Change password.
  - [ ] After reconnecting, the banner clears and the data refreshes.
- [ ] A wrong invite code is rejected on the Invite Code screen.
- [ ] Force-closing and reopening while logged in lands you in the signed-in tabs.
- [ ] Staff promotes a member from Member Profile, and the member's open app switches to the staff view.

### Import and adding inventory (opened 2026-10-24, 8 days old)

Use `npm run start:test` against the TEST project.

- [ ] Run `npm run test:members -- <your 5–10 row CSV>`, then sign in as staff in Expo Go.
- [ ] Inventory "+" → Import spreadsheet → pick the CSV from Box.
  - [ ] The preview shows the types, pieces, numbers, notes and problems you expect.
  - [ ] Import shows a summary.
- [ ] Importing the same file again says "Everything in this sheet is already in the app."
- [ ] Inventory shows assigned / unassigned / out-for-repair chips.
- [ ] The "See every Coats" table is filled in.
- [ ] An imported note shows in the piece's history as "from spreadsheet".
- [ ] Signed in as a test member, My Inventory shows their pieces and numbers.
- [ ] That member can't see the imported note.
- [ ] "+" → New piece type (Pants, two colors, a short range) appears in Inventory.
- [ ] Add color to Coats adds the color to every number.
- [ ] Add number adds new chips.
- [ ] On this data, the checklists from Plans 1 and 2 still pass: flags with photos, history, clearing, out-for-repair, and the number editor.

## 8. Food (Berry Bites and Power Bento)

Buy two of each in Shop → Supplies. Use a project whose pet is **Worried** or **Upset** (fall a little behind plan).

- [ ] In the Shop, each food card has a "What it does" box.
- [ ] The pet's habitat has a **Food** section with "Feed Berry Bites" and "Feed Power Bento".
- [ ] Feed Berry Bites to a Worried pet. Its mood goes up one step and reads "Happy (Worried, lifted by a snack)".
- [ ] The Food section shows "Snack: lifting mood for 2h 0m more" and "Next snack in 2h 0m". The snack button is greyed out with the wait time on it.
- [ ] The desktop pet's mood matches the habitat's.
- [ ] About two hours later, the lift is gone and the mood matches the schedule again.
- [ ] A Happy pet's snack button says "Not hungry".
- [ ] Feed Power Bento. The section shows "Meal: × 1.1 tokens for 4h 0m more" and "Next meal tomorrow". Finishing a task in that project while the boost runs pays a little more.
- [ ] After midnight, the same pet can eat another meal.
- [ ] On a project with a second (bought) pet, feeding it a Power Bento while the boost runs says "Boost already on: this adds 4 hours instead of doubling it". The time left grows by 4 hours, and the boost stays × 1.1.
- [ ] A Sick pet, a pet recovering from medicine, and an egg have no Food section.
- [ ] With no food left, the button says "Buy Berry Bites in the Shop" and opens the Shop.

# Studium demo stand: cheat sheet

December 3. About 30 minutes, visitors one or two at a time. **You drive the planner; they play with the pets.**

## Before the stand

1. Quit the real Studium: tray icon by the clock → **Quit Studium**. Otherwise two sets of pets roam.
2. Open **Studium Demo** (desktop shortcut). Go to **Settings → Reset demo**, keep the nickname **Mustang**, then **Reset**. Dates are worked out from the day you press it.
3. Check the sound plays through the TV (pets meow and chirp).
4. Put out the QR code (`docs/demo/download-qr.png`): it opens the latest release.
5. Right-click the Capstone cat → **Toys → Focus Ball**, so a toy is already out.

## The 30-second pitch

"Studium is a planner where every class gets a pet. You break a class into requirements and tasks, and the pet's mood follows whether you're keeping up. Finish work, earn tokens, and spend them on food, toys and decor. And the pets live on your desktop, so they nudge you while you work."

## The planner path (you drive, about 2 minutes)

1. **Overview:** five classes, five moods. "Capstone's cat is happy, it's nearly done. Web Dev's pigeon is upset, it's behind."
2. **Today:** Rehearse the stand ★, Overdue reminders, Enrollment form, Sum up the findings.
3. Open **Web Dev: Childcare website:**
   - **Front end** (sublabel *Accessibility*), **Back end**, **Middle layer** (*API*), **Deployment**.
   - Deployment shows 🔒 **Waiting on** the other three.
4. **≡ menu → Collapse all,** then **Soon:** only Front end is left (due in 2 days), with "3 more hidden by Soon".
5. Back to **Show all**, then **≡ → Expand all**. In Front end, **drag** "Keyboard and screen reader check" to the top, by the ⋮⋮ grip.
6. **Tick off "Enrollment form":** tokens are earned and the pigeon reacts.

## "Try it yourself" (hand over the mouse)

- **Throw the Focus Ball:** drag it and let go. The pet runs to fetch it.
- **Right-click a pet → "What should I work on?"**
- **Shop → buy a snack** (the ♥ is that pet's favorite flavor), then feed it to the pet.
- **Open the Capstone habitat:** the **Window** follows the real clock and dims the room at night.
- **Right-click a pet → Toys → Robo Mouse:** the pet chases it on its own.

## Answers to likely questions

- **Is it free?** Yes.
- **Mac? Linux?** Windows, Mac (signed) and Linux. Scan the QR code.
- **Does it sync?** Yes, with an account, between your computers.
- **Phone app?** It's built and runs on my iPhone, but it isn't released yet.
- **What's next?**
  - collab mode (share a project and its pet with a classmate);
  - pets with their own personalities and hidden favorite foods;
  - the phone app with reminders.

## When it's busy

Skip the drag and the 🔒. Show **Soon** and one tick, then hand over the pets.

## If something goes wrong

- **Pets stop responding to clicks:** Settings → **Reload pets**, or tray → **Reload pets**.
- **The demo is a mess, or a new tester sits down:** Settings → **Reset demo**. Type their name in the **Nickname** box so the pets greet them, or leave **Mustang**.

## Making the shortcut (once, on the demo laptop)

Install the final Studium first. Then, in PowerShell:

```powershell
$exe = "$env:LOCALAPPDATA\Programs\Studium\Studium.exe"   # check this path exists
$ws = New-Object -ComObject WScript.Shell
$s = $ws.CreateShortcut("$([Environment]::GetFolderPath('Desktop'))\Studium Demo.lnk")
$s.TargetPath = $exe
$s.Arguments = "--demo `"--user-data=$env:APPDATA\Studium Demo`""
$s.IconLocation = $exe
$s.Save()
```

The demo copy keeps its data in `%APPDATA%\Studium Demo`, apart from your real Studium. It never signs in, and your real save is never touched.

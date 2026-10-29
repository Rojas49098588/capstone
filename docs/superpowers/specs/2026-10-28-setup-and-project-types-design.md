# First-Run Setup, Project Types and Pet Difficulty: Design

_Date: 2026-10-28. Status: approved by the user._

## Why

Studium is built around coursework: every user gets five sample school projects, every project talks about "requirements", and every pet reacts the same way. The MVP deck's "Next: Open it up" column wants Studium to work for anyone who makes things. This round does the first part:

- a short **setup** that asks who you are and how you want Studium to behave;
- **project types** that change the wording (a novel has chapters, not requirements);
- a **difficulty** per project, so a class assignment can have a strict pet and a personal project a forgiving one;
- a first taste of **pet mischief**, ahead of the desktop app, where pets will act more like Desktop Goose or BonziBuddy.

The deck's other "Next" items (optional deadlines, mood based on consistency, a pause button) and progress photos are later rounds.

## Goals

- First open shows a **4-step setup**. Existing users see it once too.
- New users start with a **blank Overview** (no sample projects). The tutorial starts when they create their first project.
- Each project has a **type** (sets its wording) and a **difficulty** (sets how strict its pet is). Both default to the setup answers.
- Three levels of **how much pets interact**. The top level adds a first trick: the pet leaves a **sticky note** on the web page.
- The **nickname** appears in the Overview heading and in the pet's notes.

## Non-goals (this round)

- Progress photos.
- Optional deadlines, optional time estimates, mood based on consistency, pausing a project.
- Changing how tokens are paid by type or difficulty.
- Mischief beyond the sticky note (dragging the cursor, opening pages, writing in other programs). These come with the desktop app.
- Different pet behavior or Shop items per project type.

## Anti-goals (would make this a failure even if it works)

- An existing user's projects change wording, difficulty, mood or tokens without them choosing it.
- An existing user loses their projects, or is pushed back into the tutorial.
- A pet interrupts during a focus nap, or a note covers the page so it can't be used.
- Setup can't be finished quickly: every step must have a sensible pre-selected answer.

## Decided by the user

| Topic | Decision |
|---|---|
| Setup shape | One question per screen, 4 steps, with a progress indicator (mockup A) |
| Setup questions | What you make; nickname; default pet difficulty and how much pets interact; rings or bars and light or dark |
| Rings or bars | Shown as two stacked choices, each a preview that copies the real Overview's Total Progress (mockup "Step 4 v2") |
| Difficulty | A default from setup that every new project starts with; each project can change it when created |
| Difficulty numbers | The table below. Test with these and adjust later |
| Interaction levels | Minimal, Mild, Moderate. Moderate gets a first trick now, labeled "More mischief coming in a future update" |
| First trick | The pet walks onto the page and leaves a sticky note about your work; you close it |
| Wording per type | The table below |
| Sample projects | New users get none. The user's five real projects stay theirs |
| Existing users | See setup once |
| Nickname | Overview heading ("Abby's Projects") and the pet's notes ("Abby, portraits misses you") |

## Setup

Shown full-screen the first time Studium opens after this change, before anything else, for new and existing users. It ends with "Start using Studium". Each step has Back (except step 1) and Continue. Each step starts with an answer already selected (or blank, for the nickname), so a user can click straight through. _Claude's call:_ for an existing user, each step pre-selects their current setting (for example Bars, if they already chose bars), and the pre-selections below apply only where there's no saved setting.

1. **What do you make?** Writing, Code, Art & design, Music, School, Something else. Sets the default project type. Pre-selected: School.
2. **What should we call you?** A nickname, optional. Blank means no name is used.
3. **Your pets.**
   - Difficulty: Gentle, Steady or Strict, each with a one-line description. Pre-selected: Steady.
   - How much they interact: Minimal, Mild or Moderate, each with a one-line description. Moderate's says "More mischief coming in a future update". Pre-selected: Mild.
4. **Your look.**
   - Total Progress: bars or rings, as two stacked previews that look like the real Overview.
   - Light or dark. _Claude's call:_ choosing one switches the setup screen right away. Pre-selected: the current theme.

Finishing saves everything to settings and marks setup done. Every answer can be changed later in Settings. Setup itself isn't replayed from Settings.

## Project types and wording

Each project has a type. The type only renames things on that project's own screens.

| Type | A requirement is called | A task is called |
|---|---|---|
| School | Requirement | Task |
| Writing | Chapter | Scene |
| Art & design | Piece | Step |
| Code | Feature | Task |
| Music | Track | Task |
| Something else | Milestone | Task |

- The New Project form gets a **Type** choice, pre-set to the setup answer. The edit dialog can change it.
- Projects saved before this change are **School**.
- _Claude's call:_ the new words appear wherever one project's requirements or tasks are named: the project page, its forms and buttons ("Add chapter"), empty states, the hatch hint ("Add 2 more chapters to hatch"), and that project's habitat. Screens that mix projects keep the plain words: Today, Suggested next, the Shop, token explanations and the tutorial.
- Singular and plural forms are both needed (Chapter, Chapters).

## Difficulty

Each project has a difficulty. Projects saved before this change are **Steady**, which is exactly today's behavior.

| | Gentle | Steady (today) | Strict |
|---|---|---|---|
| Worried when behind plan by | 20 points | 10 points | 5 points |
| Upset when behind by | 40 points | 25 points | 15 points |
| Neglect lowers mood after | 14 idle days | 7 idle days | 4 idle days |
| Gets sick after | 28 idle days | 14 idle days | 7 idle days |

- Everything else is the same at every difficulty: Delighted, Proud, recovery, medicine, the neglect bonus and the sick token penalty.
- The New Project form gets a **Difficulty** choice, pre-set to the setup default. The edit dialog can change it.
- Eggs still have no mood and can't get sick, whatever the difficulty.
- Settings already has an unused "Difficulty" (Easy, Medium, Hard). It becomes "Default difficulty for new projects" with the new names: Easy is Gentle, Medium is Steady, Hard is Strict.

## How much pets interact

Settings already has an unused "How involved your pet is" (Not much, Very). It becomes three levels: Not much becomes Minimal and Very becomes Mild. The extension reads it, along with the nickname, the same way it reads "Pets on screen at once" today.

- **Minimal:** the pet stays in its spot on the page and doesn't walk around, hop to celebrate, or show speech bubbles on its own. Anything you start yourself still works: focus naps and their check-in, the right-click menu, dragging. _Claude's call:_ this applies on web pages only. In its own habitat the pet behaves as usual, since that's its home.
- **Mild:** today's behavior, unchanged.
- **Moderate:** Mild plus sticky notes.

### Sticky notes (Moderate only)

- Now and then, a pet walks to a spot on the page and leaves a small note, then goes back to what it was doing. The note stays until you close it. Notes never cover the middle of the page.
- A note is about that pet's project, using what the extension already knows, for example:
  - "Abby, portraits misses you: 5 days since you worked on it." (an idle requirement)
  - "novel is due in 3 days." (the project deadline)
  - With no nickname, the name part is left out.
- A pet with nothing to say leaves no note.
- No notes during a focus nap, on Studium's own page, from eggs, or while a note is already open.
- _Claude's call:_ at most one note every 30 minutes across all pets. Closing a note counts toward the 30 minutes.

## Nickname

- Optional, set in setup or Settings. _Claude's call:_ up to 20 characters, trimmed.
- The Overview heading reads "Abby's Projects", or "Your Projects" with no nickname.
- It appears at the start of sticky notes.

## New users start blank

- A user with no saved data starts with no projects, not the five samples.
- **First-project pop-up (decided by the user):** when the Overview opens with no projects, a pop-up prompts the user to create their first project. Its main button opens the New Project form. It also appears right after setup for a new user.
  - _Claude's call:_ the pop-up can be closed. While there are still no projects, it comes back the next time the Overview opens, and the Overview's empty state also points to New Project.
  - It never appears while setup or a tutorial is showing.
- Creating the first project opens it, which starts the tutorial as today.
- The five sample projects stay in the code. They're still used when the browser can't save, and in tests.
- The tutorial's wording must make sense for a user with no other projects.

## Constraints

- Follow HANDOFF.md:
  - planner and store functions take `now`;
  - all wording in `web/src/ui/format.ts`;
  - all tuning numbers in `web/src/planner/tuning.ts` (the extension keeps its own copy where it needs one);
  - tests first;
  - `npm run build` and `npm test` pass;
  - nothing in `extension/` starts with `_`.
- Saved data stays `version: 1`. Old data must load unchanged, with missing type meaning School and missing difficulty meaning Steady. Old settings must load, mapping the old difficulty and involvement values as above.
- The extension and Studium keep working together in both directions: an older extension ignores the new settings, and a newer extension treats missing settings as Mild with no nickname.

## Left to the builder

- How type, difficulty and setup-done are stored. For example, new optional fields on the project, and new fields in settings.
- The one-line descriptions for each difficulty and interaction level, within `format.ts`.
- The sticky note's look, how the pet walks to it, and where on the page it goes, within "never the middle".
- Whether Minimal pets sit at the bottom edge or stay where they are.

## Testing

- **Unit tests:**
  - old projects load as School and Steady;
  - each difficulty's thresholds give the moods in the table;
  - old settings map Easy to Gentle, Not much to Minimal, and so on;
  - the wording for each type, singular and plural;
  - a new user's starting data has no projects;
  - note choice: an idle requirement or a near deadline produces a note, nothing to say produces none, and nothing is chosen during a nap, for an egg, or within 30 minutes of the last note;
  - the nickname in notes and the heading, and its absence.
- **Component tests:**
  - setup shows for a user who hasn't done it, in 4 steps, and saves every answer;
  - setup doesn't show again;
  - the New Project form pre-sets type and difficulty from settings;
  - a Writing project's page says "Chapter" and "Add chapter";
  - the Overview heading uses the nickname;
  - with no projects, the first-project pop-up appears after setup and its button opens the New Project form; it doesn't appear once a project exists.
- **Browser check (Playwright, real extension):**
  - Minimal: the pet stays put and doesn't celebrate;
  - Mild: unchanged;
  - Moderate: a note appears and closes, and none appears during a focus nap.

# Pets growing up, and more pets per project

Date: 2026-11-01. Status: agreed with the user in chat (including the reviewer's questions); awaiting their review of this document.
Builds on: the pet lifecycle (`2026-10-28-pet-lifecycle-design.md`), the desktop app
(`2026-10-28-desktop-app-design.md`), and Week 3's mischief plan. Added to Week 3 at the user's request.

## Why

Two things came up together:

- **Juveniles never grow up.** The lifecycle round hatched eggs into juveniles (75% size) and left
  growing up for later. The user wants growing up to be a visible reward for real progress.
- **A screen full of pets for people with few projects.** At the MVP presentation, someone asked for
  more pets per project: a student with only one or two projects gets one or two pets, and the desktop
  feels empty. The user wants extra pets to be **earned**, bought in the Shop with tokens, and
  **optional**: nobody who wants one pet per project is pushed into more.

## Goals

1. **Growing up.** A juvenile becomes an adult when **50% of the tasks it cares about have been
   checked off since it hatched** (user's decision, 2026-11-01: every pet has to earn growing up;
   none grows up the moment it hatches). "The tasks it cares about" are the whole project's for a pet
   that shares the project's mood, and that requirement's for a pet that looks after one requirement
   (below). Precisely: tasks completed after hatching ≥ 50% of (tasks still open when it hatched +
   tasks added since). Only a task's first completion counts, as everywhere in the planner. This
   applies to today's juveniles too, counted from their `hatchedAt`, so none grows up the moment
   this ships unless that much work has happened since it hatched. Growing up is saved when it
   happens, like hatching: adding tasks later never turns an adult back into a juvenile.
2. **Eggs in the Shop, in a new "Pets" tab** (user's request, 2026-11-01). The tab lists **one egg
   per kind of pet** (cat, dog, frog, pigeon, turtle), each about **400 tokens** (my call: Shop items
   cost 35 to 180 and new users start with 100, so an egg is a goal). An egg hatches into its kind, so
   the user picks the kind by picking the egg; when buying, they choose the project it goes to. The
   tab is laid out by kind so **later styles of each kind** (the user plans different styles within
   today's kinds) can be added as more eggs under the same kind without changing how buying works.
   **At most 4 pets per project**,
   counting the first and any unhatched eggs; a project with 4 can't get another egg. My calls:
   - **One unhatched bought egg per project at a time**: another can be bought once it hatches. So
     one burst of work never hatches several eggs at once.
   - **Not while the first pet is still an egg.**
   - A bought egg **gets its own habitat at once**, showing the egg (as a new project's habitat
     does), and its decor can be placed before it hatches.
3. **Hatching a bought egg.** Counting only tasks checked off **after the egg was bought**, the egg
   hatches when **any one requirement** of its project gets at least halfway: tasks completed since
   the purchase ≥ 50% of (that requirement's tasks still open at the purchase + tasks added to it
   since). Tasks finished before the purchase don't count, and finishing a requirement always counts
   as halfway. The project's first egg keeps today's rule (it hatches at the project's 3rd requirement).
4. **What an extra pet cares about.** When a bought egg hatches, the user chooses, and can change
   later in the habitat:
   - **Shares the project's mood** (the default): it feels exactly what the first pet feels.
   - **Looks after one requirement**: its mood comes from that requirement only (the project's mood
     rules applied to that one requirement: moving vs. neglected, on schedule vs. behind, sick after
     long neglect). Its "What should I work on?" and its nap list point at that requirement's tasks.
   The project's **first pet always shares** the project's mood. When a looked-after requirement is
   finished or deleted, its pet goes back to sharing (my call).

   **Sickness and medicine** (user's decision, 2026-11-01):
   - **Pets sharing the project's mood share its health**, as today: they are sick together, and one
     dose of medicine cures all of them (the existing `medicine_given` for the project).
   - **A pet looking after a requirement has its own health**, from that requirement alone: it can be
     sick while the others are fine, it needs its own dose, and it recovers on its own.
   - My call: the project's sickness rule is unchanged, so a long-neglected looked-after requirement
     still makes the sharing pets sick too (the project is neglected). Curing everything then takes
     two doses.

   **Names** (my call): the first pet keeps the name it has today, the project's Pet Nickname
   (`shortName`). A bought pet is named when it hatches, in the same step as choosing what it cares
   about, with a suggested name ("Frog", "Frog 2", …) the user can change. Names appear in the
   habitat header, the desktop label, menus and check-ins.
5. **One habitat per pet** (the user chose this from mockups). The project page shows one habitat at
   first; each bought egg adds a full habitat **under the last one**, with a small "Want another
   companion? Buy an egg in the Shop" prompt below the last habitat until there are 4. Each habitat
   has its own furniture, and its pet lives only in its own habitat. A habitat's header shows the
   pet's name, what it cares about ("Project Companion" or "Looks after · `<requirement>`") and its mood.
6. **Everywhere pets appear, extra pets appear too.** On the desktop every hatched pet roams, with
   the full menu (What should I work on?, Nap, Sleep, Open project) and Week 3's mischief. "Open
   project" opens the project page scrolled to that pet's habitat. Extra pets count toward "Pets on
   screen at once". Naps record focus time for the task picked, as today.

## Non-goals

- Pets moving between projects, or trading/selling pets.
- Different art for adults vs. juveniles beyond today's size difference (juveniles stay at 75%;
  growing up makes the pet full size). Juvenile art is still a later round.
- Buying more than 4 pets for a project, or more than one egg at a time beyond that cap.
- Changing the first pet's hatching rule.

## Anti-goals

- **Forcing more pets on anyone.** No free extra eggs, no nagging. The only prompt is the small
  "Buy an egg" line under the last habitat.
- **A crowded or confusing page.** Each pet has its own habitat; nothing is crammed into one box.
- **Breaking existing data.** Projects saved before this round keep their one pet, its stage, its
  position on the desktop, its decor and its naps. Older saved data loads unchanged.

## Constraints

- Today a pet is identified by its **project id** everywhere: pet statuses (`projectId`), naps and
  sleep (`petAway[projectId]`), saved desktop positions, check-ins, notes, the habitat box
  (`data-pet-habitat="<projectId>"`) and decor (`decor[projectId][slot]`). Extra pets need their own
  ids. **The first pet's id stays the project id**, so all saved state for it keeps working.
- One nap at a time across all pets stays the rule.
- The browser extension is retired (desktop spec); it doesn't need to show extra pets, but it must
  not break when statuses contain them.
- Due December 3rd with Weeks 3 and 4 still to build, so this must fit in a few days.

## Left to the builder

- How pet records are stored (a list per project, a top-level list), as long as the first pet keeps
  the project id and old data loads unchanged.
- How a requirement-scoped mood reuses the existing mood code.
- Exact Shop placement and wording, the egg item's art (reuse the egg picker's looks), and the
  "change what it cares about" control in the habitat.
- How "Open project" scrolls to a habitat (for example `#project=<id>&pet=<petId>`).

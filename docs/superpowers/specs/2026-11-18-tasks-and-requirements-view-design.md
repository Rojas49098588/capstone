# Reordering tasks, a condensed requirements view, and sublabels: design

Date: 2026-11-18. Status: approved by the owner on 2026-11-18.
Builds on: `2026-10-14-studium-planner-design.md` (projects, requirements, tasks, Today) and
`2026-10-30-blocking-and-polish-design.md` (requirements waiting on others).

## Why

Testers asked for three things in the planner:

1. **Reordering tasks.** Today a task's place is fixed.
2. **A shorter view of a project's requirements.** Each requirement is a full card with every task,
   so a project with many requirements is a long scroll.
3. **A short sublabel on a requirement.** For example, "Prototype" with the sublabel "Accessibility".

The final demo is December 3 and shows the desktop app. These should make the planner easier to
read and arrange without changing how it plans.

## Goals

1. **Reorder tasks** by dragging, or with Move up and Move down buttons:
   - within a requirement's task list;
   - within the **Today** list.
2. **Collapse a requirement** to one line, with a ▾ to open it.
3. A **≡ menu** on a project's requirements list with:
   - Collapse all and Expand all;
   - one view option at a time: Show all, Today's to-do, Hide completed, Soon (due in the next 3 days).
4. An **optional sublabel** on each requirement, shown under its title.

## Non-goals

- Reordering requirements.
- Moving a task to another requirement by dragging. The task form already does that.
- Grouping or filtering by sublabel. The owner decided against it: a sublabel is only a label.
- More than one sublabel per requirement.
- A setting for how many days count as "Soon". It's fixed at 3 for now; a setting comes later.
- Any change to the browser extension's or the phone's views.

## Anti-goals

- **The order you set never changes planning.** "What should I work on?", suggestions, tokens,
  mood and progress work exactly as today. Order is only how a list looks.
- **Old saved data loads unchanged.** Tasks without an order keep today's order. Requirements
  without a sublabel show none.
- **Hiding never loses anything.** A collapsed or filtered-out requirement still exists. A short
  line says what's hidden, so nobody thinks their work is gone.
- **Reordering must be usable without a mouse** (Move up and Move down, and keyboard focus that stays
  on the moved task).

## 1. Reordering tasks

**Within a requirement**
- Each unfinished task has a grip (⋮⋮) on the left. Drag it to a new place in the same list.
- Each task also has **Move up** and **Move down** buttons, in its row's menu or as small buttons
  (builder's call). Keyboard focus stays on the moved task.
- **Finished tasks** stay together at the bottom, in the order they were finished, as today. They
  can't be dragged.
- **★ (priority)** no longer moves a task to the top. It stays a marker on the task, and the planner
  still uses it as before. *(Owner's decision.)* Existing lists keep their current look on the first
  load: the first time a requirement's tasks get an order, starred tasks come first, then the rest
  in today's order.
- New tasks go to the bottom of the unfinished tasks.
- **Unlinked tasks** (the "Unlinked" list under a project) can be reordered the same way.

**Within Today**
- The **Today** list on the Overview can be reordered the same way: grip, Move up, Move down.
- Today's order is the order of `today.taskIds`, which is already saved. Reordering rearranges that
  list.

**Data**
- Tasks get an optional order number (for example `order?: number`), used only to sort unfinished
  tasks within their list. Missing means "after the ones that have an order, in creation order".
  The exact scheme is the builder's call. It must merge through sync without errors: two devices
  reordering at once may leave an order nobody chose, but never lose or duplicate a task.
- Moving a task to another requirement (task form) puts it at the bottom of its new list.

## 2. Condensed requirements view

**One requirement**
- Each requirement card gets a **▾ / ▸** toggle next to its title. Click it to collapse or open.
- **A collapsed requirement is one line:**
  - the title;
  - the sublabel, if any;
  - the due date ("Due Dec 1");
  - 🔒 **"Waiting on …"** when it's blocked (the existing `waitingOnLabel` wording).
  - *(Owner's decision.)* The progress bar, tasks and buttons are hidden while collapsed.
- An open requirement looks as it does today.

**The ≡ menu** sits at the top right of a project's requirements list. It opens on click, and on
hover with a mouse. It contains:

- **Collapse all** (shown as **Expand all** when every requirement is collapsed). This works on top
  of any view option.
- **View:** exactly one of these is on at a time *(owner's decision: picking one turns the others
  off)*:
  - **Show all:** the default, today's behavior.
  - **Today's to-do:** only tasks on today's list, under their requirements. Requirements with none
    are hidden.
  - **Hide completed:** hides finished tasks and finished requirements.
  - **Soon:** only unfinished requirements due within the next 3 days, today included, plus any
    already past their due date. The number lives in tuning so a setting can change it later.
- The button shows when a view other than Show all is on (for example "≡ Soon"), so a filtered list
  isn't mistaken for the whole project.
- When a view hides everything, show one line instead of an empty space, for example "Nothing due in
  the next 3 days." or "Nothing on today's list for this project."
- When a view hides some requirements, show how many under the list, for example "2 more hidden by
  Soon", with a way back to Show all.

**What's remembered:** collapsed requirements and the chosen view are saved **on this device only**
(not synced), per project, so they're still set the next time the project opens. My call (Claude's):
these are display choices, and syncing them would add records for no benefit.

## 3. Sublabels

- The requirement form (new and edit) gets an optional **Sublabel** field, up to **30 characters**,
  trimmed. Empty means no sublabel.
- It shows under the requirement's title as a small, muted tag, on both the open card and the
  collapsed line.
- **Data:** `Requirement.sublabel?: string`. Saved data with a missing or empty sublabel shows
  nothing, and a sublabel that isn't text is dropped on load without failing the whole load.
  Duplicating a requirement copies its sublabel.
- My call: there are no suggestions from existing sublabels. Without grouping, a typo costs nothing.

## Done means

- Tasks can be reordered by drag and by Move up and Move down, in a requirement, in Unlinked, and in
  Today. The order survives a reload and a sync, and never changes suggestions, tokens or progress.
- ★ marks a task but doesn't move it. Existing lists look the same on the first load.
- Requirements collapse and open one at a time, and all at once from the ≡ menu. A collapsed line
  shows the title, sublabel, due date and any "Waiting on". All of this is remembered per project
  on the device.
- The four views work one at a time, with the empty and "more hidden" lines.
- Sublabels can be set, edited, cleared and duplicated, and they show on the card and the collapsed
  line.
- Old saves load. The existing tests pass, and new tests cover ordering, the views and sublabels.

## Settled after the builder check (my calls, Claude's)

- **When an order is first saved:** nothing changes on load. A list nobody has reordered keeps
  today's sorting, with starred tasks first. The first time someone reorders a list, every unfinished
  task in that list gets an order number matching what's on screen. From then on, ★ no longer moves
  a task in that list. This avoids rewriting every task in every save on the first load.
- **Ties and renumbering:** tasks sort by order number, then by creation time, then by id. A move
  renumbers that one list. Lists are short, so a few task saves per move is fine.
- **Done tasks in Today** stay at the bottom and can't be dragged, as in a requirement. Move up and
  Move down only move among unfinished tasks.
- **Sync:** each task's order travels with the task, so a task is never lost or duplicated. Today's
  list is saved as one record, as it is today, so the last device to change it wins. That's the
  known limit in `HANDOFF.md`; reordering doesn't make it worse. "Never lose or duplicate a task"
  is about tasks, not Today's membership.
- **Today's to-do view:** shows a project's tasks on today's list, done ones included and drawn as
  done, as the Today list draws them. It shows each requirement that has at least one of them.
  Yesterday's leftover list counts as empty, as `todayTaskIds` already treats it.
- **Hide completed:** "finished" means the planner's `isRequirementDone`: it has tasks, and all are
  done. A requirement with no tasks isn't finished, so it stays.
- **Soon:** a requirement's due date, or the project deadline if it has none, falls on or before the
  local day 3 days from today. Overdue unfinished requirements count. Finished ones don't.
- **Remembered view:** stored in the device's own storage, per project, apart from the synced data,
  so it survives signing out. A new requirement starts open. Ids of deleted requirements are simply
  ignored.
- **≡ menu:** it opens on click (required) and can be used from the keyboard. Opening on hover is a
  nice extra on the desktop, not required.

## Left to the builder

- The drag library or a hand-written drag (pointer events), and how the drop spot is shown.
- How Move up and Move down are presented.
- The exact order-number scheme.
- The look of the ▾ toggle, the ≡ menu, the sublabel tag and the empty lines, in Studium's style.

## Settled after the final review (Claude's call, 2026-11-18; the owner can reverse it)

- **Today's order does reach the pets.** Pets have always offered Today's tasks in the order of `today.taskIds`, so after a reorder "What should I work on?" names the task you put first. That's the order you chose, so it stays. This narrows the anti-goal "order never changes planning" to: suggestions from Suggested next, tokens, mood and progress never read the order. Pinned by `petStatus.test.ts` "follows the order you set for Today". Undoing it would mean saving the order tasks were added in separately.

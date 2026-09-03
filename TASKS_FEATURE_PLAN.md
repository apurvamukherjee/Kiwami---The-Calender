# Kiwami Tasks (Kanban) — Stage 1 Retrospective + What's Actually Left

This file is the single continuation document for the Tasks/Kanban feature: what
Stage 1 shipped, every bug found and fixed while polishing it, and the full
original market research carried forward (nothing from the report has been
dropped — each item is annotated with its real status against the shipped code).

**Status note (2026-09-03):** Parts C–F below were rewritten after a fresh,
code-verified audit found that a substantial "Stage 2" had already shipped
at some point after this file was last touched, without ever being logged
here — the file was claiming things like "reminders NOT wired" and "tag
management NOT DONE" that were, on inspection, both long since built. See
Part C0 for what was found and why the old sections were replaced rather
than patched. Part A/B below (Stage 1's own history) were re-checked too
and are still accurate — no changes needed there. **Two same-day follow-up
passes** then shipped: "wrap up Part C-D-E" (D5, bulk select, a 6th color
swatch — one real React warning found and fixed live), and "wrap Part F +
live-readiness" (velocity-tilt drag lift, animated column-collapse, plus
an honest branding/bundle-size/deployment audit for the whole app). See
the two build logs near the end of this file for the full record.

---

## Part A — Stage 1: what shipped

A full Kanban Tasks section, built as a new top-level app section (`Calendar |
Notes | Tasks`), reusing Kiwami's existing recurrence engine, theming, Command
Palette, and Sheet/modal conventions rather than inventing new ones.

### Data model
- `src/db/types.ts`: `TaskDto`, `TaskListDto`, `TaskTagDto`, `TaskSubtaskDto`
  (inline, one level), `TaskRecurrenceDto` (embedded on the task, not a shared-table
  FK), `TaskPriority` (5 levels: none/low/medium/high/urgent).
- `src/db/db.ts`: Dexie version 3, purely additive (`taskLists`, `tasks`,
  `taskTags` tables; `*tagIds` multiEntry index for fast tag filtering). No
  `.upgrade()` needed — same convention as the v1→v2 bump.
- Recurring-task completion **rolls the due date forward** (`src/lib/
  taskRecurrence.ts`'s `rollTaskDueDateForward()`, reusing `expandOccurrences()`
  as-is) instead of creating `occurrenceStatus` rows or touching
  `streakCount` — deliberately no per-occurrence tracking or streak for tasks,
  per the Stage 1 scope decision (see Part D — no second Ember Chain).

### Data layer — `src/lib/tasks.ts`
Full CRUD + live-query hooks mirroring `lib/notes.ts`'s shape: `createTask`,
`updateTask`, `completeTask` (branches into the recurrence-roll-forward path),
`archiveTask`/`unarchiveTask`/`deleteTaskForever`, `reorderBoard` (one Dexie
transaction, skips no-op writes), full list/tag CRUD, `ensureDefaultTaskLists`
(seeds To Do / In Progress / Done), `useTasks`/`useTaskLists`/`useTaskTags`/
`useTasksByList`.

### Components — `src/features/tasks/`
`TasksPage.tsx` (shell) · `TaskComposer.tsx` (pinned quick-capture, NLP dates via
the existing `parseNoteText`, simplified inline recurrence) · `KanbanBoard.tsx`
(single `@dnd-kit` `DndContext`, branches mobile-swipe vs desktop-multi-column at
1440px) · `TaskColumn.tsx` · `TaskCard.tsx` (+ `TaskCardOverlay`/`TaskCardBody`
split for the drag ghost) · `TaskDetailSheet.tsx` (full editor: priority, tags
with inline creation, due date/time, full recurrence sub-form, subtasks) ·
`TaskListManager.tsx` (create/rename/recolor/reorder/archive lists) ·
`TaskArchiveView.tsx` (restore / permanently delete) · `useSearchTasks.ts` (feeds
the Command Palette) · `taskDnd.ts` (dnd-kit id-namespace helpers).

### Integration
- `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities` added (Kiwami had
  no DnD library before this).
- `BottomNav`/`SectionTabs`' `Section` type extended to include `"tasks"`.
- `CommandPalette` **lifted from `CalendarPage` into `App.tsx`** (Tasks is a
  sibling section, so Ctrl/Cmd+K needed to work app-wide, not just from
  Calendar) and extended with a third result group (`useSearchTasks`) merged
  into its existing flat `staticActions`/`results`/`runIndex` index scheme.

### Verification
`npm run typecheck` / `npm run test` (29 tests: the existing 12 recurrence + 6
streak + 5 parseNoteText untouched, plus 6 new `taskRecurrence.test.ts` cases) /
`npm run build` all clean. A full Playwright-driven pass (headless Chromium,
`playwright` installed globally — **not** added as a repo devDependency, same
convention `CLAUDE.md` documents for earlier phases) exercised: board render with
3 default lists at exactly 1440px and mobile 390px, NLP quick-capture, opening/
saving `TaskDetailSheet` (priority/tags/subtasks/recurrence all render), complete-
via-checkbox, archive → Archive view → restore, cross-column + within-column
drag with reload-persistence, Command Palette task search → jump → detail sheet
open, light/dark theme toggle, mobile column tab-strip navigation, BottomNav with
3 items. **19/19 automated checks passed, zero console errors/warnings on both
desktop and mobile contexts.**

---

## Part B — Bugs found and fixed during the polish pass

Six real bugs were found by actually driving the app (not just typecheck/tests)
and fixed. Recorded here in the same spirit as `CLAUDE.md`'s existing "real bug
found and fixed" entries for other phases — each is a genuine lesson, not just a
changelog line.

1. **`ensureDefaultTaskLists()` race (duplicate default lists).** React
   StrictMode double-invokes a component's mount effect in dev; two concurrent
   calls both saw `db.taskLists.count() === 0` before either `bulkAdd` committed,
   creating 6 lists instead of 3. **Fix:** wrapped the count-check + bulkAdd in
   one `db.transaction("rw", db.taskLists, ...)` — IndexedDB serializes
   readwrite transactions on the same store, so the second call's count() now
   correctly sees the first call's already-committed rows. Same class of issue
   as `CLAUDE.md`'s documented `useBackClose` StrictMode gotcha, different
   mechanism (TOCTOU on a Dexie read+write, not a history-API race).
2. **`useIsMobile(1440)` boundary bug.** The hook's query is `max-width:
   ${breakpoint}px` (inclusive), so passing `1440` directly made a viewport at
   *exactly* 1440px match "mobile" and render the single-column swipe board
   instead of the intended multi-column desktop layout at that width — meaning
   the very first "desktop" verification pass was silently testing the mobile
   layout. **Fix:** `KanbanBoard.tsx` now calls `useIsMobile(DESKTOP_BREAKPOINT -
   1)`.
3. **Escape didn't close content-only sheets (`TaskArchiveView`,
   `TaskListManager`).** antd's Modal focus-trap doesn't reliably move focus
   into a dialog that has no `autoFocus` field on open (confirmed: `SettingsSheet`
   works because nothing about it differs *except* this — both use identical
   `Sheet`+`useBackClose`). Every other existing sheet in the app has an
   `autoFocus` input that wins the race independently of antd's own trap;
   `TaskArchiveView`/`TaskListManager` are the first content-only sheets in the
   codebase to lack one. **Fix:** applied the same documented pattern
   `CommandPalette` already uses for a related antd-focus race — `afterOpenChange`
   explicitly focusing a `tabIndex={-1}` wrapper div once the open transition
   settles.
4. **Escape broke again after Restore/Delete/Archive-list (row removal steals
   focus).** Deeper root cause than #3: clicking "Restore" focuses that button;
   the DOM spec resets focus to `<body>` when the currently-focused element is
   removed from the document — which is exactly what happens the instant the
   row (containing that button) disappears after the underlying live query
   updates. Once focus is on `<body>`, a subsequent Escape keydown never reaches
   the dialog's listener. **Fix:** each row action (`Restore`, `Delete forever`,
   `Archive this list`) now proactively calls `contentRef.current?.focus()` in
   its own click/`onConfirm` handler, before the row can vanish and take focus
   with it.
5. **Command Palette → task jump silently lost the "open detail sheet" step.**
   `TasksPage`'s `pendingTaskId`-consuming effect ran on the very first render of
   a *fresh* mount (e.g. jumping here from Calendar), before `useTasks()`'s live
   query had resolved — `tasksById` was still empty, so the effect found nothing
   and immediately cleared `pendingTaskId` anyway, permanently losing the
   request. **Fix:** the effect now only calls `onConsumePendingTaskId()` once
   the task is actually found, so it naturally re-checks on the next render
   (when the live query resolves) instead of consuming against stale data.
6. **Cross-column drag unreliable into an empty/large column.** `closestCenter`
   picks the droppable whose *center* is nearest — for an empty column filling
   the full board height, that center can be far from the pointer even while
   the pointer is clearly hovering inside the column, so a drag toward an empty
   "In Progress" instead registered as a same-column reorder. This was
   flagged as a real risk in the original plan ("verify visually, adjust if
   needed — don't guess blind"), and manual testing confirmed it was needed.
   **Fix:** `KanbanBoard.tsx` now uses dnd-kit's own documented
   `pointerWithin`-first strategy (falls back to `rectIntersection`), which
   checks literal pointer-in-rect containment instead of nearest-center
   distance.

All six are fixed in the current code and re-verified passing (19/19).

---

## Part C0 — 2026-09-03 fresh audit: Stage 2 already happened, undocumented

**This file's Parts C–F were stale.** Everything below them (until this
section) was written against a Stage 1 snapshot and never revisited, even
though a substantial "Stage 2" clearly shipped at some point since — every
current line of code was checked directly (not inferred) before writing
this: `TaskDto`'s real fields in `src/db/types.ts`, every file in
`src/features/tasks/`, `src/lib/tasks.ts`, `src/lib/taskStats.ts`, and
`src/lib/notifications.ts`. Almost none of the old "Stage 2/3, NOT STARTED"
claims were still true. Rather than patch individual bullet points, Parts
C–F below are rewritten from scratch against what the code actually does
today. Nothing is dropped — every original item is still tracked, just with
a corrected status and, where relevant, the exact file/field that proves it.

**What turned out to already be shipped** (see Part D for full detail on
each): D1 (unified do/due model — `TaskDto.doDate`), D2 (planned-vs-actual
time — `estimatedMinutes`/`actualMinutes`), D3 (energy — `TaskDto.energy`,
wired into `FocusSheet`'s filter), D4 (Won't-Do terminal state — `wontDo`/
`wontDoAt`), D6+D7 (deliberately merged into one `FocusSheet` — see its own
top-of-file comment — plus `WeeklyReviewSheet`), D8 (confirmed, unchanged),
F1 (completion burst — `TaskCard.tsx`'s `burst` animation), F2 (cold-ash
Won't-Do rendering), F3 (upgraded to a real gradient+glow hearth pill, not
plain text), F4 (list-cleared burst, explicitly commented `(F4)` in
`TaskColumn.tsx`), F6 (folded into `WeeklyReviewSheet`'s "N tasks completed
this week" pill), task reminders (`lib/notifications.ts` sweeps `db.tasks`),
tag rename/delete/recolor (`TaskTagManager.tsx`), subtask reordering
(drag-and-drop in `TaskDetailSheet.tsx`), composer subtask quick-add, the
card drag-handle affordance, the board horizontal-overflow hint, per-column
NLP quick-add, `TaskDetailSheet`'s collapsible "More details" section, and a
`FocusSheet`/`WeeklyReviewSheet`-only "Floating Blade" glass treatment.

**Genuinely still open** (unchanged verdict after re-checking): D5
(Help-Me-Start breakdown), F5 (not applicable — no streak mechanic exists
for tasks by design), bulk select/multi-task actions, swipe-on-card quick
actions, velocity-tilt on drag lift, rubber-band pull-to-create, animated
column-collapse, long-press radial menu, drag-to-dismiss bottom-sheet
detents, shared-element (`layoutId`) transitions, and `TaskDetailSheet`
itself never got the glass treatment (only `FocusSheet`/`WeeklyReviewSheet`
did).

---

## Market findings (context, unchanged from the original report)

Paywalling basics breeds resentment (Todoist's Dec 2025 price hike) · sync/
two-way-calendar-sync is the universal functional failure (Kiwami's local-first
model sidesteps this for the single-user case) · mobile is a second-class
citizen industry-wide (Trello single-column complaint, Linear mobile has no
offline support) · missing power-user primitives (do/due dates, >3 priority
levels, dependencies) · ADHD/neurodivergent needs unmet by mainstream apps.
Nothing here changes with the code — market context doesn't go stale the way
implementation-status claims do.

## Table-stakes — status (re-audited 2026-09-03)

- Quick capture **[DONE]** — `TaskComposer`, always-reachable, sub-5s add.
- NLP date parsing **[DONE]** — reused `parseNoteText` as-is.
- Lists/projects + Kanban columns **[DONE]** — `TaskListManager` + `KanbanBoard`.
- Subtasks/checklists **[DONE]** — `TaskDetailSheet`, now with drag-to-reorder
  and a composer quick-add path too (see Part D).
- Due dates, reminders, recurrence **[DONE]** — upgraded from the old
  "[PARTIAL], reminders NOT wired" claim: `lib/notifications.ts`'s
  `checkDueReminders()` sweeps `db.tasks` directly (any task with a due date
  and no `notifiedAt` fires once it passes, same as a note reminder) — this
  was verified false in the previous file, confirmed true by reading the
  function body directly.
- Priorities (>3 levels) **[DONE]** — 5 levels (none/low/medium/high/urgent).
- Tags/labels + fast filtering **[DONE]** — upgraded from "[PARTIAL], tag
  management NOT DONE": `TaskTagManager.tsx` exists and does exactly that
  (rename/recolor/delete, with cascade cleanup of `tagIds` on delete).
- Search + Command Palette **[DONE]** — `useSearchTasks` merged into the
  existing palette.
- Drag-to-reorder + drag-between-columns **[DONE]** — `@dnd-kit`, both
  directions, plus FLIP animation smoothing on top (Part F #4).
- Dark/light theming + keyboard shortcuts **[PARTIAL]** — theming fully
  done; a `"n"` shortcut focuses the composer (upgraded from "NOT DONE" —
  it exists), but arrow-key card navigation and a keyboard-driven mobile
  column switch still don't.
- Completed-task history/archive **[DONE]** — `TaskArchiveView`, restore +
  hard delete.

---

## Part C — Known simplifications (re-verified 2026-09-03, deliberate, not bugs)

- **Composer's recurrence is simplified** — only None/Daily/Weekly/Monthly
  (`TaskComposer.tsx`), with weekday (for Weekly) or day-of-month (for
  Monthly) auto-derived from the due date rather than exposed as UI. Full
  control (specific weekdays, custom interval/unit, end date) only exists
  in `TaskDetailSheet`. **Still true** — unchanged from Stage 1.
- ~~Tag color is picked from the same 5 fixed swatches everywhere~~ —
  **resolved 2026-09-03, see Part G's build log**: a 6th swatch
  (`tokens.emberHot`) was added to both `TaskListManager.tsx`/
  `TaskTagManager.tsx`'s `swatches` arrays. Still a fixed palette, never an
  open color picker — that part of the original observation stands, just
  with one more option than before.
- ~~No bulk select / multi-task actions~~ — **shipped 2026-09-03**, see
  Part G's build log.
- **Tasks-specific keyboard shortcuts are minimal** — `"n"` focuses the
  composer (`TasksPage.tsx`), confirmed working, but there's still no
  arrow-key card navigation and no keyboard-driven column switch on mobile.
  **Partially resolved** from the original "NOT DONE" claim — worth
  correcting the record rather than re-flagging as untouched.

---

## Part D — Stage 2 delivered (found during this audit, not previously logged)

Every item below was checked directly against the current source, not
assumed. Recorded here so it stops silently vanishing from this file's
history the way it apparently already did once.

- **D1 — Unified do/due date model: shipped.** `TaskDto.doDate` (`src/db/
  types.ts`) exists alongside `dueDate`, independently settable via
  `TaskDetailSheet`'s "Do date" toggle. `completeTask()` (`lib/tasks.ts`)
  rolls a recurring task's `doDate` forward alongside `dueDate`, preserving
  the original offset between the two (diffed in minutes via dayjs, not
  `Date#toISOString()`, to stay in the app's local-time-string convention).
  `useTasksForRange` keys the Calendar overlay off `doDate ?? dueDate`.
- **D2 — Planned-vs-actual time tracking: shipped.** `estimatedMinutes`/
  `actualMinutes` on `TaskDto`, editable in `TaskDetailSheet`'s "More
  details" section (preset buttons — 15/30/60/90/120/240min — plus a custom
  `InputNumber`, and a separate "actual time spent" field, editable any
  time per the type's own comment, not just on completion — deliberately
  not a live start/stop timer, since a background timer is unreliable the
  moment the tab closes). `computeWeeklyStats` (`lib/taskStats.ts`, unit-
  tested in `taskStats.test.ts`, 5 cases) turns this into an "estimate
  accuracy" (~N% over/under) stat in `WeeklyReviewSheet`.
- **D3 — Energy/context-aware selection: shipped.** `TaskDto.energy`
  (`"low"|"medium"|"high"`) — a dedicated field, not a tag-naming
  convention, per its own comment ("filterable/sortable without fragile
  string-matching, which `FocusSheet`'s energy-match filter needs"). Set in
  `TaskDetailSheet`'s "More details" `Segmented`; `FocusSheet`'s own energy
  filter (`EnergyFilter`) reads it directly.
- **D4 — First-class "Won't Do" state: shipped.** `TaskDto.wontDo`/
  `wontDoAt`, set via `markTaskWontDo()` — mutually exclusive with
  `completed`. Reopenable from `TaskDetailSheet` ("Reopen" button) and from
  `FocusSheet`'s queue.
- **D5 — "Help Me Start" breakdown: shipped 2026-09-03.** A `BREAKDOWN_TEMPLATES`
  constant in `TaskDetailSheet.tsx` — three static, generic shapes ("Quick
  3-step", "Research-based", "Errand"), no AI, no per-task customization,
  exactly the original report's scope. A "Help me start" button in the
  Subtasks section toggles a template-picker row; picking one appends its
  steps via the same `applyBreakdownTemplate()` path the manual add-subtask
  flow already used (always appends, never replaces existing subtasks).
- **D6 + D7 — Focus surface + guided daily plan/weekly review: shipped, as
  a deliberate merge.** `FocusSheet.tsx`'s own top-of-file comment: "a
  deliberate D6+D7 merge... 'what am I doing right now' and 'what am I
  doing today' are the same decision for a solo user, not two screens." It
  builds a priority-and-tier-sorted queue (overdue → today → backlog,
  filterable by energy) and surfaces one task at a time with Done/Skip/
  Won't-do/"Schedule for today" actions — the queue *is* the guided daily
  plan, not a separate view. `WeeklyReviewSheet.tsx` is the actual weekly-
  review surface: a 7-day bar chart of completions (`computeWeeklyStats`),
  a won't-do count, and the estimate-accuracy stat from D2 — explicitly
  **not** a streak or score ("deliberately NOT a streak or gamified score...
  matching the project's standing rule against a second Ember Chain for
  tasks").
- **D8 — True data ownership/export: confirmed, unchanged.**
  `exportAll`/`importAll` cover `tasks`/`taskLists`/`taskTags` for free
  (generic `db.tables` iteration) — still true, still needs no extra code.

---

## Part E — Delight features (re-audited 2026-09-03)

- **F1 — Kindling→flame completion burst: shipped.** `TaskCard.tsx`'s
  `TaskCardBody` has a `burst` state — checking a task off triggers a
  `motion.div` radial gradient (`emberHot`→`accent`) that scales 0.3→2.6
  and fades over 600ms, layered behind the checkbox via `AnimatePresence`.
- **F2 — "Cold ash" for Won't-Do: shipped.** A won't-do'd `TaskCard` gets
  `background: ${tokens.ash}14`, an ash-colored left border, and 0.55
  opacity — the exact "cold-ash wash" the original report called for,
  confirmed in the component's own comment ("echoes EmberChain's crater
  fill for a missed bead").
- **F3 — Daily "hearth" momentum indicator: shipped, upgraded beyond the
  original ask.** `TasksPage.tsx`'s "N done today" pill is no longer plain
  text — it's a gradient (`emberHot`→`accent`) pill with a
  `boxShadow` glow, matching the "hearth-pill visual language"
  `WeeklyReviewSheet.tsx`'s own comment explicitly names and reuses.
- **F4 — Milestone "forge" moment on clearing a list: shipped.**
  `TaskColumn.tsx` tracks each column's active-task count and fires a
  radial-gradient burst animation on the exact `>0 → 0` transition (not on
  every render at zero, not on a filter/reorder that leaves the count
  unchanged) — explicitly labeled `(F4)` in its own comment.
- **F5 — Humane "streak freeze"-style grace: still not applicable.** No
  streak-like mechanic exists for tasks, by design (the project's standing
  "no second Ember Chain for tasks" rule) — this stays blocked on a premise
  Kiwami deliberately never builds, not a gap to close.
- **F6 — "Embers earned today" weekly-review summary: shipped, folded into
  D7.** `WeeklyReviewSheet`'s "N tasks completed this week" hearth-pill
  header is this feature — no separate surface was needed once
  `WeeklyReviewSheet` existed.

---

## Part F — The 10 interactive UI/UX features (re-audited 2026-09-03)

1. **Swipe-between-columns with snap [DONE, simplified]** — unchanged: plain
   CSS `scroll-snap` (`MobileBoard` in `KanbanBoard.tsx`), not Framer Motion
   physics, per the original deliberate choice to keep swipe on a native-
   touch-handling channel separate from `@dnd-kit`'s drag gesture.
2. **Swipe-on-card quick actions [NOT STARTED — deliberately, see below].**
3. **Drag lift + shadow + velocity tilt [DONE, 2026-09-03].**
   `TaskCardOverlay` now applies `scale(1.04)` on pickup plus a live
   velocity-derived tilt (`KanbanBoard.tsx`'s `onDragMove` diffs
   `DragMoveEvent.delta.x` against the previous frame's cumulative value —
   cheaper than tracking real timestamps — clamps it to ±8°, and feeds it
   down as a `tilt` prop), on top of a slightly deeper shadow. Resets to 0
   on drag start/end.
4. **FLIP layout animations for list mutations [DONE]** — `TaskCard`'s
   `motion.div` uses `layout={!dragActive}` (framer-motion's FLIP), disabled
   only for the exact window a `@dnd-kit` drag is active (so the two
   positioning systems never fight over the same `transform` in the same
   frame — see `KanbanBoard.tsx`'s `dragActive` comment) and re-enabled the
   instant the drag ends, covering add/remove/reorder-by-filter smoothly.
5. **Rubber-band pull-to-create [NOT STARTED]** — unchanged, still button/
   composer-driven only.
6. **Animated column-collapse with count pill [DONE, 2026-09-03, desktop
   only].** `KanbanBoard.tsx`'s `DesktopBoard` wraps each column in a
   `motion.div` animating `width` (300px ↔ 56px, spring) based on a new
   `collapsedListIds: Set<number>` (local board-view state, never
   persisted — same convention as `scope`/`hideCompleted`/`selectMode`).
   Collapsed state renders `CollapsedColumnRail` (color dot, rotated list
   name, count pill, expand chevron) instead of the full `TaskColumn` —
   deliberately not draggable/droppable while collapsed, since a column you
   can't see into isn't a sensible drop target. `MobileBoard` doesn't get
   this — its single-column swipe view has no equivalent concept.
7. **Long-press radial quick-menu [NOT STARTED — deliberately, see below].**
8. **Bottom-sheet detail with drag-to-dismiss [PARTIAL, unchanged]** —
   `TaskDetailSheet` is still a standard antd Modal slide via `Sheet.tsx`,
   no custom gesture sheet with peek/half/full detents.
9. **Ember completion micro-interaction + haptic [DONE]** — upgraded from
   "PARTIAL": `hapticLight()` still fires on toggle, and the visual
   flame-burst from F1 above now exists too — the gap this item originally
   flagged is closed.
10. **Shared-element card→detail / calendar transition [NOT STARTED]** —
    confirmed absent, no `layoutId` usage anywhere in `src/features/tasks/`.

**#2 and #7 deliberately not attempted (2026-09-03):** both would compete
for the *exact same* physical gesture `@dnd-kit` already owns on a
`TaskCard` — a press-and-hold is already "pick this card up to drag"
(`TouchSensor`'s 200ms `delay` activation constraint), so a swipe-to-
complete gesture (#2) and a long-press context menu (#7) would each need a
real gesture-disambiguation design (how far/fast does a swipe have to
travel before it's not a drag-reorder? does long-press-to-menu race
long-press-to-pick-up, and who wins?) before either is safe to build —
not something to guess at silently. Same category of risk already flagged
for keyboard-nav in Part C/G; recorded here rather than attempted half-built.

### Glassmorphism guidance — status (re-audited)
**[PARTIAL]**, not "[NOT APPLIED]" as previously recorded. `FocusSheet.tsx`
and `WeeklyReviewSheet.tsx` both got the full "Floating Blade" treatment
(`backdropFilter: blur(20px)` on the modal content + a corner gradient
bloom) — the exact treatment `RoutineDetailSheet`/`CommandPalette` set the
precedent for in Phase 3, applied here because both are genuine "hero
moments" (a focused one-task-at-a-time flow; a retrospective summary), not
dense list surfaces. `TaskDetailSheet`, `TaskListManager`, `TaskTagManager`,
and `TaskArchiveView` still use the plain `Sheet.tsx` treatment — still an
open call whether `TaskDetailSheet` specifically (arguably also a "hero
surface" by the report's own intensity-tier logic, being the single most-
visited sheet in the section) should get it too, exactly as originally
flagged.

### Kanban-on-mobile UX guidance — status
**[DONE]**, unchanged — single-column-with-swipe + snap-scroll header strip
+ tap-to-jump, now additionally confirmed to have per-column color-tinted
active pills (`MobileBoard`'s `tint = list.color ?? "var(--accent)"`,
labeled `(Part A.8)` in its own comment) — closing the one remaining Part D
mobile observation about the tab strip being color-flat.

---

## Part G — What's actually left (superseding the old Part F sequencing)

The old "Stage 2 (next)" list is gone — every item on it shipped. Five more
items shipped across two follow-up passes on 2026-09-03 ("wrap up Part
C-D-E", then "wrap Part F + live-readiness") — see the build logs below.
What remains now, roughly in order of value-per-effort:

1. **Swipe-on-card (#2) and long-press radial menu (#7)** — both need a
   real gesture-disambiguation design against `@dnd-kit`'s existing press-
   and-hold-to-drag binding before they're safe to build; see Part F's own
   note on this. The actual design work (not the animation) is the blocker.
2. **`TaskDetailSheet`'s glass treatment** — the one remaining half of the
   "Glassmorphism guidance" item; low effort (the pattern is already
   proven twice in this same feature) if visual consistency with
   `FocusSheet`/`WeeklyReviewSheet` starts to matter.
3. **Bottom-sheet drag-to-dismiss detents (#8)** and **shared-element
   card→detail transition (#10)** — both real animation work, neither
   blocked on a gesture conflict the way #2/#7 are; #8 touches the shared
   `Sheet.tsx` (used by every sheet in the app, so change it carefully),
   #10 would need to reconcile with `TaskCard`'s already-tuned
   drag-vs-FLIP `layout` gating.
4. **Full keyboard navigation** (arrow-key card nav, keyboard column
   switch) — `"n"` already covers quick-capture; the rest is a genuinely
   separate, larger a11y/power-user pass. Deliberately skipped specifically
   because it would fight `KanbanBoard.tsx`'s existing `KeyboardSensor`
   (dnd-kit's own Space-to-pick-up/arrows-to-move drag-reorder binding) on
   the exact same focusable cards — needs its own design pass to
   disambiguate "navigate" from "drag" keyboard intents, not a bolt-on.
5. **Bulk-tag** (as opposed to bulk-archive/bulk-move, both shipped) — the
   action bar (`TasksPage.tsx`) is already shaped to add a third button if
   this turns out to matter.
6. **Color-swatch picker as a real open picker** — the fixed-palette
   constraint itself (now 6 swatches instead of 5) is still there by
   design; only worth revisiting if 6 genuinely isn't enough in practice.

**What to explicitly still avoid** (unchanged from the original report,
re-confirmed true today): a second Ember Chain/streak for tasks (F5 stays
blocked on this by design), a points/coins/pet reward economy, glass on
card bodies or long scrolling backgrounds (`TaskCard`/`TaskColumn` stay
flat, correctly), sole reliance on haptics, and any feature that quietly
requires a server without flagging the local-first compromise.

---

## Build log — "wrap up Part C-D-E" pass (2026-09-03)

Picked up directly from Part G's numbered list as it stood after the fresh
audit: D5, bulk select, and the 5-swatch limit — the three genuinely open
items across Parts C/D/E that didn't need a separate product decision
first (unlike the 1-3-5 cap or NL capture, still untouched, see the Life
tab's own deferred list for the same category of "needs a decision" items).

- **D5 shipped** — see Part D's entry above for the exact implementation.
- **Color-swatch expansion shipped** — `tokens.emberHot` added as a 6th
  swatch to `TaskListManager.tsx`/`TaskTagManager.tsx`, matching Part C's
  updated entry above.
- **Bulk select / multi-task actions shipped**: `lib/tasks.ts` gained
  `bulkArchiveTasks(ids)`/`bulkMoveTasks(ids, listId)` (one transaction
  each, mirroring `reorderBoard`'s existing shape). `TasksPage.tsx` gained
  a `selectMode`/`selectedIds` pair and a "Select" toolbar toggle
  (`TbSquareCheck`) that replaces the scope/hide-completed row with a bulk
  action bar ("N selected" + a "Move to…" `Select` + Move/Archive/Cancel)
  while active — forcing the board's own scope to `"all"`/hideCompleted to
  `false` for the duration, so nothing is invisibly excluded from a bulk
  action. Threaded through `KanbanBoard.tsx` → `TaskColumn.tsx` →
  `TaskCard.tsx`: in select mode a card's complete-checkbox is fully
  replaced by a plain selection checkbox (mixing "mark done" and "select
  for bulk action" on the same tap target invites mis-taps), and
  `useSortable`'s own `disabled: selectMode` option turns off drag entirely
  for the duration — selecting and reordering are two different gestures on
  the same press-and-hold surface, and letting both listen at once risked
  an accidental reorder mid-selection.
- **One real bug found and fixed, caught by a live Playwright pass, not
  typecheck**: adding a `selected`-state highlight to `TaskCardBody`
  initially set it via the `border` shorthand, in the same style object
  that already sets `borderLeft` separately (for the priority-color
  accent) — a real React dev-mode warning ("conflicting property... don't
  mix shorthand and non-shorthand properties"). This exact shorthand/
  longhand mix was already structurally present in the file before this
  change (`border` + `borderLeft` together), but had never fired the
  warning because `border`'s value was a static string across every
  render; making it depend on `selectMode`/`selected` gave React two
  different renders to compare and surfaced it. **Fixed** by dropping the
  border-side rewrite entirely and layering a `boxShadow: "0 0 0 2px
  var(--accent)"` ring on top of the existing (unchanged) `border`/
  `borderLeft` instead — visually a cleaner full-ring highlight anyway, not
  just a same-looking workaround.
- **Verified live in a real browser** (headless Chromium, dark mode):
  created two tasks, opened one, applied the "Research-based" D5 template
  and confirmed the resulting subtasks rendered; confirmed the tag manager
  now shows 6 color swatches; entered select mode, confirmed the bulk
  action bar's Archive/Move buttons are correctly disabled at 0 selected
  and enabled at 1, selected a card and confirmed both the "1 selected"
  count and the card's accent ring rendered — zero console errors/warnings
  on the final pass (one warning caught and fixed mid-pass, per above).
- `npm run typecheck` / `npm run test` (61 tests, unchanged — this pass is
  UI + thin CRUD wrappers over already-tested primitives, not new pure
  logic) / `npm run build` all clean.

---

## Build log — "wrap Part F + live-readiness" pass (2026-09-03)

Picked up Part F's two lowest-risk remaining items (#3, #6 — no gesture
conflicts, unlike #2/#7) plus an app-wide live-readiness pass covering
branding, bundle size, and deployment.

- **#3 — drag lift + velocity tilt: shipped.** See Part F's own entry
  above for the exact mechanism (`onDragMove` delta-diffing, clamped ±8°).
- **#6 — animated column-collapse: shipped**, desktop only. See Part F's
  own entry above (`CollapsedColumnRail`, `motion.div` width spring,
  `collapsedListIds` local state).
- **Verified live in a real browser** (headless Chromium, dark mode,
  1440px): collapsed and re-expanded a column, confirmed the rail (color
  dot + rotated name + count pill) renders and the board returns to normal
  cleanly; performed a real mouse-driven drag (down → move → move → up, not
  a synthetic event) and confirmed the `DragOverlay` ghost visibly tilts
  and scales during the drag — zero console errors or warnings on either.
- `npm run typecheck` / `npm run test` (61 tests) / `npm run build` all clean.

### Live-readiness pass (branding, bundle, deployment)

- **Icons — refined, not replaced.** `public/icons/*`/`favicon-32.png`/
  `apple-touch-icon.png` were re-examined and are **not** a generic
  placeholder — `scripts/generate-icons.mjs` procedurally renders Kiwami's
  actual signature motif (the ember bead-ring + glowing core from
  `SplashScreen.tsx`), not a stand-in shape. One real, tasteful refinement
  made: the outer ring's color changed from stark white (`#ffffff`) to a
  warm ash-tone (`#d6c6b6`) matching the app's own `--border`/`--ash`
  warmth, so it reads as part of the ember palette rather than a
  disconnected neutral outline. Regenerated all 6 output files. **What
  this is not**: a hand-designed vector logo/wordmark — that needs either
  a design tool this environment doesn't have, or explicit creative
  direction/assets from the user. `CLAUDE.md`'s existing "replace before
  shipping anywhere public" caveat is about that gap specifically, and it
  still stands — but "placeholder" undersold what's actually there.
- **Bundle size — audited honestly, not force-optimized.** Full breakdown
  (gzip): `antd` 205kB, `NoteFullEditor` (Tiptap) 128kB, `index` (app
  shell) 109kB, `motion` 38kB, `CalendarPage` 15kB, `TaskDetailSheet`
  20kB, `parseNoteText` (chrono-node) 14kB, `LifePage`/`TasksPage`/
  `NotesPage` 11–11kB each. The app's existing per-section `lazy()`
  boundaries in `App.tsx` already do the real work here — Tiptap's 128kB
  only loads if a note is actually opened, `dnd-kit`'s weight lives inside
  `TasksPage`'s own chunk, etc. The **true critical-path cost** (loaded on
  every visit before any section renders) is `index` + `antd` + `motion` ≈
  351kB gzip, because `App.tsx` imports antd's `ConfigProvider`/`AntApp`
  and wraps the splash in `AnimatePresence` at the top level, both eagerly.
  `antd`'s 205kB reflects genuinely broad usage (Modal, Select, DatePicker,
  Segmented, Popconfirm, the `cssinjs` theming engine, etc. across every
  section) — not a misconfiguration; shrinking it further means using
  fewer antd components, a real product/design decision, not a build
  setting. **One concrete, identified-but-not-executed lever**: `motion`
  (38kB gzip) is only in the critical path because `App.tsx` wraps
  `SplashScreen` in `framer-motion`'s `AnimatePresence` for its exit
  transition — `SplashScreen.tsx` itself is already pure CSS `@keyframes`
  (per `CLAUDE.md`'s Phase 1 notes), so replacing that one `AnimatePresence`
  wrapper with a plain CSS opacity transition (matching the existing
  `.theme-ready` transition convention `index.css` already has) would defer
  `motion`'s 38kB to whichever lazy section loads first instead. **Not
  executed this pass** — `App.tsx`'s splash-mount sequence is a carefully-
  tuned, already-shipped first impression with its own documented
  StrictMode history elsewhere in this codebase, and a real change there
  deserves its own dedicated verification pass, not a rushed edit inside a
  larger multi-front turn.
- **Deployment readiness — confirmed, not executed.** Kiwami has no router
  and no backend (Convex is schema-only), so there is genuinely no special
  server config needed: `npm run build` → `dist/` is a fully self-contained
  static PWA deployable to any static host (Vercel, Netlify, Cloudflare
  Pages, GitHub Pages, S3+CloudFront, etc.) with zero SPA-fallback-rewrite
  rules needed (there's no client-side routing to fall back for) and zero
  environment variables. `vite.config.ts` has no custom `base` — correct
  for a custom domain or a host that serves from the root path; would only
  need `base: "/<repo-name>/"` for a GitHub Pages *project* site
  specifically (not a custom domain or a Vercel/Netlify deploy). Verified
  by actually running `npm run preview` against the current production
  build and confirming both the app and its `manifest.webmanifest` serve
  correctly. **Actually deploying anywhere was deliberately not done** —
  it needs the user's own hosting account/credentials and an explicit
  choice of host, both squarely outside what this session can or should
  decide unilaterally.
- `npm run typecheck` / `npm run test` (61 tests) / `npm run build` all
  clean as the final state of this pass.

---

## Critical files for continuation

- `src/db/types.ts`, `src/db/db.ts` — schema (currently v5; Tasks landed at
  v3, later grown in place — no further version bump needed for anything
  documented above, it's all existing fields)
- `src/lib/tasks.ts`, `src/lib/taskRecurrence.ts`, `src/lib/taskStats.ts`
  (+ their tests) — data layer
- `src/features/tasks/*.tsx` — the page and all its components, including
  `FocusSheet.tsx`/`WeeklyReviewSheet.tsx`/`TaskTagManager.tsx` (all real,
  all shipped — not aspirational despite this file's old status claims)
- `src/components/ColorSwatchPicker.tsx` — shared swatch-picker, extracted
  from `TaskListManager.tsx`, now also used by `TaskTagManager.tsx`
- `src/App.tsx`, `src/components/CommandPalette.tsx`, `src/components/
  BottomNav.tsx`, `src/components/SectionTabs.tsx` — integration points
- `src/lib/notifications.ts` — sweeps both `notes` and `tasks` reminders;
  the Life tab (Phase 7, see `LIFE_TAB_FEATURE_PLAN.md`) later added a third
  sweep for medications here too, same file
- The approved Stage 1 plan (data model + component design rationale in full):
  `C:\Users\apurv\.claude\plans\peppy-riding-perlis.md`

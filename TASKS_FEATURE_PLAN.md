# Kiwami Tasks (Kanban) — Stage 1 Retrospective + Stage 2/3 Plan

This file is the single continuation document for the Tasks/Kanban feature: what
Stage 1 shipped, every bug found and fixed while polishing it, explicit UX rough
edges to weigh for the next pass, and the full original market research carried
forward (nothing from the report has been dropped — each item is now annotated
with its real status against the shipped code).

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

## Part C — Known Stage 1 simplifications (deliberate, not bugs)

Worth deciding explicitly in Stage 2, not silently carried forward:

- **Composer has no subtask quick-add** — subtasks are only addable from
  `TaskDetailSheet` after creation. `NoteComposer` has a similar "not everything
  `NoteEditorSheet` supports" gap, so this matches precedent, but it's a real gap
  if quick task+checklist capture turns out to matter.
- **Composer's recurrence is simplified** — only None/Daily/Weekly/Monthly, with
  weekday (for Weekly) or day-of-month (for Monthly) auto-derived from the due
  date rather than exposed as UI. Full control (specific weekdays, custom
  interval/unit, end date) only exists in `TaskDetailSheet`.
- **No tag deletion/management UI surfaced** — `deleteTaskTag`/`updateTaskTag`
  exist in the data layer (with proper cascade cleanup of `tagIds`) but nothing
  in the UI calls them yet; tags can only be created (inline, from the composer
  or detail sheet) and used as filters, never renamed or removed.
- **Per-column "+" quick-add is plain-text only** — no NLP date parsing (unlike
  the main composer). Deliberate scope trim for a fast "type a title, hit
  Enter" path.
- **No bulk select / multi-task actions** (bulk archive, bulk move, bulk tag).
- **No Tasks-specific keyboard shortcuts** beyond Cmd+K (no "n" for new task,
  no arrow-key card navigation, no keyboard-driven column switch on mobile).
- **No subtask reordering** — subtasks are a flat add-only-appends array.
- **Tag color is fixed to `tokens.accent`** on inline creation (no color picker
  at creation time) — `updateTaskTag` supports changing it later, but nothing in
  the UI exposes that yet (ties back to the "no tag management UI" gap above).

---

## Part D — UX polish opportunities noticed while building/testing

Concrete, specific observations from real screenshots and interaction testing —
not hypothetical. None of these are correctness bugs; all are worth a design
pass in Stage 2.

**Desktop:**
- No visual affordance that a card is draggable (no `cursor: grab`, no visible
  grip handle) — the whole card is simultaneously the click-to-open target and
  the drag surface. Works, but a user has no visual cue drag is even possible
  until they try it. `TaskListManager`'s rows *do* have an explicit
  `TbGripVertical` handle — worth making `TaskCard` consistent with that.
- Empty column body just shows plain gray "No tasks" text — flatter than the
  richer empty-state card treatment `CalendarPage`/`NotesPage` use elsewhere in
  the app.
- No "N more lists →" affordance if the board grows past ~5 columns and needs
  horizontal scroll — currently just a bare `overflow-x: auto` with no visual
  hint more content exists off-screen.
- `TaskDetailSheet` is one long scroll (title → list → priority → tags → due
  date → full recurrence sub-form → subtasks → description → Save → Archive).
  The composer's "Details" collapse pattern (hide recurrence/tags behind a
  toggle) isn't mirrored here — worth collapsing the less-frequently-touched
  recurrence block by default, consistent with the "quick capture, details
  collapsed" philosophy already used elsewhere.
- Archive/Restore is silent (haptic only, no toast) while Archive-from-detail-
  sheet *does* toast ("Archived"). `CLAUDE.md`'s Phase 2 established "toast on
  create/save/delete, not on Done/Missed" as a deliberate rule — Restore sits in
  ambiguous territory between those two categories and should be decided
  explicitly rather than left inconsistent.
- The overdue-date chip on a card just turns the date text red — Notes'
  Timeline view has an explicit "Overdue"/"Today" text badge that's more
  legible at a glance; worth unifying the visual language between the two.

**Mobile:**
- The composer's two `Select`s (list + priority) sit side-by-side above the
  textarea at 390px — fits, but hasn't been tested at a genuinely small phone
  width (360px, still a real device size); worth a pass there specifically.
- Touch drag (`TouchSensor`, 200ms delay) was only exercised via Playwright's
  synthetic mouse events in this verification pass, **not** a real touch-capable
  device/emulator — the swipe-vs-drag disambiguation this relies on (see
  `KanbanBoard.tsx`'s comments) should get a real-device pass before calling
  Stage 1 fully done on touch specifically.
- The mobile column tab-strip shows raw counts ("To Do 3") but no per-column
  color-coded accent beyond the small dot — could lean further into the
  existing ember/ash palette for stronger at-a-glance differentiation while
  swiping.

**Both:**
- Color-swatch pickers (tag creation, list recolor) offer 4–5 fixed swatches
  only, matching `EventEditorSheet`'s existing pattern — fine for consistency,
  but worth reconsidering if real usage wants more than ~5 distinct tag colors.
- "N done today" only counts non-archived tasks — a task completed and then
  immediately archived the same day silently drops out of that count. Minor,
  but worth deciding if it should count `lastCompletedAt` regardless of archive
  state.

---

## Part E — Full original research, carried forward with status against Stage 1

Nothing from the original report is dropped. Each item below is the original
finding, annotated with **[DONE / PARTIAL / NOT STARTED]** against what actually
shipped.

### Market findings (context, unchanged)
Paywalling basics breeds resentment (Todoist's Dec 2025 price hike) · sync/
two-way-calendar-sync is the universal functional failure (Kiwami's local-first
model sidesteps this for the single-user case) · mobile is a second-class
citizen industry-wide (Trello single-column complaint, Linear mobile has no
offline support) · missing power-user primitives (do/due dates, >3 priority
levels, dependencies) · ADHD/neurodivergent needs unmet by mainstream apps.

### (i) Table-stakes — Stage 1 status
- Quick capture **[DONE]** — `TaskComposer`, always-reachable, sub-5s add.
- NLP date parsing **[DONE]** — reused `parseNoteText` as-is.
- Lists/projects + Kanban columns **[DONE]** — `TaskListManager` + `KanbanBoard`.
- Subtasks/checklists **[DONE]**, one level, per plan — `TaskDetailSheet`.
- Due dates, reminders, recurrence **[PARTIAL]** — due dates + recurrence
  (roll-forward model) done; **reminders on tasks are NOT wired** (the existing
  `lib/notifications.ts` reminder sweep only watches the `notes` table's
  `kind: "reminder"`, not `tasks` — a task with a due date does not fire a
  reminder notification today).
- Priorities (>3 levels) **[DONE]** — 5 levels (none/low/medium/high/urgent).
- Tags/labels + fast filtering **[PARTIAL]** — tags + filter done; tag
  management UI (rename/delete/recolor after creation) **NOT DONE** (Part C).
- Search + Command Palette **[DONE]** — `useSearchTasks` merged into the
  existing palette.
- Drag-to-reorder + drag-between-columns **[DONE]** — `@dnd-kit`, both
  directions verified working + persisting.
- Dark/light theming + keyboard shortcuts **[PARTIAL]** — theming fully done;
  Tasks-specific keyboard shortcuts beyond Cmd+K **NOT DONE**.
- Completed-task history/archive **[DONE]** — `TaskArchiveView`, restore + hard
  delete.

### (ii) Genuine differentiators — Stage 2 candidates, status
- **D1 — Unified do-date/due-date model [NOT STARTED].** Still the single
  highest-leverage differentiator per the report (Todoist can't do this at all;
  fragmentation costs ~7–11 hrs/week per the cited estimates). **Now cheaper
  than when the report was written**, because Stage 1 already built the Kanban
  board, the recurrence engine reuse, and the `TaskDto` shape — adding a
  `doDate` field alongside `dueDate` and a "schedule on calendar" action from
  `TaskDetailSheet` is a materially smaller lift now than a cold start. Flag:
  touches the calendar's tested `CalendarItem` pipeline if surfaced there — stage
  it behind a flag if risk to that pipeline is a concern, per the report's own
  fallback guidance.
- **D2 — Planned-vs-actual time tracking [NOT STARTED].** No `estimatedMinutes`/
  `actualMinutes` fields exist on `TaskDto` yet.
- **D3 — Energy/context-aware selection [NOT STARTED].** No energy field exists.
  Could piggyback on the existing tag system (an "energy" tag category) rather
  than a new dedicated field — worth deciding in Stage 2 design, not assumed
  here.
- **D4 — First-class "Won't Do" state [NOT STARTED].** `TaskDto.completed` is
  still binary; no third terminal state exists. The report's guidance to render
  it as "cold ash" (extending the Ember Chain metaphor) is directly compatible
  with the priority-color/border language `TaskCard` already uses.
- **D5 — "Help Me Start" breakdown (template-based, no AI) [NOT STARTED].**
- **D6 — Overwhelm-reduction Focus surface [NOT STARTED].**
- **D7 — Guided daily plan + weekly review [NOT STARTED].**
- **D8 — True data ownership/export [PARTIAL]** — `exportAll`/`importAll` in
  `src/db/db.ts` already include the new `tasks`/`taskLists`/`taskTags` tables
  for free (they iterate `db.tables` generically), so JSON export/import of
  tasks **already works** with zero additional code. Worth explicitly
  verifying/mentioning in Stage 2 rather than re-discovering it.

### (iii) Delight features — status
- **F1 — Kindling→flame completion burst [NOT STARTED]** — completing a task
  today is a plain checkbox strikethrough, no ember-flourish micro-interaction.
- **F2 — "Cold ash" for Won't-Do [NOT STARTED]** — blocked on D4 existing first.
- **F3 — Daily "hearth" momentum indicator [PARTIAL]** — `TasksPage`'s "N done
  today" text is the deliberately-non-streak version of this the report called
  for; it has no visual glow/warmth treatment yet, just text.
- **F4 — Milestone "forge" moment on clearing a list [NOT STARTED]**.
- **F5 — Humane "streak freeze"-style grace [NOT STARTED]** — not applicable
  until some streak-like mechanic exists for tasks, which Stage 1 deliberately
  avoided building.
- **F6 — "Embers earned today" weekly-review summary [NOT STARTED]** — blocked
  on D7 (no weekly review surface exists yet).

### (iv) The 10 interactive UI/UX features — status
1. **Swipe-between-columns with snap [DONE, simplified]** — implemented via
   plain CSS `scroll-snap` (not Framer Motion physics/rubber-band) per the plan's
   explicit choice to keep swipe on a "native browser touch handling" channel,
   separate from `@dnd-kit`'s drag gesture. No rubber-band overscroll animation
   at the ends (native browser overscroll behavior only).
2. **Swipe-on-card quick actions [NOT STARTED]** — no swipe-to-complete/
   swipe-to-archive gesture on cards; completion is checkbox-tap-only today.
3. **Drag lift + shadow + velocity tilt [PARTIAL]** — `DragOverlay` shows a
   static elevated-shadow copy (`TaskCardOverlay`); no scale-up "picked up" cue
   and no velocity-based tilt.
4. **FLIP layout animations for list mutations [NOT STARTED]** — cards
   currently snap to new positions; no `layout`/`AnimatePresence` smoothing on
   add/remove/reorder/filter.
5. **Rubber-band pull-to-create [NOT STARTED]** — quick-add is button/composer-
   driven only, no overscroll-to-create gesture.
6. **Animated column-collapse with count pill [NOT STARTED]** — columns are
   always fully expanded; no collapse-to-rail affordance.
7. **Long-press radial quick-menu [NOT STARTED]** — no long-press context menu
   on cards; all actions require opening the full detail sheet.
8. **Bottom-sheet detail with drag-to-dismiss [PARTIAL]** — `TaskDetailSheet`
   already becomes a bottom sheet on mobile via the existing `Sheet.tsx`
   convention, but has no drag-to-dismiss/velocity-snap detents (peek/half/full)
   — it's a standard antd Modal slide-up/down, not a custom gesture sheet.
9. **Ember completion micro-interaction + haptic [PARTIAL]** — `hapticLight()`
   fires on checkbox toggle (Android-only, per the Vibration API constraint
   already documented in this codebase); no visual flame-burst animation.
10. **Shared-element card→detail / calendar transition [NOT STARTED]** — no
    `layoutId`-based morph between a card and its detail sheet, or between a
    task and a future calendar placement (ties to D1).

### Glassmorphism guidance — status
**[NOT APPLIED]** — Stage 1 deliberately kept the Tasks surface flat (matching
the report's own "keep the working surface flat, glass only on floating
overlays" guidance, and consistent with `MonthView`/`AgendaView`'s existing
"dense grid surfaces skip heavy blur" precedent from Phase 3). Sheets (
`TaskDetailSheet`, `TaskArchiveView`, `TaskListManager`) currently use the plain
`Sheet.tsx` treatment, not the "Floating Blade" glass/bloom treatment
`RoutineDetailSheet`/`CommandPalette` got in Phase 3 — worth deciding in Stage 2
whether `TaskDetailSheet` (a "hero surface" by the report's own intensity-tier
logic) should get that same treatment for visual consistency with
`RoutineDetailSheet`.

### Kanban-on-mobile UX guidance — status
**[DONE]** — single-column-with-swipe + snap-scroll header strip + tap-to-jump,
exactly as recommended, verified working in the Playwright pass.

---

## Part F — Recommended Stage 2/3 sequencing (updated)

Given Stage 1 is now real (not hypothetical), the report's original staging
still holds, with one adjustment: **D8 is already done for free**, so it drops
out of the "to build" list entirely.

**Stage 2 (next):**
1. Fix the Part C/D gaps that are cheap and high-value: tag management UI,
   composer subtask quick-add, drag-handle affordance + empty-state polish,
   toast-consistency decision for Restore.
2. **D1 (unified do/due model)** — the defensible moat, now cheaper to build
   than when the report was written.
3. **D4 (Won't-Do state)** + **F2 (cold-ash rendering)** together — low cost,
   high signal, and they're naturally one unit of work (a new terminal state
   plus its one visual treatment).
4. **F1 (completion burst)** + **F3 upgrade (visual hearth, not just text)** —
   cheap, reinforces the brand, no new data model needed.
5. Wire task due dates into the existing reminder sweep (`lib/
   notifications.ts`) — currently only `notes`-table reminders fire; this is a
   real functional gap for any task with a due date, not just a nice-to-have.

**Stage 3:**
6. **D3 (energy tags)** — decide tag-reuse vs. dedicated field first.
7. **D6 (focus surface)**, **D7 (daily plan/weekly review)**, **D2 (planned-vs-
   actual)** — deepen retention, all still genuinely unbuilt.
8. Interactive-feature backlog items #2, #4, #6, #7, #10 from Part E(iv) —
   pick opportunistically once the above land; FLIP animations (#4) are the
   cheapest, highest-perceived-polish item on that list and could be pulled
   forward if there's spare capacity in Stage 2 instead.

**What to explicitly still avoid** (unchanged from the original report): a
second Ember Chain/streak for tasks, a points/coins/pet reward economy, glass on
card bodies or long scrolling backgrounds, sole reliance on haptics, and any
feature that quietly requires a server without flagging the local-first
compromise.

---

## Critical files for continuation
- `src/db/types.ts`, `src/db/db.ts` — schema (currently v3)
- `src/lib/tasks.ts`, `src/lib/taskRecurrence.ts` (+ its test) — data layer
- `src/features/tasks/*.tsx` — the page and all its components
- `src/App.tsx`, `src/components/CommandPalette.tsx`, `src/components/
  BottomNav.tsx`, `src/components/SectionTabs.tsx` — integration points
- `src/lib/notifications.ts` — currently notes-only; the Stage 2 reminder-sweep
  gap noted above lives here
- The approved Stage 1 plan (data model + component design rationale in full):
  `C:\Users\apurv\.claude\plans\peppy-riding-perlis.md`

# Kiwami "Life" Tab — Build Plan

**Status: COMPLETE — all phases A-L shipped, plus Phase M** (Now/Focus zone
expanded to multiple items + per-category progress badges) **and Phase N**
(Today/This Week/All scope control), both drawing on Appendix B below. See
§11's checklist (all boxes checked) and §11a's Build Log for the full
record: four real bugs found by
actually driving the browser and fixed (a weekly-recurrence-with-
no-weekday-selected data-loss bug, a React-StrictMode Dexie `BulkError`
race, a same-day-doses-auto-missed-too-early ordering bug, and a PWA
font-precache gap), 61 tests passing (up from 48), zero console errors on
every verification pass including a genuine offline reload against the
production build. `CLAUDE.md`'s `## Phase 7` entry and `README.md`'s new
screenshots are the condensed public record; this file stays as the full
detail. This is the resumable spec for the Life tab —
a new top-level section unifying medications, chores/household, inventory, and
wishlist/buy-list on top of Kiwami's existing Calendar/Notes/Tasks. Written so
work can start (or resume, in any future session) directly from this file
without re-deriving the research or the architecture decisions below.

Source material: a deep-research report on the "everything for today" niche
(market scan of Bearable/Sunsama/Tiimo/Medisafe/etc., the dead-end on
closed-app web reminders, wishlist/buy-list lifecycle patterns, multi-profile
namespacing). The report's own executive summary and staged recommendations
are condensed into this plan; nothing in it should be treated as separately
"still to read" — this file supersedes it as the working spec.

---

## 0. Decisions already locked in (do not re-litigate)

1. **Nav placement**: Life is added as a **4th top-level tab** —
   `Calendar | Notes | Tasks | Life`. Calendar stays the default/home section
   (`App.tsx`'s `section` state keeps initializing to `"calendar"`). The
   report's own recommendation to make Life the default home is **not**
   taken — lower risk, easily flipped later in one line once the tab has
   proven itself.
2. **No multi-profile / email-namespace system in this pass.** The report's
   Section 6 (email as a local per-device profile key, `profileId` on every
   table) is **deferred**. Kiwami stays single-owner, keyed by the existing
   `getDeviceId()` (`ownerId: string` on every table, unchanged). All new
   Life tables use the exact same `ownerId` convention as `tasks`/`notes` —
   nothing here should make adding real profiles harder later, but nothing
   is built for it now.
3. **Reliable closed-app reminders (Capacitor native wrapper, Web Push +
   server) are out of scope.** Same honest "best-effort while the app is
   open" reminder model Kiwami already ships for Notes/Tasks
   (`lib/notifications.ts`) extends to medications/chores — not a new,
   stronger guarantee. See §7.

---

## 1. What's already true about this codebase (don't rebuild it)

Before this plan adds anything, these pieces already exist and this build
must **reuse them, not fork them**:

- **`expandOccurrences(anchorDate, rule, rangeStart, rangeEnd)`**
  (`src/lib/recurrence.ts`) — pure, takes any `RecurrenceRuleDto`-shaped
  object (doesn't read `.id`/`.eventId`). Already reused twice: once for
  calendar events, once for `TaskDto.recurrence` (an embedded
  `TaskRecurrenceDto`, not a `recurrenceRules` table row).
- **`rollTaskDueDateForward(currentDueDate, recurrence, allDay)`**
  (`src/lib/taskRecurrence.ts`) — rolls a due date forward to the *next*
  occurrence after `currentDueDate`, anchored at whatever date you pass in.
  This is the key reuse insight for chores (§4.2): passing `todayKey()`
  instead of the stored due date is the *entire* difference between
  "reschedule from fixed schedule" and "reschedule from completion date."
- **`computeStreakFromStatuses(byDate: Map<string, OccurrenceStatusValue>, today)`**
  (`src/lib/streak.ts`) — pure, keyed by a plain `Map`, has zero knowledge of
  `eventId` or Dexie. Reusable as-is for medication adherence (§4.1) by
  building the same shape of `Map` from `medicationLogs` rows.
- **`OccurrenceStatusValue = "pending" | "done" | "missed"`** is already
  reused once outside routines: `isFoodSlot` events relabel it in the UI
  (`done` → "Ate", `missed` → "Skipped") instead of inventing a parallel
  enum. Medication logs do the same relabeling trick (`done` → "Taken",
  `missed` → "Skipped") — see §3.
- **`resolveOverdueOccurrences()`** (`src/lib/occurrences.ts`, called once on
  mount in `App.tsx`) sweeps forgotten `"pending"` rows to `"missed"`. Meds
  get a sibling function, not a merged one (§7).
- **`checkDueReminders()`** (`src/lib/notifications.ts`, swept every 60s by
  `App.tsx`'s `ReminderSweeper`) already fires a real `Notification` (or an
  antd toast fallback) for due Notes-reminders and due Tasks. Extended, not
  duplicated, for medications (§7).
- **`EmberChain`** (`src/components/EmberChain.tsx`) takes `beads` +
  optional `milestoneStreak` — reusable verbatim for medications, passing
  the medication's own cached `streakCount`.
- **Correction against the source report**: the report frames streaks as
  "habit strength, gradual decay, never fully zeroes." That is **not** what
  `computeStreakFromStatuses` actually does today — it's a consecutive-done-
  day counter that resets to 0 the moment `today` (or the most recently
  resolved day) is `"missed"`. That's Kiwami's real, already-shipped,
  already-accepted behavior. This plan does **not** change streak math for
  routines or medications — medications inherit the *actual* semantics,
  not the report's aspirational framing. (The guilt-free part that *is*
  real and worth carrying forward: a miss renders as cold `ash`, never
  alarm-red, and is never hidden or silently discarded — see §6.)
- **CRUD/hook shape convention**: every domain (`lib/tasks.ts`,
  `lib/notes.ts`) exports plain async functions (`createX`/`updateX`/…) plus
  `useX()` live-query hooks built on `useLiveQuery`. Every new Life file
  follows this exact shape — components never touch `db` directly.

---

## 2. Scope for this build

**In scope (Phase 1 from the report, adapted to the decisions in §0):**
medications (scheduled + PRN) with adherence streak, chores (recurring +
one-off, with a reschedule-from-completion option), household inventory with
a derived "running low" flag, wishlist → buy-list lifecycle, a unified Today
Digest, nav + Command Palette wiring, and a reminder extension for meds —
all inside the existing no-backend, local-first architecture.

**Explicitly deferred** (report's own Phase 2/3, plus the two items decided
in §0):
- Multi-profile / email namespace (§0.2).
- Capacitor native wrapper for OS-level alarms.
- Local bundled drug-interaction checker (liability + heavy asset).
- Automated price tracking (needs scraping/a server — impossible locally;
  manual price + a product URL the user re-checks themselves is final, not
  a placeholder for something better later).
- Full Command-Palette search indexing of every wishlist/inventory item on
  day one — ships with quick-actions + nav shortcuts first (§8); can grow
  into full title-substring search the same way `useSearchTasks` did, as a
  follow-up, not a blocker.

---

## 3. Data model — Dexie v5 (purely additive, no `upgrade()` needed)

Same convention as the v2/v3 bumps in `src/db/db.ts`: new tables only, no
existing table's shape changes, so no migration function required.

```ts
// src/db/types.ts additions

export type MedicationScheduleType = "scheduled" | "prn";

export interface MedicationDto {
  id?: number;
  ownerId: string;
  name: string;
  dosage?: string;          // free text, e.g. "500mg"
  form?: string;             // free text, e.g. "tablet", "drops"
  scheduleType: MedicationScheduleType;
  recurrence?: TaskRecurrenceDto | null; // scheduled only — embedded, same convention as TaskDto.recurrence
  times: string[];           // HH:mm[], scheduled only — supports multiple doses/day
  doseCountRemaining?: number;
  refillThresholdDays?: number; // alert once projected days-remaining <= this
  notes?: string;
  streakCount?: number;      // cached, scheduled only — mirrors EventDto.streakCount exactly
  active: boolean;           // soft pause — inactive meds drop out of Today Digest/reminders, history kept
  createdAt: number;
  updatedAt: number;
}

export interface MedicationLogDto {
  id?: number;
  medicationId: number;
  occurrenceDate: string;    // YYYY-MM-DD
  scheduledTime?: string;    // HH:mm — which of `times` this resolves (scheduled only; absent for PRN)
  status: OccurrenceStatusValue; // reused verbatim — UI relabels done->"Taken", missed->"Skipped" (FoodLogSheet precedent)
  resolvedAt?: number;       // epoch ms
}

export interface ChoreDto {
  id?: number;
  ownerId: string;
  title: string;
  notes?: string;
  recurrence?: TaskRecurrenceDto | null; // null = one-off chore
  rescheduleFromCompletion: boolean; // true = next occurrence anchored on actual completion date (Chore Master model)
  dueDate?: string;
  lastCompletedAt?: number;
  completed: boolean;        // one-off chores only; recurring ones stay false and roll dueDate forward
  archived: boolean;
  archivedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface InventoryItemDto {
  id?: number;
  ownerId: string;
  name: string;
  category?: string;
  quantity: number;
  unit?: string;              // free text: "rolls", "bottles", "g"
  minQuantity?: number;       // runningLow := minQuantity != null && quantity <= minQuantity (derived, never stored)
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export type WishlistPriority = "low" | "medium" | "high";
export type ShoppingUrgency = "now" | "soon";

export interface WishlistItemDto {
  id?: number;
  ownerId: string;
  title: string;
  priority: WishlistPriority;
  category?: string;
  notes?: string;
  productUrl?: string;
  manualPrice?: number;
  promoted: boolean;          // true once promoteToBuyList() ran — row stays (dimmed), never deleted by promotion
  promotedAt?: number;
  archived: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface BuyListItemDto {
  id?: number;
  ownerId: string;
  title: string;
  store?: string;
  urgency: ShoppingUrgency;
  manualPrice?: number;
  productUrl?: string;
  bought: boolean;
  boughtAt?: number;
  sourceWishlistId?: number;  // set when created via promoteToBuyList()
  sourceInventoryId?: number; // set when created via the running-low -> buy-list loop
  createdAt: number;
  updatedAt: number;
}
```

```ts
// src/db/db.ts — version(5).stores(), all v4 stores unchanged plus:
medications: "++id, ownerId, scheduleType, active",
medicationLogs: "++id, medicationId, occurrenceDate, &[medicationId+occurrenceDate+scheduledTime]",
chores: "++id, ownerId, archived, dueDate",
inventoryItems: "++id, ownerId, category",
wishlistItems: "++id, ownerId, archived, promoted",
buyListItems: "++id, ownerId, bought, urgency",
```

`exportAll()`/`importAll()` in `db.ts` iterate `db.tables` generically — the
new tables are backed up/restored automatically, no change needed there.

---

## 4. Data layer (`src/lib/*.ts`) — one file per domain, mirrors `lib/tasks.ts`

### 4.1 `lib/medications.ts`
- `createMedication(input: NewMedicationInput)`, `updateMedication(id, patch)`,
  `deleteMedicationForever(id)`.
- `logMedicationDose(medicationId, { status, occurrenceDate?, scheduledTime? })`
  — **PRN**: always inserts a fresh `status:"done"` row stamped `resolvedAt: now`
  (a PRN med can be logged multiple times a day; no uniqueness constraint).
  **Scheduled**: upserts the `[medicationId+occurrenceDate+scheduledTime]` row,
  then calls `recomputeAndCacheMedicationStreak`.
- `recomputeAndCacheMedicationStreak(medicationId)` — builds a
  `Map<string, OccurrenceStatusValue>` from that medication's logs and calls
  `computeStreakFromStatuses` **unmodified**, writes `medications.streakCount`.
  (For a medication with multiple `times`/day, the day only counts "done" once
  every scheduled time that day resolved `"done"` — worth a one-line comment
  in the real code, not a new pure function.)
- `resolveOverdueMedicationDoses()` — sibling to `resolveOverdueOccurrences()`,
  called once on mount. For every `active && scheduleType==="scheduled"`
  medication, expands today (and any recent unresolved day) via
  `expandOccurrences`, and for every `(date, time)` pair now in the past with
  no log row, inserts `status:"missed"`.
- `useMedications()`, `useMedicationLogs(medicationId, days)`,
  `useTodayMedicationOccurrences()` (today's due `(medication, time)` pairs
  joined with today's logs — the Today Digest/Medications view's single data
  source), `useRefillAlerts()` (active scheduled meds where
  `doseCountRemaining / times.length <= refillThresholdDays`).

### 4.2 `lib/chores.ts`
- `createChore(input)`, `updateChore(id, patch)`, `archiveChore`/`unarchiveChore`,
  `deleteChoreForever`.
- `completeChore(id, completed)` — **forks `completeTask()`'s exact shape**:
  if `!completed`, just uncheck. If completing a recurring chore, compute the
  next due date via `rollTaskDueDateForward`, anchored at:
  - `todayKey()` when `rescheduleFromCompletion` is true (Chore Master model —
    "3 days after you actually did it," regardless of when it was due), or
  - the chore's existing `dueDate` when false (fixed schedule, identical to
    how `completeTask` already behaves for recurring tasks).

  That anchor swap is the *entire* new logic this function needs —
  `rollTaskDueDateForward` already takes an arbitrary anchor date, so no
  change to it or to `expandOccurrences` is required. A one-off
  (non-recurring) chore just sets `completed: true` like a plain task.
- `useChores()`, `useTodayChores()` (`dueDate <= today && !archived && !completed`).

### 4.3 `lib/inventory.ts`
- `createInventoryItem`, `updateInventoryItem`, `deleteInventoryItem`,
  `adjustQuantity(id, delta)`.
- `useInventoryItems()`, `useRunningLowItems()` — a pure derived filter
  (`minQuantity != null && quantity <= minQuantity`) over `useInventoryItems()`,
  worth its own tiny exported pure function (`isRunningLow(item)`) so it's
  unit-testable without a Dexie fixture.
- `addRunningLowToBuyList(item)` — creates a `BuyListItemDto` with
  `sourceInventoryId`, `urgency: "soon"` default.

### 4.4 `lib/shopping.ts`
- `createWishlistItem`, `updateWishlistItem`, `archiveWishlistItem`,
  `deleteWishlistItemForever`.
- `promoteToBuyList(wishlistItemId, { store?, urgency })` — **one Dexie
  transaction**: inserts a `BuyListItemDto` with `sourceWishlistId` set, and
  patches the wishlist row to `promoted: true, promotedAt: now`. The wishlist
  row is never deleted by promotion — it stays visible (dimmed/struck in the
  UI), matching the report's explicit "promote," not "move," language.
- `createBuyListItem`, `updateBuyListItem`, `markBought(id, bought)`,
  `deleteBuyListItemForever`.
- `useWishlistItems()`, `useBuyListItems()`.
- `formatBuyListAsText(items)` — plain-text formatted list (grouped by
  store, matching the report's InventoryDo-style organization).
- `shareOrCopyList(text)` — feature-detects `navigator.canShare` /
  `navigator.share` first; always falls back to `navigator.clipboard.writeText`.
  A "Share" button is only ever the primary action when `canShare()` returns
  true; otherwise the primary action is labeled "Copy," never a share icon
  that silently no-ops on unsupported browsers (desktop Firefox, etc.).

---

## 5. UI — `src/features/life/`

Mirrors `src/features/tasks/`'s file shape:

- **`LifePage.tsx`** — the section shell: toolbar (`SectionTabs` on desktop /
  `BottomNav` on mobile handle top-level nav already; this toolbar carries a
  second-level `Segmented`: **Today | Medications | Chores | Inventory |
  Shopping**) + the active sub-view. Same shape as `TasksPage.tsx`.
- **`TodayDigest.tsx`** — the default sub-view; see §6 for its exact section
  order and its relationship to Calendar's existing `TodayView.tsx`.
- **`MedicationsView.tsx`**, **`MedicationCard.tsx`** (shows dosage, next due
  time, a compact `EmberChain` fed by `streakCount`, a refill-alert badge),
  **`MedicationEditorSheet.tsx`** (name/dosage/form/schedule-type/times/
  recurrence/dose-count/refill-threshold), **`PrnQuickLogButton.tsx`** (a
  single tap logs "taken now," no schedule required).
- **`ChoresView.tsx`**, **`ChoreCard.tsx`**, **`ChoreEditorSheet.tsx`**
  (title/notes/recurrence/reschedule-from-completion toggle).
- **`InventoryView.tsx`**, **`InventoryItemRow.tsx`** (quantity stepper +
  running-low badge), **`InventoryEditorSheet.tsx`**.
- **`ShoppingView.tsx`** — internal `Segmented` toggle: **Wishlist | Buy
  list**. **`WishlistCard.tsx`** (priority, price, product-link-out,
  "Promote to buy list" action), **`BuyListRow.tsx`** (store/urgency, "Mark
  bought" checkbox), **`ShoppingItemEditorSheet.tsx`** (shared editor,
  branches on which list it's editing).
- **`useLifeSearch.ts`** — Command Palette feed, mirrors `useSearchTasks.ts`.

---

## 6. Today Digest — exact composition

The report's recommended section order, adapted:

1. **Due & Overdue** — the catch-up strip: any missed medication dose,
   overdue chore, or urgent buy-list item. Neutral amber "needs attention"
   framing, never a red alarm block (see §9's guilt-free rules).
2. **Now / Next** — the single most imminent time-bound item across meds +
   calendar events (Tiimo's "what's coming next," not the full backlog).
3. **Medications** — today's scheduled doses (take/skip) + a PRN quick-log
   button.
4. **Schedule** — today's calendar events/routines/food, read via the
   **same `useCalendarEvents(today, today)` hook Calendar's own
   `TodayView.tsx` already calls** — no new query, no new logic.
5. **Tasks** — today's tasks, read via the **same `useTasks()` hook**
   `TodayView.tsx` already calls, filtered the same way.
6. **Chores & Household** — today's due chores + any running-low inventory
   flags (`useRunningLowItems()`).
7. **Shopping nudges** — buy-list items with `urgency: "now"` only;
   wishlist never appears here by design (report: "wishlist stays off the
   daily view by default").

**Deliberate decision — relationship to `features/calendar/TodayView.tsx`:**
that view is **left untouched**. It's calendar-scoped (events/routines/
food/tasks/reminders) and already has passing coverage and a documented
reason for living inside `CalendarPage`'s view switcher rather than as its
own section (see `CLAUDE.md`'s Phase 6). Rebuilding or merging it carries
real regression risk for a component that already works. The new
`TodayDigest` is a **superset** — same event/task data via the same hooks,
plus medications/chores/inventory/shopping that Calendar's view has no
business showing. The two screens overlapping on events/tasks is an
accepted trade-off, not a bug — identical reasoning to the one `CLAUDE.md`
already documents for Week/Day's independent note/task overlap-avoidance
columns in Phase 6. If this overlap ever actually bothers real usage, the
follow-up is to fold `TodayView` into `TodayDigest` and turn Calendar's
"Today" option into a jump-to-Life-tab shortcut — not a day-one requirement.

---

## 7. Reminders — extending the existing best-effort model

No new polling loop. `App.tsx`'s existing `ReminderSweeper` (60s interval,
already calling `checkDueReminders`) gets one more check added inside the
same tick: for every active scheduled medication, compute today's due
`(date, time)` pairs via `expandOccurrences`, and for any pair that just
became `<= now` with no log row yet, fire a `Notification` (or the existing
antd-toast fallback) — symmetric to how a due `TaskDto`/`NoteDto` reminder
already fires today. This **notifies**; it does not **log** — the dose stays
open until the user acts, or until `resolveOverdueMedicationDoses()` (run
once on mount, §4.1) converts a still-open past dose into `status:"missed"`.

Every medication/chore reminder surface in the UI carries the same honest
label Kiwami already uses: reminders are **best-effort while the app is
open**, with a catch-up list on reopen — never implied to fire from a fully
closed tab. This is not new copy to invent; it's the same framing
`lib/notifications.ts`'s existing comments already use for Notes/Tasks.

---

## 8. Nav + Command Palette wiring

- **`src/components/BottomNav.tsx`**: `Section` type gains `"life"`; `ITEMS`
  gains a 4th entry (suggested icon: `TbLayoutDashboard` from `react-icons/tb`
  — final call at implementation time, zero cost to change).
- **`src/components/SectionTabs.tsx`**: same 4th `Segmented` option, same icon.
- **`src/App.tsx`**: add `LifePage` to the existing `lazy()` import block
  (same pattern as `CalendarPage`/`NotesPage`/`TasksPage`), add the
  `section === "life"` branch. `section` state's default stays `"calendar"`
  (§0.1).
- **Command Palette** (`src/components/CommandPalette.tsx`): add
  `useLifeSearch` as a 4th result group (same flat `staticActions`/`results`/
  `runIndex` scheme Tasks already integrated into), plus static quick-actions:
  "Log medication dose," "Add to buy list," "Jump to Life." Full
  title-substring indexing of every wishlist/inventory row can start as a
  smaller slice (quick-actions + nav only) and grow later — see §2's deferred
  list.

---

## 9. UI design direction — glassmorphism, dark-minimalist, mobile, browser-aware

This section is the concrete translation of "modern glassmorphism, minimalist
dark palette, top-notch mobile, keep browser restrictions in mind" into
rules that plug into what already exists — **no new design system, no new
tokens**, this reuses Phase 3's ("Ember & Ash") intensity-tier convention
verbatim.

**Glass tier — hero vs. dense, exactly like Phase 3 already splits:**
- *Hero surfaces* get the existing "Floating Blade" treatment
  (`.kiwami-blade` CSS class + an inner `overflow:hidden` wrapper for a
  blurred gradient bloom, `backdropFilter: blur(20px)`) — apply to:
  `TodayDigest`'s header/hero card, `MedicationEditorSheet`, and a
  milestone moment when a medication's `EmberChain` hits 7/30/100/365
  (reuses the existing forged-bead treatment, zero new code).
  `.kiwami-blade:focus-within` (lit `var(--diamond)` border on focus) is
  reused for any new search/quick-add input worth that moment.
- *Dense list surfaces* (`ChoresView`, `InventoryView`, `ShoppingView`'s
  rows) stay flat, matching `MonthView`/`AgendaView`'s existing
  "clean, dense-information-friendly" convention — no blur, no oversized
  type, `.label-caps` + `var(--font-mono)` for data (quantities, dosages,
  dates), same as every other dense grid surface in the app already does.

**Color — zero new tokens, reuse `useTokens()` exclusively:**
`accent`/`emberHot` for medications (closest kin to routines — the only
other adherence-tracked, Ember-Chain-bearing domain); `teal` for chores/
household (matches food's existing "secondary domain" role); `gold` for
`urgency: "now"` buy-list items; `danger` reserved strictly for destructive
actions (delete), **never** for a missed dose or overdue chore — those stay
`ash`. `diamond` stays exclusively reserved for streak milestones, per the
existing rule — not reused for a "perfect day" badge or anything else new.

**Density defaults (the report's own overwhelm guardrail, and the literal
Kiwami pattern for it):** every Life sub-view defaults to showing only
active/due items — archived wishlist items, bought buy-list items, inactive
medications, and completed/archived chores hide behind an explicit "Show
archived/bought/completed" toggle, mirroring `TasksPage`'s existing
`hideCompleted` switch precedent exactly. Nothing is ever hard-deleted by a
filter — it's hidden, same as Tasks.

**Mobile / touch:** every new tappable row (`MedicationCard`, `ChoreCard`,
`InventoryItemRow`, `BuyListRow`, `WishlistCard`) targets the same ≥44px
touch height existing rows already use; anything that can sit at the
bottom of the viewport reuses the existing `.safe-bottom`
(`env(safe-area-inset-bottom)`) class verbatim rather than inventing new
padding math. Sub-view switching inside `LifePage` degrades the same way
`TasksPage`'s multi-column-vs-swipe board already does at `useIsMobile()`'s
existing breakpoint convention — no new breakpoint invented.

**Browser-constraint rules to hold the line on (these are the "keep
browser restrictions in mind" ask, made concrete):**
1. No `color-mix()` — `vite.config.ts`'s build target
   (`safari14`/`chrome80`/`firefox78`/`edge88`) doesn't support it; any
   alpha-blended background goes through `useTokens()` concrete hex +
   string-suffix, exactly like `eventColor()` already does — never
   `"var(--x)" + "22"` string concatenation.
2. `backdropFilter` blur is already accepted precedent (Phase 3) — every
   hero surface must still be fully usable if blur silently no-ops
   (older Firefox); never gate functionality on blur actually rendering.
3. Web Share: feature-detect `navigator.canShare`/`navigator.share` before
   ever showing a "Share" affordance as the primary action; clipboard-copy
   is the default, always-present fallback (§4.4).
4. Reminders stay best-effort and are labeled as such — no UI copy implies
   a closed-tab alarm (§7).
5. IndexedDB/Safari-ITP eviction risk: since Life-tab data (medications,
   inventory) is real, non-disposable user data, add one line to
   `SettingsSheet`'s existing export/import UI nudging periodic export —
   `exportAll()`/`importAll()` already cover the new tables automatically
   (they iterate `db.tables` generically), so this is a copy change, not a
   code change.
6. No new npm dependency unless something below genuinely can't be built
   with what's already installed (`dayjs`, `Dexie`, `antd`, `framer-motion`,
   `react-icons/tb`) — check before adding anything.

---

## 10. Testing

Follows the existing convention: **unit-test genuine pure logic branches
only** (CRUD itself isn't unit-tested elsewhere in this codebase — Tasks/
Notes don't have CRUD tests either, just their pure recurrence/streak
helpers do).

- `chores.test.ts` (or extend `taskRecurrence.test.ts`'s existing suite) —
  the reschedule-from-completion vs. fixed-schedule anchor-date branch
  described in §4.2.
- `inventory.test.ts` — `isRunningLow(item)`'s pure derivation.
- Medication streak needs **no new test** — it calls
  `computeStreakFromStatuses` unmodified, already covered by
  `streak.test.ts`'s existing 6 cases. Worth one small test confirming the
  `medicationLogs` → `Map<string, OccurrenceStatusValue>` builder feeds it
  correctly, not re-testing the streak math itself.

`npm run typecheck` / `npm run test` / `npm run build` must stay clean at
the end of every phase in §11, matching this repo's existing "must be clean
before any change is done" rule.

---

## 11. Phased build checklist (resumable — pick up at any unchecked phase)

- [x] **Phase A — Data layer.** `db/types.ts` additions (§3), Dexie v5 bump
      in `db.ts`, all four `lib/*.ts` CRUD+hook modules (§4). No UI yet.
      Done when: typecheck clean, `exportAll()`/`importAll()` round-trip
      manually verified to include the new tables. **Shipped** — see Build Log.
- [x] **Phase B — Medications.** `MedicationsView`/`MedicationCard`/
      `MedicationEditorSheet`/`PrnQuickLogButton`, wired to `lib/medications.ts`.
      `EmberChain` integration + refill-alert badge. **Shipped** — see Build Log.
- [x] **Phase C — Chores.** `ChoresView`/`ChoreCard`/`ChoreEditorSheet`.
      **Shipped** — see Build Log (includes a real bug found + fixed).
- [x] **Phase D — Inventory.** `InventoryView`/`InventoryItemRow`/
      `InventoryEditorSheet`. **Shipped** — see Build Log.
- [x] **Phase E — Shopping.** `ShoppingView` (Wishlist/Buy-list toggle),
      `WishlistCard`/`BuyListRow`/`ShoppingItemEditorSheet`, promote-to-buy-list
      flow, share/copy/export. **Shipped** — see Build Log.
- [x] **Phase F — Today Digest.** Composes B–E's live queries plus the
      reused Calendar/Tasks hooks, per §6's exact section order. **Shipped**
      — see Build Log. Also **resolves §13's open (a)/(b) IA question**: (a)
      was taken — Life is its own tab with a real, working Today Digest
      inside it; Appendix A's "merge Life+Tasks into one Home tab" idea was
      not adopted.
- [x] **Phase G — Nav + Command Palette wiring** (§8). Nav landed early in
      Phase B; `useLifeSearch` + Command Palette quick-actions + a
      `pendingLifeView` deep-link now also shipped — see Build Log.
- [x] **Phase H — Reminder extension** (§7): the medication check inside
      `ReminderSweeper`'s tick, plus `resolveOverdueMedicationDoses()` on
      mount. **Shipped** — see Build Log (two real bugs found and fixed).
- [x] **Phase I — Polish pass**: `.glass` token/utility added to
      `index.css`, applied to `TodayDigest`'s catch-up strip; a respectful
      Framer Motion mount reveal added. **Shipped** — see Build Log.
      Mobile touch-target/safe-area/density-default audit: no changes
      needed — every Life view already follows the established
      conventions (`.safe-top` on `LifePage`'s toolbar, `Show
      completed`/`Show inactive`/`Running low only` toggles matching
      Tasks' existing precedent) from the phases they shipped in.
- [x] **Phase J — Tests + clean build** (§10). Folded into each phase as it
      shipped rather than done as one batch at the end — every phase above
      already records its own `typecheck`/`test`/`build` result. 61 tests
      total (up from 48 pre-Life), all clean.
- [x] **Phase K — Real-browser verification pass. Shipped** — see Build
      Log. Exercised medication log → streak update, chore complete →
      reschedule (both modes), running-low → add-to-buy-list, wishlist →
      promote → buy-list → mark bought, Command Palette jump, Today Digest
      section-by-section, both themes, mobile 390px, and a genuine offline
      reload against the production build (`vite preview`, real service
      worker) — **found and fixed a real PWA precache gap** in the process
      (see Build Log). Zero console errors on every pass, in the end.
- [x] **Phase L — Docs. Shipped.** `CLAUDE.md` gained a `## Phase 7 — Life
      tab` entry in the exact style of Phases 1–6 (what shipped, all four
      real bugs found and fixed, verification performed). `README.md`
      gained a Life-tab highlight bullet, two new screenshot rows (Today
      Digest + Medications, `docs/screenshots/life-today-dark.png` /
      `life-medications-dark.png`, captured live against the production
      build), a `What's inside` table entry per Life domain, and its stale
      "18 tests"/Vitest badge counts corrected to 61. **Nothing was
      committed or pushed** — only the working tree changed, per standing
      instruction.

---

## 11a. Build Log — updated as each phase actually ships

Real record of what landed, in the same spirit as `CLAUDE.md`'s per-phase
retrospectives — kept here until Phase L folds a condensed version into
`CLAUDE.md` as "Phase 7."

### Phase A — Data layer (shipped)

- `src/db/types.ts`: added `MedicationDto`/`MedicationLogDto`/`ChoreDto`/
  `InventoryItemDto`/`WishlistItemDto`/`BuyListItemDto` plus their small enum
  types, exactly matching §3.
- `src/db/db.ts`: Dexie bumped to `version(5)`, purely additive (no
  `upgrade()`), 6 new tables. `exportAll()`/`importAll()` needed zero changes
  — they already iterate `db.tables` generically.
- `src/lib/medications.ts`, `src/lib/chores.ts`, `src/lib/inventory.ts`,
  `src/lib/shopping.ts` — full CRUD + `useLiveQuery` hooks per §4.
  `inventory.ts` imports `createBuyListItem` from `shopping.ts` for the
  running-low → buy-list loop (one-directional import, no cycle).
- `App.tsx`: `resolveOverdueMedicationDoses()` added alongside the existing
  `resolveOverdueOccurrences()` mount-effect call.
- **One refinement over the original §4.1 sketch**: `recomputeAndCacheMedicationStreak`'s
  log→streak-map folding logic was pulled out into its own pure
  `buildMedicationStreakMap(logs, dosesPerDay)` export, mirroring how
  `streak.ts` itself separates the pure `computeStreakFromStatuses` from the
  Dexie-backed `computeStreak` — done specifically so it could be unit
  tested without a Dexie fixture, matching this codebase's existing
  "only pure logic gets a dedicated test" convention.
- **§10 revisited**: no dedicated `completeChore` test was written. Its only
  new logic is a one-line anchor-date ternary before calling the already-
  tested `rollTaskDueDateForward` — same shape as `completeTask` in
  `lib/tasks.ts`, which also has no dedicated test (only the pure function
  it wraps does). Writing one would mean introducing Dexie-mocking
  infrastructure this codebase doesn't otherwise use, for a branch with
  near-zero logic of its own. Added instead: `medications.test.ts` (9 cases:
  `buildMedicationStreakMap`'s multi-dose-per-day folding + `needsRefillAlert`)
  and `inventory.test.ts` (4 cases: `isRunningLow`).
- **Verified**: `npm run typecheck` / `npm run test` (61 tests, up from 48 —
  13 new) / `npm run build` all clean. No UI touched yet, so no browser
  verification pass for this phase — that starts with Phase B.

### Phase B — Medications UI (shipped)

- Nav wiring landed early (originally scoped as Phase G) so every subsequent
  phase can be visually verified as it's built rather than four phases going
  unseen until nav wiring finally happened: `BottomNav.tsx`'s `Section` type
  gained `"life"` (icon: `TbLayoutDashboard`, as suggested in §8), same
  option added to `SectionTabs.tsx`, `LifePage` added to `App.tsx`'s lazy
  section switch. `LifePage.tsx`'s `LifeView` union currently only offers
  `"medications"` — Today/Chores/Inventory/Shopping are added to the union
  (and the `Segmented`) as their own phases land, rather than shipping fake
  "coming soon" placeholder screens.
- `src/features/life/`: `MedicationsView.tsx` (list + "Add medication" +
  "Show inactive" toggle + empty state), `MedicationCard.tsx` (name/dosage/
  form, compact `EmberChain` fed by the new `useMedicationBeads` hook, a
  gold refill-alert badge, tappable time chips for scheduled doses cycling
  pending→done→missed, `PrnQuickLogButton` for PRN meds),
  `MedicationEditorSheet.tsx` (full create/edit form: name/dosage/form,
  Scheduled-vs-PRN `Segmented`, multi-time editor, the same daily/weekly/
  monthly/custom recurrence picker `EventEditorSheet` uses, refill-tracking
  fields, pause/resume, delete-with-`Popconfirm`), `PrnQuickLogButton.tsx`.
- `lib/medications.ts` grew one more hook beyond §4.1's original sketch:
  `useMedicationBeads(medicationId, days)` (mirrors routines'
  `useRecentBeads`, feeds `EmberChain` directly, reusing
  `buildMedicationStreakMap`'s per-day folding from Phase A).
- **One real bug found and fixed**: `useMedicationBeads`'s `useLiveQuery`
  fallback `Promise.resolve([])` was inferred as `Promise<never[]>` by
  TypeScript, conflicting with the declared `MedicationLogDto[]` return —
  `tsc -b` caught it immediately (a build-blocking type error, not a
  runtime bug). Fixed by annotating the query callback's return type
  explicitly (`(): Promise<MedicationLogDto[]> => ...`).
- **Verified live in a real browser** (headless Chromium via Playwright,
  globally installed — not a repo devDependency, same convention as every
  prior phase), desktop 1440px: navigated to the Life tab, created a
  scheduled medication (Vitamin D, 1000 IU, daily @ 08:00, refill tracking
  5 doses / alert at 7 days — correctly showed the gold "REFILL SOON — 5
  DOSES LEFT" badge immediately), created a PRN medication (Ibuprofen),
  tapped the 08:00 chip (turned accent-filled, the compact Ember Chain's
  last bead lit), tapped "Log dose now" on the PRN medication — **zero
  console errors** across the entire flow.
- `npm run typecheck` clean throughout (one type error found and fixed
  before the browser pass, per above).

### Phases C, D, E — Chores, Inventory, Shopping (shipped)

- `src/features/life/`: `ChoresView.tsx`/`ChoreCard.tsx`/`ChoreEditorSheet.tsx`,
  `InventoryView.tsx`/`InventoryItemRow.tsx`/`InventoryEditorSheet.tsx`,
  `ShoppingView.tsx`/`WishlistCard.tsx`/`BuyListRow.tsx`/
  `ShoppingItemEditorSheet.tsx` — all wired into `LifePage.tsx`'s `LifeView`
  union and `Segmented` switcher. Chores got the "Show completed" toggle
  precedent from Tasks; Inventory got a "Running low only" filter;
  Shopping's buy-list groups rows by store (falling back to "Unsorted"),
  matching §4.4's `formatBuyListAsText`'s own grouping, and has a working
  "Share" button (`shareOrCopyList`: feature-detects `navigator.share`,
  falls back to clipboard).
- **A real bug found and fixed**: a chore (or medication) created with
  `repeat: "weekly"` and **zero weekdays selected** silently produces a
  recurrence `expandOccurrences()` can never satisfy (its weekly branch
  no-ops on an empty weekdays set). For a medication this just means it
  silently never shows as due. For a **chore** it's worse: `completeChore()`
  correctly falls back to "no next occurrence → complete normally" (the
  same, intentional `rollTaskDueDateForward()` behavior `lib/tasks.ts`
  already relies on for a genuinely *ended* series) — but with an empty-
  weekdays weekly rule, that fallback fires on the very first completion of
  what looked like a recurring chore, silently turning it into a one-off
  and hiding it behind the default "hide completed" filter. Caught by
  actually driving the browser and clicking through a full weekly-chore
  create → complete → verify-it-rolled-forward flow (not just typecheck/
  build) — the chore vanished instead of reappearing 7 days out. Root cause
  traced by direct DOM inspection (querying computed button colors) rather
  than trusting a screenshot read, since the first visual read was
  ambiguous. **This is a pre-existing gap in the exact recurrence-picker
  pattern copied from `EventEditorSheet`** (that component has the same
  empty-weekdays possibility, just with a silent/harmless consequence —
  an event with no occurrences simply never renders — so it was never
  caught there); not something introduced by this build, but the Life tab's
  chore path makes the consequence real. **Fixed** in both
  `ChoreEditorSheet.tsx` and `MedicationEditorSheet.tsx`: selecting
  "Weekly" now auto-defaults `weekdays` to today's weekday if none is
  picked yet, plus a belt-and-suspenders fallback at save time. Deliberately
  **not** back-ported into `EventEditorSheet.tsx` — that file is outside
  this feature's scope and the fix isn't needed there (no destructive
  consequence exists for events), matching this codebase's "port a fix only
  where the same failure mode actually bites" convention.
- **Verified live in a real browser** (headless Chromium, desktop 1440px):
  created a chore, an inventory item, and a wishlist item in one combined
  pass; confirmed the running-low badge appears immediately (item created
  at quantity 1 with a minimum of 2); confirmed promote-to-buy-list creates
  a real buy-list row grouped under "Unsorted" with `sourceWishlistId` set
  and the wishlist card shows dimmed/"Promoted"; confirmed Share triggers
  the clipboard fallback (headless Chromium has no OS share sheet) with a
  toast. After the weekly-recurrence fix above, re-verified specifically:
  created a weekly, reschedule-from-completion chore, checked it off, and
  confirmed its due date rolled from 3 Sep → 10 Sep while staying visible
  in the list — **zero console errors** across every pass.
- `npm run typecheck` / `npm run test` (61 tests, unchanged — no new pure
  logic worth a dedicated test in these three phases; CRUD stays untested
  per this codebase's existing convention, see Phase A's note) clean.

### Phase F — Today Digest (shipped)

- `src/features/life/TodayDigest.tsx` — the section-grouped daily view from
  §6, in order: catch-up strip (missed doses + overdue chores only — buy-
  list "now" items were deliberately dropped from this strip despite §6's
  original wording, since they'd otherwise be double-listed with the
  Shopping section below; a small implementation-time refinement, not a
  scope change) → Now/Next (earliest untaken medication dose or timed event
  still ahead today) → Medications → Schedule → Tasks → Chores & Household
  (chores due today/overdue + running-low inventory) → Shopping (buy-list
  `urgency: "now"` only).
- **Maximum reuse, zero new row UI**: Medications/Chores/Chores-adjacent-
  inventory/Shopping sections render `MedicationCard`/`ChoreCard`/
  `InventoryItemRow`/`BuyListRow` **verbatim** — the exact same components
  `MedicationsView`/`ChoresView`/`InventoryView`/`ShoppingView` already use,
  with `onEdit` wired to jump to that sub-view (`onSwitchView`, a thin prop
  threaded from `LifePage`) instead of opening an editor sheet inline.
  Schedule/Tasks reuse the same `useCalendarEvents`/`useTasks` hooks
  `CalendarPage`'s own `TodayView.tsx` already calls — genuinely the same
  query, not a re-implementation.
- **Cross-section navigation reused, not duplicated**: tapping a Schedule
  row or a `TaskAgendaRow` now calls `onGoToDate`/`onGoToTask` — the *exact
  same* functions `App.tsx` already defined for the Command Palette
  (`goToDate`/`goToTask`), threaded one level further into `LifePage` →
  `TodayDigest` as two plain props. No new navigation plumbing was invented.
- `LifePage.tsx`'s `LifeView` type is now exported (`TodayDigest` imports it
  back for its `onSwitchView` prop's type) and the `Segmented` gained a
  "Today" option, now first and the `useState` default — matching the
  plan's original intent that Today be the natural landing sub-view once
  it existed, even though the *app-level* default section stays Calendar
  per §0.1.
- **Verified live in a real browser**, desktop 1440px + mobile 390px: first
  confirmed the correct empty state on a fresh profile ("Nothing on your
  plate today" — a genuinely empty IndexedDB, not a bug, since each
  Playwright `chromium.launch()` starts an isolated profile with no
  carryover from earlier phases' manual testing), then seeded same-day data
  in one script run (a scheduled medication, a chore due today, a running-
  low inventory item, an urgency-"now" buy-list item) and confirmed all
  four rendered in their correct sections with correct labels/badges
  ("08:00" chip, "3 Sep" due date, "Running low", "Now") — **zero console
  errors**.
- `npm run typecheck` / `npm run test` (61 tests, unchanged) clean.

### Phase G — Command Palette integration (shipped)

- `src/features/life/useLifeSearch.ts` — fuzzy title search (`scoreMatch`,
  the same dependency-free matcher `useSearchTasks`/`useSearchEvents`/
  `useSearchNotes` already use) across all five Life tables in one flat
  ranked result list, each result tagged with which `LifeView` owns it.
- **`pendingLifeView` deep-link**, mirroring `pendingTaskId`/
  `pendingCalendarNav`'s existing shape exactly: `App.tsx` gained
  `pendingLifeView` state + a `goToLife(view)` function (`setSection("life")`
  + set the pending view); `LifePage.tsx` gained `pendingView`/
  `onConsumePendingView` props and a consuming effect. This is what lets a
  Command Palette result land on the *correct sub-view* (e.g. tapping a
  medication result opens Medications, not just the Life tab generally) —
  the same navigation precision `goToTask`/`goToNote` already gave Tasks/Notes.
- `CommandPalette.tsx`: `useLifeSearch` merged into the existing flat
  `rows` producer list (same pattern Tasks/Notes already used to integrate),
  plus three static quick-actions ("Jump to Life," "Log medication dose,"
  "Add to buy list") alongside the existing "Go to today"/"Focus"/"Weekly
  review" ones.
- **Verified live in a real browser**: created a medication ("Amoxicillin")
  from the Life tab, switched to Calendar, opened the palette with
  Ctrl+K, typed "Amoxicillin," confirmed it appeared as a result, pressed
  Enter — landed correctly on Life → Medications with the Amoxicillin card
  visible. **Zero console errors.**
- `npm run typecheck` clean.

### Phase H — Reminder extension (shipped, two real bugs found and fixed)

- `lib/notifications.ts`'s `checkDueReminders()` gained a third sweep
  (alongside its existing notes/tasks ones): for every active scheduled
  medication, expand today's due `(time)` values and notify (real
  `Notification` if permission granted, the existing antd-toast fallback
  otherwise) the first time each becomes due — de-duplicated by a
  **session-only `Set`**, not a DB field, since a due-but-unlogged dose has
  no row to stamp a `notifiedAt` onto (a placeholder row was considered and
  rejected — it would have defeated `resolveOverdueMedicationDoses()`'s
  "no row yet" check).
- **Bug 1 — a real Dexie `BulkError` crash**, caught live while verifying
  this phase (not by typecheck/tests): React StrictMode's dev-only double
  mount-effect invocation let two concurrent `resolveOverdueMedicationDoses()`
  calls both read "no row yet" for the same overdue dose and both `bulkAdd`
  it, violating `medicationLogs`' `&[medicationId+occurrenceDate+scheduledTime]`
  unique index. **Same exact bug class `CLAUDE.md` already documents for
  `ensureDefaultTaskLists()`** — fixed the identical way: wrapped the
  read-then-write in one `db.transaction("rw", db.medicationLogs, ...)` so
  IndexedDB serializes concurrent calls instead of racing them.
- **Bug 2 — a real design/ordering bug**, found by noticing the reminder
  toast never actually appeared: `resolveOverdueMedicationDoses()`'s date
  range originally ran through `today` inclusive, so a dose whose clock
  time had already passed **today** (e.g. an 08:00 dose checked at 10am)
  got auto-marked `"missed"` on the very next mount — before the user ever
  had a chance to see the reminder or act on it, and silently denying the
  rest of the day as a grace period. Root cause: this codebase's own
  proven precedent, `resolveOverdueOccurrences()` (routines), explicitly
  scopes its sweep to `.where("occurrenceDate").below(today)` — **strictly
  before** today, never touching today's own occurrence — and this
  medication version had drifted from that precedent. **Fixed** to match
  it exactly: the sweep range is now `[lookback, yesterday]`, so today's
  doses stay open (neither logged nor auto-missed) for the whole day,
  exactly like a routine's today-occurrence does.
- **Verified live in a real browser**, re-testing after each fix: created a
  medication with the default 08:00 daily time (already in the past for a
  normal test run), reloaded (remounting `ReminderSweeper`, which sweeps
  immediately on mount) — confirmed the "Reminder — <name> — 08:00" toast
  appeared, confirmed **two consecutive reloads produced zero errors** (the
  StrictMode-class race, now closed) and the dose chip stayed in its
  neutral/pending state throughout (the grace-period bug, now closed) —
  never silently flipped to missed mid-day.
- `npm run typecheck` / `npm run test` (61 tests, unchanged — this phase's
  new logic is a small ordering/range fix to already-covered pure-adjacent
  code, not new pure logic needing its own test) clean.

### Phase I — Glass polish (shipped)

- `index.css` gained `--glass-bg`/`--glass-border`/`--glass-shadow`/
  `--glass-rim` (light `:root` values + `[data-theme="dark"]` overrides,
  matching every other token's existing convention) and a `.glass` utility
  class: **literal** `blur(14px) saturate(180%)` (never fed through a
  `var()` — Appendix A's own flagged iOS Safari 18 constraint), both
  `-webkit-backdrop-filter` and `backdrop-filter`, wrapped in `@supports`
  so an unsupported engine just keeps the solid `--glass-bg` fill with no
  blur, never gated behind blur actually rendering. **Colors are Kiwami's
  own** ember/teal/gold tokens — Appendix A's literal example hex values
  (`#F97316` etc.) were illustrative placeholders from the research pass,
  not this app's real palette, and were deliberately not copied in.
- Applied to `TodayDigest`'s catch-up strip only — its one genuine hero
  moment, per §9's existing hero-vs-dense intensity-tier rule (dense
  surfaces — `ChoresView`/`InventoryView`/`ShoppingView`/etc. — stay flat,
  unchanged).
- Added a respectful Framer Motion mount reveal to `TodayDigest` (opacity/y
  fade-in, `{type:"spring", stiffness:300, damping:30, mass:0.2}` — the
  exact constants from Appendix A), gated through `useReducedMotion()` so
  a `prefers-reduced-motion` user gets an instant appearance with no
  transform animation.
- **Verified live in a real browser** in both themes: light mode (Playwright's
  default `colorScheme`) and genuine dark mode (`colorScheme: "dark"`
  emulation, confirming Kiwami's real dark-default behavior resolves
  correctly with no stored preference yet) — confirmed via
  `getComputedStyle` that the glass panel actually computes
  `backdrop-filter: blur(14px) saturate(1.8)` in the live DOM, not just in
  the stylesheet source. Zero console errors in either theme.
- `npm run typecheck` / `npm run test` (61 tests) / `npm run build` all clean.

### Phase K — Real-browser + offline verification (shipped, one more real bug found and fixed)

- Ran the full click-through suite from §K's checklist end to end (headless
  Chromium, Playwright, globally installed — same convention every prior
  phase used) — everything from Phases B–I re-confirmed working together
  in combined passes, not just individually.
- **A real bug found here, not caught by typecheck/tests/build**: tested a
  genuine offline reload against the actual production build (`npm run
  build` + `vite preview`, a real registered service worker — not the dev
  server, which has no SW) and found **4 failed font requests**
  (`net::ERR_INTERNET_DISCONNECTED` on the JetBrains Mono 700-weight
  woff2/woff files) the instant the network was fully disabled and the
  page reloaded. Root cause: `vite.config.ts`'s `VitePWA` `workbox.globPatterns`
  was `"**/*.{js,css,html,ico,png,svg,webmanifest}"` — **it never included
  `woff`/`woff2` at all**, despite `CLAUDE.md` explicitly claiming the
  self-hosted `@fontsource` fonts keep "the offline-first guarantee...
  still holds." That claim was untrue for any font weight/format the
  browser's own regular HTTP cache hadn't independently happened to retain
  — a latent, pre-existing gap (not something the Life tab's own code
  introduced), just never caught because whichever screens earlier phases'
  offline passes happened to check didn't trigger the specific missing
  weight. The Life tab's Medications view (bold `font-mono` time chips)
  did. **Fixed**: added `woff,woff2` to `globPatterns` — the precache
  manifest grew from 32 to 42 entries (exactly the 10 font files across
  Playfair Display 600/700/900 and JetBrains Mono 500/700, woff2+woff
  each). Re-verified: zero failed requests, zero console errors on reload
  with the network fully disabled.
- Confirmed the Life tab itself is fully usable offline post-fix: created a
  medication, went offline, reloaded, navigated Calendar → Life →
  Medications, confirmed the medication (and its reminder toast) still
  rendered correctly from IndexedDB with no network.
- Mobile 390px pass: `BottomNav` correctly shows all 4 sections with Life
  highlighted; `LifePage`'s sub-nav `Segmented` (Today/Medications/Chores/
  Inventory/Shopping) fits without overflow at that width; empty states
  render correctly for both `TodayDigest` and `MedicationsView` on a fresh
  profile.
- `npm run typecheck` / `npm run test` (61 tests) / `npm run build` all
  clean as the final state.

### Phase M — Home-tab UX refinements from Appendix B (shipped)

Not one of the original A-L phases — added after a second research pass
(Appendix B, appended in §15) supplied concrete, low-risk UX rules worth
adopting immediately regardless of the still-open Life+Tasks merge
question. See §15 for the full reasoning on what was extracted vs. left
as a recorded-but-undecided product call.

- `TodayDigest.tsx`'s old single-item "Now / Next" row became a real
  **"Now / Focus" zone**: up to `FOCUS_ZONE_CAP` (5) items — medications
  and calendar events still due today, chronological — plus the single
  highest-priority (`urgent`/`high`) still-open task due today folded in
  at the end with an untimed "Today" slot, tappable straight to Tasks via
  the existing `onGoToTask`.
- **Per-category progress badges** ("x/y", `Section`'s new optional
  `progress` prop) added to the Medications and Tasks section headers —
  deliberately quiet (`font-mono`, `--ink-soft`), deliberately not a
  competing score against the Ember Chain. Chores' section was
  deliberately left without one — its rolling `dueDate` on completion
  makes "x/y" ambiguous without a separate query that wasn't worth adding
  for a badge (see §15 for the full reasoning).
- **Verified**: `npm run typecheck` / `npm run test` (61 tests, unchanged
  — this is presentation logic over already-tested data, not new pure
  logic) clean. Live in a real browser (dark mode): confirmed the
  Medications progress badge correctly reads "1/1" after logging a dose,
  confirmed the Now/Focus zone correctly renders nothing (no crash) when
  every candidate item is already in the past or already resolved — zero
  console errors either way.

### Phase N — Today / This Week / All scope control (shipped)

Picked from §15's deferred list as the next phase (Low complexity, no big
product decision required — matching Appendix B's own complexity rating).

- `TodayDigest.tsx` gained a `DigestScope = "today" | "week" | "all"`
  state, switched via an antd `Segmented` next to the day header. Header
  title/subtitle and the empty-state message all adapt per scope ("Thursday
  / 3 September 2026" → "This Week / 3 Sep – 9 Sep 2026" → "Everything
  open / Not scoped to a date — the full Calendar tab has the real grid").
- **Schedule**: `useCalendarEvents(today, rangeEnd)` — already a generic
  range query, so widening it for "week" (today+6) / "all" (today+30,
  deliberately bounded — an literally-unbounded digest query isn't a
  digest anymore, the full Calendar tab exists for that) needed zero
  changes to the hook itself. Rows show a date prefix (`D MMM`) instead of
  just a time once scope isn't "today".
- **Tasks**: "today"/"week" scope extend the existing inline date-window
  filter (unchanged shape, just a wider upper bound); "all" scope reuses
  **`taskMatchesFilter(t, "all", true, today)` from `lib/tasks.ts`
  verbatim** — the exact same predicate `TasksPage`'s own board-level
  "Today/Recurring/All" filter already uses, so "All" here means the same
  thing it means on the actual Tasks board (every open task, undated/
  recurring included), not a second definition of "all."
- **Chores**: `useTodayChores()` (unchanged) still powers "today"; "week"/
  "all" compute inline from the newly-imported `useChores()` (all chores),
  filtering out archived/completed and, for "week," bounding `dueDate` to
  the range.
- **Shopping**: "today"/"week" stay scoped to `urgency: "now"` (a full
  shopping list isn't a "what's coming up" concept); "all" broadens to
  every not-yet-bought buy-list item.
- **Medications deliberately did NOT get a scope-aware query** — kept as
  "today's occurrences" regardless of scope. A medication's schedule is a
  today/PRN concept; showing a real week of per-day dose rows would need
  its own grouped-by-day UI, a materially bigger lift than this phase's
  "Low complexity" scope, so it's left as an explicit, documented
  simplification rather than half-built.
- **Now/Focus zone and the catch-up strip are scoped to `"today"` only**
  and hidden entirely otherwise — "what's due right now" doesn't mean
  anything while browsing a week-wide or all-time view; not a bug, a
  deliberate gate (`scope === "today" && ...`).
- **Verified live in a real browser** (dark mode): created a chore due 3
  days out and one due 20 days out, confirmed via the DOM (not just a
  screenshot read) that **Today** scope shows neither, **This Week** shows
  only the 3-day-out one, and **All** shows both — all six assertions
  passed exactly as designed. Zero console errors across every scope
  switch.
- `npm run typecheck` / `npm run test` (61 tests, unchanged — scope
  filtering is presentation logic reusing already-tested predicates, not
  new pure logic needing its own test) / `npm run build` all clean.

## 12. Open calls left for implementation time (deliberately not pre-decided)

- Exact icon choice for the Life tab in `BottomNav`/`SectionTabs`
  (suggested `TbLayoutDashboard`, non-binding).
- Whether `ShoppingView`'s Wishlist/Buy-list toggle remembers its last
  position (e.g. via a small `settings` row) or always opens on Wishlist —
  low-stakes, decide while building.
- Whether `MedicationEditorSheet` supports more than one `times` entry from
  day one or ships single-time-only first and grows — §4's data model
  already supports multiple, so this is a UI-sequencing call, not a schema
  one.

---

## 13. Note on Appendix A below — read before acting on it

Appendix A is kept **verbatim**, exactly as supplied, per instruction not to
trim it. It is a separate, much deeper research pass specifically on
glassmorphism/motion/mobile-PWA mechanics for a home screen — treat it as
the **authoritative detail spec for glass tokens, blur/performance budgets,
Framer Motion configs, and browser/PWA constraints**, superseding §9's
lighter sketch wherever the two overlap (§9 stays as the quick-reference
summary; Appendix A is the real spec — e.g. its exact `--glass-*` token
values, the literal-not-CSS-variable blur radius requirement for iOS
Safari 18, the ≤4-concurrent-`backdrop-filter` budget, and the exact
Framer Motion spring/drag constants should be what implementation actually
follows).

**One real conflict to resolve before Phase G, not silently picked either
way:** Appendix A's build prompt describes a **unified "Home" tab that
merges the Life digest and the Todo/Kanban board into one primary screen**
(bottom tab bar: "Home / Calendar / + existing tabs"). That is a different
information architecture from §0.1's locked decision — Life as its own
4th tab, separate from Tasks, with Calendar staying the default/home
section. Both are coherent, well-reasoned designs; they are not the same
app shape. Before Phase F/G (Today Digest + nav wiring), explicitly decide
one of:
- **(a)** Keep §0.1 as locked — Life stays a standalone 4th tab (Today
  Digest + Medications/Chores/Inventory/Shopping sub-views), Tasks stays
  its own separate Kanban section. Apply Appendix A's glass tokens, motion
  specs, and layout/interaction rules to `LifePage`'s `TodayDigest` only.
- **(b)** Adopt Appendix A's shape instead — collapse Life + Tasks into one
  "Home" tab (nav becomes `Home / Calendar / Notes` — 3 tabs, Tasks'
  existing Kanban board becomes a condensed summary section *inside* Home
  per Appendix A's section order, with the full board reachable by tapping
  in). This is a larger refactor touching `TasksPage`/`BottomNav`/
  `SectionTabs`/`CommandPalette` beyond what §8 currently scopes, and
  changes muscle memory for the existing, already-shipped Tasks section.

Nothing after this note assumes an answer — pick (a) or (b) at the start of
implementation, or ask again at that point.

---

## Appendix A — Home Screen Glassmorphism: Research + Claude Code Build Prompt (verbatim)

### TL;DR

- **Ship dark glassmorphism with disciplined constraints:** blur 12–16px + `saturate(180%)` on near-black tinted panels, a hard cap of 3–4 simultaneous `backdrop-filter` layers per scroll viewport, and a solid-color `@supports` fallback — this is the only way to hold 60fps on Snapdragon 6xx/7xx Android, where blur values over ~20px visibly stutter scrolling.
- **Structure the unified home as a schedule-first vertical scroll** (the pattern Structured and Akiflow both ship) with a bottom tab bar, a center **speed-dial** quick-add FAB (3–4 categories — Material caps speed dials at 6), sticky glass section headers, and swipe-to-complete cards via Framer Motion `drag="x"`.
- **The build must respect every PWA/browser constraint:** `env()` safe areas (with `viewport-fit=cover`), `100dvh`, `overscroll-behavior-y: contain`, `prefers-reduced-motion` via `useReducedMotion` + `MotionConfig`, and the confirmed iOS Safari 18 nested-`backdrop-filter` bug (never nest glass in glass).

-----

### Part 1 — Research Summary

#### Area 1 — Glassmorphism best practices (2025–2026)

- **Browser support.** `backdrop-filter` is on the Web Platform **Baseline "Newly Available" (since 2024-09-16)**, expected to reach "Widely Available" on 2027-03-16. Baseline versions: Chrome 76 (2019-07-30), Edge 79 (2020-01-15), Firefox 103 (2022-07-26), Safari/iOS 18 (2024-09-16).  **Critical caveat:** per the `mdn/browser-compat-data` issue #25914, "There is no full support in Safari 18. We still need `-webkit-` prefix, and we can't use CSS variables… It will only accept fixed values."  **Implication:** always ship both `-webkit-backdrop-filter` and `backdrop-filter`, and do **not** feed the blur radius through a CSS variable if you need iOS Safari to render it — use a literal value in the glass rule (variables are fine for color/opacity tokens).
- **Blur sweet spot for dark UI.** Consensus is **12–16px** (4px reads as a faint texture; 40px+ becomes a bokeh photo effect).  On mid-range Android, keep it **10–15px** because blur over 20px slows scrolling on entry-level devices.
- **Saturation.** `saturate(180%)` alongside blur is the single trick that keeps colors vivid behind the glass on dark UIs; without it, blur washes the backdrop out.
- **Fill / border / rim.** Dark glass fill: `rgba(255,255,255,0.05–0.12)` (light tint) or `rgba(13,13,13,0.6)` (dark tint).  Text-dense cards need **0.40–0.55 alpha** or text becomes unreadable.  Border: `1px solid rgba(255,255,255,0.10–0.18)`. Add `inset 0 1px 0 rgba(255,255,255,0.10)` to simulate the light-catching rim — this is the detail that separates "tactile glass" from "blurry box."
- **Performance rules.** Never animate the blur radius — it re-triggers GPU compositing every frame and drops you to 30fps or worse on mobile;  **animate opacity/transform instead and keep blur static.** Cap simultaneous `backdrop-filter` elements at **3–4 per scroll viewport** (some sources allow 5–8 on flagship hardware — 3–4 is the safe mobile figure).  The GPU cost scales with blur radius × pixel area, so never put a 40px blur on a full-viewport panel.
- **Containment.** Use `content-visibility: auto` + `contain-intrinsic-size` on offscreen sections to skip their layout/paint. Note the backdrop-root trap (MDN): a parent with `opacity < 1` or `will-change` becomes a backdrop root and a child's `backdrop-filter` will only blur content *between* parent and child  — a common "why is my blur invisible" bug.
- **Noise/grain.** SVG `feTurbulence type="fractalNoise" baseFrequency 0.65–0.9 numOctaves 3`,  applied at low opacity (0.03–0.05) with `mix-blend-mode: overlay`. But live `feTurbulence` is GPU-intensive per-pixel on high-DPI mobile — **prefer a small pre-rendered tiling PNG (256×256) over a full-viewport live SVG filter**, and confine noise to specific containers.
- **Reference.** Apple's **Liquid Glass** (WWDC, June 9, 2025; iOS 26) is the platform-level benchmark — Apple design VP Alan Dye called it "our broadest software design update ever"  that "combines the optical qualities of glass with a fluidity only Apple can achieve." But Liquid Glass is *reactive/dynamic*; we implement **static CSS glass + Framer Motion interactions**, which is the correct web-performance tradeoff.

#### Area 2 — Mobile UX patterns (2025–2026)

- **Thumb zone.** Per Steven Hoober's field study of 1,333 observed smartphone users, "At 49%, the one-handed grip was most popular; 36% cradled the phone… and the remaining 15%… two thumbs," and roughly 75% of interactions are thumb-driven. The bottom third is the easy zone; **bottom-center is optimal** (reachable from either grip — this is why the iOS camera shutter is centered);  top corners are hardest. Primary actions belong at the bottom; destructive actions belong *outside* the easy reach.
- **Navigation.** Bottom tab bar is the gold standard for **3–5 destinations**. Tap targets: Apple HIG minimum **44×44 pt**,   Material 48×48 dp,  WCAG 2.5.8 minimum 24×24 CSS px  — use 44×44 as the floor.
- **How the best planners lay out their mobile home (primary research):**
  - **Structured** — 4-tab bottom bar (Inbox / Timeline / Structured AI / Settings) + a persistent center Plus. Per its 4.0 docs: "the entire menu bar can be found now at the bottom of your screen… The Plus button, to add tasks, remains right where it was." **Timeline-first, unified** — "Structured combines all your tasks and to-dos into a single visual timeline."
  - **Akiflow** — ~5 bottom icons + a **bottom-right "+" that creates task / event / time-slot** (the only true categorized quick-add of the five), calendar-first ("The main view of the app is your calendar"),  with a dedicated **"Daily Dashboard"** overview surface.
  - **Linear** — ~5 customizable bottom tabs (My issues / Inbox / center Create / Teams-Favorites / Search) with a center issue composer "designed with an obsessive focus on speed";  as of Jan 2026 the toolbar is user-customizable. (Issue tracker — no schedule/day concept.)
  - **Notion Calendar** — no tab bar; top-left hamburger; **mobile is limited to 1/2/3-day views**; quick-add via "+" and Home/Lock-screen widgets.
  - **Sunsama** — explicitly a "companion app… not a standalone replacement";  the mobile home is a stripped-down today list + calendar. (Least documented; treat specifics cautiously.)
- **Safe areas.** `viewport-fit=cover` is mandatory or all `env(safe-area-inset-*)` resolve to `0`. Known WebKit quirks: insets can be `0` in portrait Safari and on PWA cold start; PWA standalone behaves better than in-tab Safari. iOS 26 Safari won't render `position: fixed`/`sticky` content *below* the floating bottom browser controls.
- **Viewport height.** Use **`100dvh`** (iOS 15.4+) for the app shell but be aware of a cold-start measurement bug; fall back to `min-height: -webkit-fill-available` under an `@supports (-webkit-touch-callout: none)` guard.
- **Overscroll / gesture isolation.** `overscroll-behavior-y: contain` on the scroll container kills pull-to-refresh chaining  and rubber-band. Put `touch-action: pan-y` on the vertical scroller  so horizontal swipe cards don't fight vertical scrolling.
- **Typography.** Inter or Geist (both UI-optimized, tall x-height, npm-installable). Minimums: nothing below 12px for any functional text, 14px+ for body, 17px is the iOS body ideal. Light text on dark appears optically heavier — drop one weight step (400→300) in dark mode. Cap the type scale at 3–4 levels.

#### Area 3 — Framer Motion + CSS glass

- Animating a glass panel's **opacity/transform is cheap**; animating its `backdrop-filter` blur is expensive — fade it in and keep blur static.
- **Swipe-to-complete:** `motion.div drag="x"`, `dragConstraints={{left:0,right:0}}`, `dragElastic={0.2}`; in `onDragEnd` check `info.offset.x` (threshold ~100px)  OR `info.velocity.x` (escape velocity ~500). Use `useTransform` to map `x` → action-button scale and background color reveal.
- **Premium springs:** general snappy-smooth default `{stiffness: 300, damping: 30, mass: 0.2}`;  button press `{stiffness: 400, damping: 15}`;  card settle `{stiffness: 300, damping: 30}`. (Framer defaults are 100/10/1 — too floppy for UI.)
- **whileTap** scale **0.97** for glass cards.
- **Stagger** 0.05–0.08s between items feels natural (rushed below, sluggish above).
- **Accessibility:** `useReducedMotion()` + wrap the tree in `<MotionConfig reducedMotion="user">` — this auto-disables transform/layout animations while preserving opacity/color.  Keep: opacity fades, color. Remove: large translations, rotations, parallax.
- **List reorder** on task completion: use the `layout` prop (spring) — test on mobile as many simultaneous layout animations can jank.

#### Area 4 — Unified home architecture (life + todo combined)

- **Information hierarchy (schedule-first, exception-first):** overdue/urgent alerts → today's schedule/timeline → tasks (Kanban summary) → routines → food slots → medications → wishlist. Show bad news; never bury overdue items behind disclosure.
- **Progressive disclosure:** summary cards expand in place; collapsible sections via `AnimatePresence` + `height: "auto"`. Keep ~3–4 prominent items per section (subitizing limit).
- **Day-score:** the Apple Activity-rings model — a single visual (ring closed or not) outperforms a number because it's binary and "addictive to close."  Apple's own framing: "Three rings… One goal: Close them every day."  Build one simple SVG arc "day-health" indicator at the top.
- **Quick-add:** the formal pattern is a **Speed Dial FAB** (Material) — "When pressed, a FAB can display three to six related actions… If more than six actions are needed, something other than a FAB should be used." For Kiwami, **3–4 actions (task / routine / food slot / medication)** sits squarely in the ideal range. Default position bottom-end.
- **Empty states + skeleton loaders** for every glass card before Dexie data resolves.

#### Area 5 — Browser/PWA constraints specific to this build

- **iOS Safari 18 bug (confirmed on Apple's own forums):** a `backdrop-filter`/`backdrop-blur` element nested inside another one breaks, and `background-color` + `backdrop-filter` conflict on iOS 18.  **Never nest glass-in-glass.**
- **Theme switching:** `data-theme` attribute on `<html>` toggling CSS custom-property sets; an **inline render-blocking script in `<head>`** sets the attribute before first paint to avoid the flash (a deferred/async script strobes on cold mobile cache).  Priority order: explicit `localStorage` override → `prefers-color-scheme` → default.  A system-preference change must **not** overwrite an explicit user choice.
- **Height/safe area:** `100dvh` + `env()` insets + `overscroll-behavior: contain`, as above.
- **Scroll-snap:** appropriate only for discrete full-screen sections — **not** appropriate for this mixed-content digest; do not use it here.

#### Area 6 — Design token system

- Glass tokens: `--glass-blur`, `--glass-saturate`, `--glass-bg`, `--glass-bg-dense`, `--glass-border`, `--glass-rim`, `--glass-shadow`, `--glass-radius`; per-category tints `--glass-tint-routine` (amber), `--glass-tint-food` (teal), `--glass-tint-task` (neutral), `--glass-tint-med` (soft blue).
- Ember palette: accent `#F97316`, base `#0A0A0A`–`#141414`.
- Radius: **16–20px** for mobile glass cards; **24px** for hero/floating panels.

-----

### Part 2 — The Complete Claude Code Prompt (copy-paste ready)

> Build the unified **Home** screen for **Kiwami**, a local-first, offline-first PWA whose tagline is "Own your days." This is a mobile-first, all-screen glassmorphic home that merges the Life/Daily digest and the Todo/Kanban into ONE primary tab. Build it fully; do not ask clarifying questions — every decision is specified below.
>
> #### Stack & existing conventions (do not deviate)
>
> - React 19 + TypeScript **strict**, Vite 5, Dexie (IndexedDB), Ant Design 5, Framer Motion, dayjs, vite-plugin-pwa, Tabler Icons.
> - Reuse the existing Dexie `useLiveQuery`-style hooks for all data reads. **Do not add any network layer** — this app is offline-first.
> - Reuse the existing **Ember Chain** streak visual language for routine streaks, the food-time-slot model, the recurrence engine, and the Command Palette (Cmd+K). Home must open the Command Palette on Cmd+K.
>
> #### Design language
>
> - Ember/ash/fire metaphor. Signature accent **amber-orange `#F97316`**. Near-black base **`#0A0A0A`–`#141414`**. **Dark default** with a light toggle. "KiwamiExtreme" pinnacle energy — minimalist but with character. This is emphatically **NOT** generic SaaS dark mode.
>
> #### Glass token system — put these exact values on `:root`, override under `[data-theme="light"]`
>
> Dark (default):
>
> ```css
> :root {
>   --glass-blur: 14px;          /* literal in the .glass rule for iOS Safari */
>   --glass-saturate: 180%;
>   --glass-bg: rgba(255,255,255,0.06);
>   --glass-bg-dense: rgba(20,20,20,0.55);   /* text-heavy cards */
>   --glass-border: rgba(255,255,255,0.12);
>   --glass-rim: inset 0 1px 0 rgba(255,255,255,0.10);
>   --glass-shadow: 0 8px 32px rgba(0,0,0,0.24);
>   --glass-radius: 18px;
>   --glass-radius-hero: 24px;
>   --glass-tint-routine: rgba(249,115,22,0.10);  /* amber */
>   --glass-tint-food:    rgba(20,184,166,0.10);  /* teal  */
>   --glass-tint-task:    rgba(255,255,255,0.04);  /* neutral */
>   --glass-tint-med:     rgba(96,165,250,0.10);   /* soft blue */
>   --accent: #F97316;
>   --base: #0A0A0A;
> }
> [data-theme="light"] {
>   --glass-bg: rgba(255,255,255,0.55);
>   --glass-bg-dense: rgba(255,255,255,0.80);
>   --glass-border: rgba(0,0,0,0.08);
>   --glass-shadow: 0 8px 32px rgba(0,0,0,0.10);
> }
> ```
>
> Create one `.glass` class that applies the bg, **both** `-webkit-backdrop-filter` and `backdrop-filter: blur(14px) saturate(180%)` (use the **literal 14px**, not a variable, so iOS Safari 18 renders it), the border, radius, shadow, and rim. Category variants (`.glass--routine`, `.glass--food`, `.glass--task`, `.glass--med`) layer only the tint (e.g. via a `linear-gradient` overlay or a pseudo-element background) on top of `--glass-bg`. Wrap the whole `.glass` definition in:
>
> ```css
> @supports (backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)) { /* glass rules */ }
> ```
>
> and give a **solid fallback** `background: rgba(20,20,20,0.85)` outside the `@supports` block so it degrades gracefully in Firefox-without-acceleration  and old engines.
>
> #### Section order (top → bottom, schedule-first, exception-first)
>
> 1. **Header** — greeting + date (dayjs) + a **"day-health" ring** (single SVG arc showing % of today's rituals/tasks completed; Apple-rings model — visually "closed or not," amber fill) + theme toggle.
> 1. **Overdue / urgent alerts** — renders only if items exist; amber-red glass. Never collapsed, never hidden.
> 1. **Today's schedule / timeline** — next + upcoming unified events (reuse calendar data).
> 1. **Tasks** — condensed Kanban summary of today's columns; tap a column to expand in place.
> 1. **Routines** — `.glass--routine`, with Ember Chain streak indicators.
> 1. **Food slots** — `.glass--food`.
> 1. **Medication reminders** — `.glass--med`.
> 1. **Wishlist** — `.glass--task`, **collapsed by default**.
>    Each section is a collapsible glass card group with a **sticky glass header**. Empty sections show a quiet, on-brand empty state (short line + subtle icon), never blank space.
>
> #### Layout behavior — specify both breakpoints explicitly
>
> - **Mobile (390px):** single column, full-bleed with 16px gutters. **Bottom tab bar** (Home / Calendar / + the app's existing tabs, 3–5 total, each ≥44×44px). **Center speed-dial FAB** for quick-add.
> - **Desktop (1440px):** `max-width: 1200px` centered; **2-column masonry** (schedule + tasks left; routines / food / meds / wishlist right). The FAB becomes a **top-right quick-add button**; hide the bottom tab bar and use the existing desktop nav.
>
> #### Interactions — exact Framer Motion configs
>
> - Card `whileTap={{ scale: 0.97 }}`.
> - Section reveal on mount: stagger `delayChildren`/`staggerChildren: 0.06`, each child `opacity 0→1` + `y 12→0`, `transition={{ type:"spring", stiffness:300, damping:30, mass:0.2 }}`.
> - **Swipe-to-complete task card:** `drag="x"`, `dragConstraints={{left:0,right:0}}`, `dragElastic={0.2}`. In `onDragEnd(_, info)`: if `info.offset.x > 100 || info.velocity.x > 500` → **complete** (swipe right); if `info.offset.x < -100 || info.velocity.x < -500` → **snooze** (swipe left). `useTransform` maps `x` → reveal amber "done" background + Tabler check icon and a red/ash "snooze" background on the other side.
> - Collapsible sections: `AnimatePresence` + animate `height: "auto"`, spring `{stiffness:300, damping:30}`.
> - Completed-task list reorder: `layout` prop with spring.
> - **Speed-dial FAB:** press emits **3–4 actions** (Task / Routine / Food slot / Medication) as a vertical stack, `{stiffness:400, damping:20}`, stagger 0.04s. **Never exceed 4 actions** here (Material hard cap is 6). Tapping the FAB again closes it.
>
> #### Browser / PWA constraints — handle every one
>
> - `backdrop-filter`: ship `-webkit-` + standard; blur radius must be a **literal value** (iOS Safari 18 rejects CSS-variable blur). Provide the `@supports` solid fallback above.
> - **NEVER nest a glass element inside another glass element** (confirmed iOS Safari 18 nested-`backdrop-filter` / `background-color` conflict).  Sticky headers and cards must be **siblings**, not glass-in-glass.
> - **Never animate blur radius.** Animate opacity/transform only.
> - Cap simultaneous `backdrop-filter` elements at **≤4 in the viewport**. Apply `content-visibility: auto` + `contain-intrinsic-size` to offscreen sections. Do not apply `will-change` to glass parents (creates a backdrop root that breaks child blur).
> - `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`.
> - App shell height: `100dvh`; fallback `min-height: -webkit-fill-available` inside `@supports (-webkit-touch-callout: none)`.
> - Safe areas: pad with `env(safe-area-inset-top/right/bottom/left)`. Bottom tab bar and FAB add `env(safe-area-inset-bottom)`.
> - Scroll container: `overscroll-behavior-y: contain` (kill pull-to-refresh chaining + rubber-band) and `touch-action: pan-y` (so horizontal swipe cards don't hijack vertical scroll).
> - Theme: `data-theme` on `<html>`; an **inline render-blocking script in `index.html`** reads `localStorage("kiwami-theme")`, else falls back to `prefers-color-scheme`, and sets the attribute **before first paint**. The toggle persists to `localStorage` and mirrors into Dexie settings. A system-theme change must not overwrite an explicit user choice.
> - Do **not** use scroll-snap on this screen.
>
> #### Accessibility
>
> - `useReducedMotion()` + wrap the app in `<MotionConfig reducedMotion="user">`.  Under reduced motion: opacity fades only — no translate/scale/layout animation; collapsibles snap open/closed.
> - Text on glass: min **14px** body; use white / gray-100 on dark glass; text-dense cards must use `--glass-bg-dense` and pass **WCAG AA**. Never dark text on dark glass.
> - Every swipe action needs a **visible non-gesture button alternative**  (complete/snooze buttons).
> - All tap targets ≥ **44×44px**.
>
> #### What NOT to build (anti-patterns — enforce these)
>
> - No glass-on-glass nesting. No full-viewport live SVG noise filter (tiling PNG or nothing). No animated blur. No scroll-snap here. No more than 4 speed-dial actions. No hamburger menu on mobile. No generic SaaS card grid — keep the Ember character (amber accents, near-black base, warm tints). Don't hide overdue/bad news behind disclosure. Don't place primary actions in the top corners (they're outside the thumb zone).
>
> #### Build in THIS exact order
>
> 1. Glass token CSS + `.glass` mixin + category variants + `@supports` fallback + the inline theme-bootstrap script in `index.html`.
> 1. App shell: `100dvh` + safe-area padding + scroll container with `overscroll-behavior`/`touch-action` + bottom tab bar.
> 1. Skeleton loaders + empty states for glass cards.
> 1. Reusable Section container (collapsible, sticky glass header, `content-visibility`).
> 1. Wire the Dexie hooks; render all sections in the specified order with their category tints.
> 1. Day-health ring in the header + theme toggle.
> 1. Swipe-to-complete task cards + the speed-dial quick-add FAB (with button fallbacks).
> 1. Framer Motion stagger/reveal + `whileTap` + reduced-motion gating via `MotionConfig`.
> 1. Desktop 1440px 2-column masonry adaptation.
> 1. QA pass: 60fps on a Snapdragon-class Android, iOS Safari **standalone** mode (verify no nested-blur breakage, safe areas, no pull-to-refresh), and WCAG AA contrast on every glass surface in both themes.

-----

### Recommendations (staged, with thresholds that change them)

1. **Prototype the glass token + one section first** and profile it on a real Snapdragon 6xx/7xx device (Android DevTools → Profile GPU Rendering; target the 16.67ms/frame line). If any section drops below ~55fps while scrolling, first reduce `--glass-blur` to 10px, then drop the noise overlay, then reduce concurrent glass layers below 4. **Threshold:** if a single section still can't hold 55fps at 10px blur, fall back to the `@supports` solid-tint treatment on that device class (feature-detect via a runtime FPS probe or ship a "reduce transparency" setting).
1. **Build the schedule-first order exactly as specified** — this mirrors the two apps in this space that ship a genuine unified day view (Structured, Akiflow). Only reorder if usage data shows users open Home primarily to add tasks rather than review the day; **threshold:** if quick-add FAB taps exceed section scroll-throughs 3:1, promote the Tasks section above the timeline.
1. **Keep the quick-add speed dial at 3–4 actions.** If product later needs a 5th+ capture type, switch from a speed dial to a bottom sheet — do not grow the dial past 6 (Material's documented ceiling and a real usability cliff).
1. **Ship the day-health ring as a single arc, not multi-ring, at launch.** Apple's own model shows the binary "closed/not" is what drives the habit; a simpler single indicator is easier to reason about for a ritual app. Revisit multi-ring only if you add clearly independent daily goals (e.g., rituals vs. body vs. focus).
1. **Treat theme as a three-state setting** (System / Dark / Light) stored in Dexie, with the inline bootstrap reading `localStorage` first — this prevents the flash and respects explicit intent.

### Caveats

- **Sunsama's mobile home-screen structure is thinly documented** (it's officially a "companion app"); its specifics informed the summary only lightly. The high-confidence layout references are Structured, Akiflow, Linear, and Notion Calendar (official docs / app-store listings).
- The **iOS Safari 18 nested-`backdrop-filter` bug** is reported on Apple's own community forums and may be partially fixed in later point releases — verify on your current iOS target, but the "no glass-in-glass" rule is the safe design regardless.
- The **CSS-variable-in-blur limitation on iOS Safari 18** comes from an open `mdn/browser-compat-data` issue; behavior may improve in future Safari versions. The literal-value workaround is safe today.
- The **"3–4 concurrent backdrop-filter layers" ceiling** is a practical mobile figure synthesized from multiple 2026 sources (some cite 5–8 on flagship hardware). It is not a hard spec number — profile on your actual target devices; it's a starting budget, not a guarantee.
- `env(safe-area-inset-*)` returning `0` in some portrait Safari / cold-start scenarios is a documented WebKit inconsistency; PWA standalone mode (Kiwami's install target) is the more reliable environment, but test both.
- Framer Motion is now published as **`motion`** (`motion/react`); the API in this prompt is current for both the legacy `framer-motion` and new `motion` package names — match whichever is already in the Kiwami `package.json`.

---

## 15. Note on Appendix B below — read before acting on it, and before re-reading Appendix A's §13 note

Appendix B is kept **verbatim**, per the same instruction as Appendix A.
Read it alongside §13's note on Appendix A, because **this is now the
second independent research pass recommending the same architectural
change**: merging Life and Tasks into one "Home" tab, with Calendar/Notes
staying separate (Appendix A argued this from a glassmorphism/mobile-UX
angle; Appendix B argues it from a product/IA angle — "Keep Life/Todo as an
optional filter chip, not a primary split — data stays unified underneath,"
"the Life-vs-Todo split the merge is meant to eliminate"). §0.1's locked
decision — Life stays its own 4th tab, Calendar stays home — has **not**
been revisited or changed by either appendix landing in this file. Two
research passes recommending the same merge is a real signal worth the
user's attention next time this file is picked up, but it is still their
call to make, not a default this plan silently adopts.

**One thing worth noting explicitly**: most of Appendix B's "MUST show on
Home" list is *already satisfied* by the shipped `TodayDigest` (Phase F)
regardless of how the merge question resolves — medications, routines/
food/events (via Calendar's `useCalendarEvents`), tasks (via `useTasks`),
chores, and shopping/inventory nudges are all already unified into one
scrollable daily view. The merge question mainly still matters for whether
the **full Kanban board** (not just today's slice of tasks) also needs to
live on that one screen, and for the nav-level "how many top-level tabs"
decision — not for whether the daily-digest content itself needs rebuilding.

### What was extracted from Appendix B and built now (low-risk, no IA decision needed)

- **A real multi-item "Now / Focus" zone**, replacing the old single-item
  "Now / Next" row — up to `FOCUS_ZONE_CAP` (5) items, timed items
  (medications + calendar events) in chronological order, plus the single
  highest-priority (`urgent`/`high`) still-open task due today folded in at
  the end with an untimed "Today" slot — implementing Appendix B's rule
  "the one big task is eligible for the focus zone regardless of time."
  Working-memory research cap (Cowan 2001, Oberauer 2019) taken directly
  from Appendix B's own citation.
- **Per-category quiet progress badges** ("x/y") on the Medications and
  Tasks section headers in `TodayDigest` — explicitly implementing
  Appendix B's "category-specific, NOT a unified day score" recommendation.
  This is a deliberate confirmation, not new philosophy: the Ember Chain
  was already the sole momentum signal everywhere else in this app: these
  badges are a small, glanceable secondary readout that cannot be mistaken
  for a second gamification system.
- Chores' section deliberately did **not** get a progress badge — a
  chore's `dueDate` rolls forward the instant it's completed (see
  `completeChore()`), so "x due today" and "x completed today" aren't the
  same denominator the way they are for medications/tasks; a badge here
  would need its own separate `lastCompletedAt`-based query to mean
  anything honest, which felt like manufacturing a metric rather than
  surfacing one that was already meaningful. Left for a future pass if it
  turns out to matter.
- **"Why is this here?" transparency was found to already be satisfied**,
  not something new to build: `InventoryItemRow`'s "⚠ Running low" badge
  and `BuyListRow`'s "Now" urgency tag — both already reused verbatim in
  `TodayDigest` since Phase F — already are the one-line reason a rule-
  surfaced item is showing up. No new UI was needed.

### What's recorded here as planned-but-not-built (each is a real product decision, not a low-risk add)

- **Natural-language quick capture with inline type detection** for Life
  items (medications/chores/inventory/wishlist) — genuinely new
  infrastructure (a parser + a type-guessing heuristic + editable type
  chips), nothing to extend. Today, every Life domain is still explicit
  "Add X" buttons + a full form, matching the rest of this app's existing
  CRUD-sheet convention. Desktop's Command Palette (`Ctrl/Cmd+K`) already
  is a form of quick-jump, not quick-capture — worth revisiting together.
- **A 1-3-5 capacity cap + gentle "that's a full day" nudge** on the
  Now/Focus zone or the Tasks section — a real, opinionated product
  decision about how hard to push back on an over-full day, not something
  to default into silently.
- ~~A Today / This Week / All segmented scope control~~ — **built, see
  Phase N below.**
- **Guided morning-planning / evening-shutdown rituals** (two-tap, per
  Appendix B — explicitly not a mandatory wizard) — a genuinely new
  interaction pattern this app doesn't have anywhere yet.
- **"≥3 rollovers → suggest breakdown"** and **"streak-at-risk" nudges** —
  both need new tracking (a rollover counter per task; a "is today's window
  closing" check per routine) that doesn't exist yet.
- **The Life+Tasks Home-tab merge itself** — unchanged from §13: still an
  open decision, not defaulted into.

---

## Appendix B — Unified Home Tab: Best-in-Class Features & End-to-End User Flow (verbatim)

### Executive Summary
- The single biggest decision is philosophical: the Home tab should be a **commitment surface, not a dumping ground**. As Tazmine's widely-cited Medium review ("Things 3 Has Been on My Mac for 4 Years") puts it, in Things 3 "nothing appears in Today unless you put it there on purpose. Four years in, that single design choice is still the reason I open the app. The Today view is a daily contract with myself." That is the opposite of Todoist, where (per the same review) "your Today view fills up with everything you've ever optimistically scheduled." Kiwami should adopt an intention-based Today with automatic-but-reviewable surfacing.
- Adopt a **hybrid information architecture**: a short interleaved "Now/Focus" zone at the top (chronological, all item types mixed), followed by collapsible category sections (Meds, Routines, Food, Tasks) below. This matches Tiimo's own positioning — Tiimo "brings your calendar, tasks, and routines into one flexible space" (tiimoapp.com) — while respecting the fact that meds/routines are better grouped by day-part and tasks by priority.
- Use **ONE quick-capture entry point with natural-language parsing plus a lightweight type hint**, not four separate add flows and not a pure type-picker. Todoist's natural-language Quick Add is repeatedly called the "gold standard" (alfred_ and Max-Productive.ai 2026 reviews) and "the single biggest reason Todoist captures more tasks than most alternatives."
- For momentum, use **category-specific indicators (Kiwami's Ember Chain plus small per-category progress) rather than a single unified "day score."** Apple's activity rings work because they separate goals; as StepMelon's analysis notes, a combined/opaque signal can be "confusing or even anxiety-inducing" and "the frustration can outweigh the motivation." Avoid building a second gamification system that competes with the Ember Chain.
- Enforce a **hard capacity limit and guilt-free rollover.** The 1-3-5 rule (1 big, 3 medium, 5 small = 9 items max) directly addresses overwhelm; guilt-free rollover ("no flashing red, no overdue badge") is now standard in ADHD-friendly planners and aligns with the Ember Chain's "habit strength not zero-reset" philosophy.
- Keep detail, configuration, analytics, and the full Kanban board OFF the home screen; surface only today's actionable items and route everything else to secondary views.

### Feature Prioritization: Must-Show-on-Home vs. Must-Be-Secondary

#### MUST show on the Home/Today screen
1. **A "Now / Focus" zone at the very top** — 3-5 items maximum, interleaving whatever is most time-relevant right now across all types (an overdue medication, the current food slot, the day's one big task). Working-memory research puts the realistic ceiling at 3-5 chunks under load (Cowan 2001, Oberauer 2019); multiple apps converge on a ~5-item focus zone (Google Tasks best practice, per TasksBoard: "no more than five starred tasks at any time"). *(Complexity: Medium)*
2. **Day momentum via the Ember Chain + small per-category progress** — reuse the existing signature visualization; do not invent a competing score. *(Complexity: Low–Medium, reuses existing engine)*
3. **Time-relevant medications with one-tap "Taken/Skip"** — logging must be single-tap; per Done Dose's app comparison, "if logging a dose takes more than a single tap, you won't do it consistently." *(Complexity: Low)*
4. **Today's routines/habits with Ember Chain streak state** — already built; surface the pulsing "today" state and any streak-at-risk items. *(Complexity: Low)*
5. **Current/next food-time slot with Ate/Skipped logging** — already built. *(Complexity: Low)*
6. **Today's tasks, capped and ordered** — due-today + overdue + manually pinned, capped ~9 per the 1-3-5 rule. *(Complexity: Medium)*
7. **One quick-capture button (natural language)** — persistent, e.g., a FAB or the existing Cmd+K palette on desktop. *(Complexity: Medium–High)*
8. **A scope segmented control (Today / This Week / All)** — 2-4 options, filtering the same view. *(Complexity: Low)*
9. **Guilt-free overdue handling inline** — a gentle "carry forward / done / skip" affordance, no red shame states. *(Complexity: Medium)*

#### MUST be secondary / detail-view (NOT on home)
- Full Kanban board with all columns/swimlanes (route to the Todo page).
- Inventory management, wishlist, buy-list master lists (surface only auto-generated "running low → buy" nudges on home).
- Medication schedules, dosages, refill config, adherence charts.
- Routine creation/editing and recurrence rules.
- Calendar Month/Week grid views (already their own tab).
- Analytics/history, settings, theming.
- Task detail: subtasks, notes, attachments (open on tap into a detail sheet).
- Anything requiring configuration or multi-field forms.

Dashboard research is unanimous here: per GammaUX, "displaying too much information at once leads to user overload, increases cognitive load, and hampers readability"; the fix is "first showing the most relevant information and general metrics, then progressively revealing more specific data." As UXpilot's dashboard guide argues, every element "should trace back to a specific decision someone needs to make."

### Recommended End-to-End User Journey

#### Morning open (the "plan / orient" moment)
1. App opens directly to the **Today** scope. The user sees, top-to-bottom: (a) a one-line day header with the Ember Chain state and a soft summary; (b) the **Now/Focus zone** (3-5 items); (c) collapsible category sections below.
2. **Optional lightweight planning ritual** — inspired by Sunsama's guided planning ("see your entire day at a glance and reduce context-switching") and Things' "daily contract," but far lighter: a single prompt to confirm/pin today's items and to flag the one "big" task (the "1" in 1-3-5). This is a prompt, not a mandatory multi-step wizard — Sunsama's own users report often skipping heavy rituals when tired or on mobile.
3. **Capacity feedback**: if the user pins more than ~9 items, show a gentle "that's a full day" nudge. This mirrors Sunsama, which (per the widely reproduced review) "will literally warn you if you're planning too much… if your planned tasks add up to 9 hours, the app basically says 'Hey, maybe rethink this?'" — but never a hard block.

#### Throughout the day (the "engage" moment)
4. The **Now/Focus zone updates as time passes** — the current food slot, a medication due now, the next routine. This is Kiwami's answer to time-collision: instead of a calendar grid, use **strict chronological ordering with untimed items collected below**, the mainstream rule. Google Tasks groups untimed items under a "NO DATE" category at the bottom; Things sinks "This Evening" items to their own bottom section ("still present, so you know there's more to do, but unobtrusive"); Structured parks untimed items in an Inbox ("all of your tasks that don't have a specific date or time"). Sunsama uniquely lets users place unscheduled tasks explicitly above or below scheduled ones — worth offering as a setting.
5. **Mid-task interactions are all one-gesture**: tap-to-complete (with a satisfying confirmation — Tiimo's "confetti explosion … provides a moment of positive reinforcement"), swipe to snooze/reschedule (single-column-with-swipe, already decided), long-press for detail. Per Tiimo's design team, drag-and-drop rescheduling "makes rescheduling feel direct and manageable, without navigating complex menus."
6. **Conflict/collision handling without a timeline**: when a routine, food slot, medication, and task all fall in the same window, group them under a single time-bucket header (e.g., a "Now" or day-part header) and order meds/health items first (health-critical), then routines, then food, then tasks. Day-part headers ("Morning/Afternoon/Evening") are a validated pattern specifically for meds/habits/routines (used by habit apps like "Productive"), whereas task/agenda apps favor strict chronological order. Never show more than the focus-zone cap in the "now" bucket; overflow goes to "Later."

#### End of day (the "review / wind-down" moment)
7. A **short, optional shutdown review** modeled on Sunsama's daily shutdown ("review what got done, reschedule what didn't, and actually close out your workday") and Tiimo's "Review Today" ("check what's left and never lose a task") — but two-tap, not a ritual. The user sees what's done, what's left, and a single "carry forward everything / pick individually" choice.
8. **Guilt-free rollover**: unfinished tasks move forward with, in the words of the Taskful Day planner, "no flashing red. No overdue badge. No analytics card titled 'what you failed to do.'" This is the task-side analog of the Ember Chain's ash-not-guilt philosophy. Note the known trade-off (per Colter Reed and Tiimo user feedback): auto-rollover can silently swell the list, so pair it with the ≥3-rollover breakdown nudge (rule 12 below).
9. **Momentum close**: show the Ember Chain's end-of-day state and any milestones reached (7/30/100/365). Do NOT surface a punitive "you completed X%."

### Recommended "Add New Item" Flow: Hybrid (Natural Language + Type Hint)

**Recommendation: ONE capture field with natural-language parsing, plus inline type detection the user can override — NOT four separate flows and NOT a pure modal type-picker.**

Justification:
- A single low-friction capture point is the highest-leverage capture design. Per Calmevo's guide, "the lower the friction of adding a task the more tasks get added before they're forgotten." Critically for Kiwami, "natural language parsing happens on-device … You can create tasks with full natural language input without an internet connection" — perfectly aligned with local-first/offline-first.
- Todoist is the acknowledged "gold standard" for this (alfred_ 2026: "Todoist is the gold standard for simple task management… natural language input, cross-platform sync, and a design that stays out of your way"; Max-Productive.ai 2026: "Todoist remains the gold standard… Its best-in-class natural language input").
- Pure auto-detection is unreliable across many item types (per The Sweet Setup, Todoist "does expect a certain order when you type out tasks"), and Kiwami has five+ types (task/routine/food/med/wishlist). So pair parsing with a **visible, editable type chip**. Emulate Todoist's real-time feedback: per Max-Productive.ai, "the recognized elements appear as colored pills below the task title. No other task manager handles natural language this accurately." Kiwami's parser guesses the type ("💊 med", "🔁 routine", "✅ task") and highlights recognized dates/times inline, and the user taps to correct.
- Reserve **structured mini-forms only for genuinely structured types** (a medication needs dosage/schedule; a routine needs recurrence). The pattern: capture in natural language → if type = med/routine, expand a small type-specific sheet; if type = task/food/wishlist, save instantly. This keeps the common case one-line while handling recurrence complexity.
- On desktop, the existing **Command Palette (Cmd+K)** should double as the capture bar.

### Recommended Smart "Today" Surfacing Logic (Implementable Rules)

Model the "Today" list as a computed smart list (like TickTick/Todoist/Things) but bias toward intention over pure due-date flooding. Concrete, local-only, non-AI rules:

**Inclusion rules (what surfaces on Today):**
1. Any item with a start/due/scheduled date == today (per Vanja Petreski's Things 3 guide: "If the start date, deadline, or repeating rule of any to-do matches today, it shows up here").
2. Any overdue task (surfaced gently, grouped, not red) — TickTick's Today list arranges "all overdue and today's tasks."
3. Any routine/habit whose recurrence fires today.
4. Any medication dose scheduled today.
5. Any food-time slot for today.
6. Any item **manually pinned** to today (the intentional "daily contract" path).
7. **Rule-based cross-feature nudges** (see below), shown as a distinct, dismissible "suggestions" row.

**Ordering rules:**
8. Timed items in strict chronological order; untimed items collected in a bottom bucket (Google Tasks "NO DATE"; Things "Anytime/This Evening").
9. Within the same time window: health-critical (meds) → routines → food → tasks.
10. The single "big" task (1-3-5) is eligible for the Now/Focus zone regardless of time.

**Cross-feature intelligence (rule-based, no AI, no server):**
11. **Low-stock → buy-list nudge**: when an inventory item's quantity drops below its threshold, auto-suggest adding it to the buy-list. This is a proven local pattern: the Home Assistant simple_inventory integration "automatically add[s] items to a todo list when stock drops below a threshold," and consumer apps like Stockly and Home Stock auto-move "low-stock items … to your shopping list."
12. **Overdue-N-times → suggest breakdown**: if a task has rolled over ≥3 times, gently offer "break this into smaller steps" — echoing the ADHD principle (The Center for ADHD) to "shrink the task until it feels ridiculously doable."
13. **Streak-at-risk warning**: if a routine's Ember Chain is active and today's window is closing unfulfilled, show a gentle "keep your chain" nudge (analogous to Apple Watch's end-of-day "close your rings" prompt) — best-effort web-only per Kiwami's decided reminder constraint.

**Transparency rule:**
14. For any item that surfaces via a rule rather than an explicit date/pin, attach a tiny "why is this here?" affordance — a one-line reason ("Suggested: you're low on coffee"). This follows the documented "why am I seeing this" pattern (Facebook's "Why am I seeing this post?", per the Understanding Recommenders write-up): as UX University frames it, "one clear reason, available when the user wants it." Do not explain items the user explicitly scheduled — that would be noise.

### Recommended Day-Momentum / Gamification Decision: Category-Specific (NOT a Unified Score)

**Recommendation: Keep the Ember Chain as the hero signal and add small per-category progress indicators; do NOT create a single unified "day score."**

Justification:
- A single opaque number is risky. Apple's Activity rings succeed precisely because they **separate** goals into distinct rings, and even then, as StepMelon notes, for some users rings are "confusing or even anxiety-inducing" and "the frustration can outweigh the motivation." Compressing meds + routines + food + tasks into one number would hide which dimension needs attention and could feel punishing. (Macworld similarly reports researchers saying the ring model "works because it turns behavior change into a simple daily goal system," but "won't be true for everyone.")
- Kiwami already has a beloved, differentiated signal (the Ember Chain, "habit strength not zero-reset guilt"). Adding a second competing scoring system risks incoherence — a core design failure mode. The Ember Chain should remain the emotional centerpiece; other categories get quiet, glanceable progress (e.g., "2/3 meds", "1/2 meals") without a leaderboard or aggregate grade.
- Medication and food adherence specifically should **not** be gamified with streaks-as-pressure. The med-reminder app Pause Moment states on its homepage, "We count pauses, not streaks. Streaks turn into guilt," and its ADHD guide warns "the broken-streak red badge can intensify shame about a moment that already carried it." Use neutral progress, not a score, for health categories.
- If a single "at-a-glance day state" is wanted, express it **qualitatively** (a warm ember glow that fills as the day progresses) rather than a numeric percentage — keeping it consistent with the Ember Chain metaphor and avoiding a "what you failed to do" framing.

### Recommended Information Architecture: Hybrid (Interleaved "Now" + Category Sections)

Of the three options — (a) filtered separate views, (b) fully interleaved, (c) hybrid — **choose (c) hybrid.**

- **Top: interleaved Now/Focus zone** (all types mixed, chronological, 3-5 items). This gives the "single pane of glass" that unified-dashboard research calls for and matches how Tiimo/Amie blend types on one screen.
- **Below: collapsible category sections** (Meds, Routines, Food, Tasks, plus a dismissible Suggestions row). Rationale: meds/routines are best grouped by day-part; tasks by priority; forcing all into one flat interleaved list loses these natural groupings, while fully separate tabs recreate the Life-vs-Todo split the merge is meant to eliminate.
- **Scope switching via a segmented control** (Today / This Week / All) at the top. Segmented controls are the right pattern here because (per Mobbin and Design Systems) they "filter or change the presentation within the same view" (as in Apple Music, and Google Calendar's Day/Week/Month, which "changes how the same calendar is drawn, not what it contains"), and best practice is 2-5 mutually exclusive options that stay visible. Keep Life/Todo as an **optional filter chip**, not a primary split — data stays unified underneath, following Superlist's "sphere toggle" model where one switch hides a whole domain "without moving anything."

Consumer precedent for a home screen that mixes work + life while staying calm is strong: Superlist users repeatedly praise that "the app isn't overloaded — it has exactly what's needed," and its icon badge can be configured to show only "due and overdue tasks from your Today view." A borrowed structural metaphor worth noting is "Now/Next/Later" — implemented literally by the iOS app Do Next ("Now, Next, Later, Someday … Widget shows tasks that you need to do now") and by Logseq's NOW/LATER task markers — though it originates as ProdPad's product-roadmap framework (Janna Bastow) and is always exactly three buckets.

### Complexity Ratings Summary (given React 19 + Dexie + AntD 5 + Framer Motion stack)
- Now/Focus zone (computed, reactive): **Medium**
- Ember Chain reuse + per-category progress: **Low–Medium**
- One-tap med/routine/food logging: **Low**
- Capped, ordered Today task list: **Medium**
- Natural-language quick capture + type chips: **Medium–High** (NL date parsing is the main effort; can start with a dayjs-based parser)
- Segmented scope control (AntD Segmented): **Low**
- Guilt-free rollover engine: **Medium** (needs a rollover job at day boundary in Dexie)
- Low-stock → buy-list rule: **Medium**
- Overdue-N-times → breakdown suggestion: **Low–Medium**
- Streak-at-risk nudge: **Low–Medium** (best-effort web-only reminders already decided)
- "Why is this here?" transparency line: **Low**

### Anti-Patterns / Things to Avoid
1. **Do NOT flood Today with every dated item** (the "Todoist problem"). Bias toward intention + a hard cap (~9 via 1-3-5).
2. **Do NOT build a second gamification/score system** that competes with the Ember Chain.
3. **Do NOT use red "overdue"/shame states or a "% you failed" card.** Guilt-free rollover only.
4. **Do NOT gamify medication/food adherence with pressure-streaks** ("streaks turn into guilt").
5. **Do NOT put configuration, master lists, analytics, or the full Kanban board on Home** — progressive disclosure to detail views.
6. **Do NOT force four+ separate add flows.** One capture, hybrid parsing.
7. **Do NOT exceed 3-5 items in the focus zone** or ~5-7 visible sections — respect chunking limits.
8. **Do NOT build a literal calendar-grid timeline on Home** — use chronological agenda grouping with untimed items at the bottom.
9. **Do NOT explain items the user explicitly scheduled** — reserve "why is this here?" for rule-surfaced items only.
10. **Do NOT make the planning/shutdown rituals mandatory or long** — they must be skippable two-tap prompts.

### Caveats
- Most cited sources are vendor docs, app-store listings, and UX practitioner writeups rather than peer-reviewed studies; treat specific quantitative claims (e.g., TickTick's "reduces task-scanning time by 1.9 seconds") as vendor marketing, not established fact.
- The "Now/Next/Later" section pattern has consumer-app precedent (Do Next, Logseq) but originates as a product-roadmapping framework (ProdPad/Bastow); it's a borrowed metaphor, not an established consumer daily-planner standard. If adopted, keep to exactly three buckets.
- The "cap at 3-5 chunks" guidance rests on working-memory research (Cowan 2001, Oberauer 2019) synthesized by UX writers; NN/G notes that for fully-visible scannable lists you are not bound by 7±2 (recognition vs. recall), so the cap applies to the decision/focus zone, not the whole scrollable agenda.
- Kiwami's no-backend constraint means all "smart" surfacing must be local rule-based logic; none of the AI features referenced (Sunsama/Tiimo/Todoist AI, Structured's Replan/AI) should be assumed available.
- Reminder reliability is already constrained to best-effort web-only; streak-at-risk and time-collision nudges inherit that limitation.
- Amie's exact untimed-ordering behavior is documented only in secondary reviews, not its own primary docs; its model essentially makes everything timed via time-blocking, which Kiwami is explicitly avoiding.

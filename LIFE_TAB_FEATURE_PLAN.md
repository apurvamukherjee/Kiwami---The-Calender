# Kiwami "Life" Tab — Build Plan

**Status: planned, not yet built.** This is the resumable spec for the Life tab —
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

- [ ] **Phase A — Data layer.** `db/types.ts` additions (§3), Dexie v5 bump
      in `db.ts`, all four `lib/*.ts` CRUD+hook modules (§4). No UI yet.
      Done when: typecheck clean, `exportAll()`/`importAll()` round-trip
      manually verified to include the new tables.
- [ ] **Phase B — Medications.** `MedicationsView`/`MedicationCard`/
      `MedicationEditorSheet`/`PrnQuickLogButton`, wired to `lib/medications.ts`.
      `EmberChain` integration + refill-alert badge.
- [ ] **Phase C — Chores.** `ChoresView`/`ChoreCard`/`ChoreEditorSheet`.
- [ ] **Phase D — Inventory.** `InventoryView`/`InventoryItemRow`/
      `InventoryEditorSheet`.
- [ ] **Phase E — Shopping.** `ShoppingView` (Wishlist/Buy-list toggle),
      `WishlistCard`/`BuyListRow`/`ShoppingItemEditorSheet`, promote-to-buy-list
      flow, share/copy/export.
- [ ] **Phase F — Today Digest.** Composes B–E's live queries plus the
      reused Calendar/Tasks hooks, per §6's exact section order.
- [ ] **Phase G — Nav + Command Palette wiring** (§8).
- [ ] **Phase H — Reminder extension** (§7): the medication check inside
      `ReminderSweeper`'s tick, plus `resolveOverdueMedicationDoses()` on mount.
- [ ] **Phase I — Polish pass**: glass-tier audit, mobile touch-target/
      safe-area audit, density-default audit — all against §9's rules.
- [ ] **Phase J — Tests + clean build** (§10).
- [ ] **Phase K — Real-browser verification pass**, matching every prior
      phase's convention: headless-Chromium (Playwright, globally installed,
      not a repo devDependency) at both 1440px desktop and 390px mobile;
      exercise medication log → streak update, chore complete → reschedule
      (both modes), running-low → add-to-buy-list, wishlist → promote →
      buy-list → mark bought, Today Digest section-by-section, and a
      genuine offline reload (service worker installed, network disabled) —
      zero console errors required, same bar every past phase was held to.
- [ ] **Phase L — Docs.** Add a `## Phase 7 — Life tab` entry to `CLAUDE.md`
      in the exact style of Phases 1–6 (what shipped, real bugs found and
      fixed, deliberate simplifications, verification performed). Update
      `README.md` with new screenshots of the Life tab (Today Digest,
      Medications, Chores, Inventory, Shopping) following its existing
      screenshot-section convention. **Per standing instruction: do not
      commit or push anything — leave all git operations to the user. Only
      the working tree and the `.md` files are touched.**

---

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

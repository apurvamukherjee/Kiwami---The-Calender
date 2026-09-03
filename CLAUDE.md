# Kiwami — CLAUDE.md

## What this is

**Kiwami** ("the pinnacle" — 極み) is a Google-Calendar-style local-first PWA
combining a full Month/Week/Day/Agenda calendar with a routine/habit engine
(streaks) and food-time adherence tracking (meal-slot logging). Built
2026-07-29 in a single continuous session, matching the stack and several
conventions of the sibling project **Zenith**
(`C:\Users\apurv\Desktop\Zenith-Own-the-peak`), with deliberate deviations
agreed with the user up front (see "Conventions that differ from Zenith"
below) — most importantly, **full desktop-optimized layout, not a
mobile-card shell**.

Signature: **Kiwami** · tagline **"Own your days"** · signature **"by Apurva"**

## Stack

React 19 + TypeScript (strict) + Vite 5 + Ant Design 5 + Dexie (IndexedDB v2)
+ Framer Motion + `react-icons/tb` (Tabler, zero `@ant-design/icons`) + dayjs
+ `chrono-node` (offline NLP date/time parsing, Notes composer) +
`vite-plugin-pwa` + optional Convex (schema only, sync deferred). No
router — two top-level sections (Calendar/Notes) toggled by local state, not
a route. `vitest` for unit tests.

## Run / build / test

```bash
npm install
npm run dev         # --host --port 5173, prints LAN URL for phone testing
npm run build        # tsc -b && vite build — must be clean before any change is done
npm run typecheck     # tsc -b --noEmit
npm run test          # vitest run — recurrence + streak suites, 18 tests
npm run preview       # serves /dist, used to verify the PWA/offline behavior
```

## Architecture

```
UI (features/*/*.tsx, components/*)   ← presentational, never touches Dexie directly
  └─ data hooks (lib/*.ts, features/*/use*.ts)  ← the ONLY place Dexie is read/written
       └─ db (src/db/db.ts)            ← Dexie instance, typed tables, export/import
```

Every read is a `useLiveQuery(...)`; every write is an exported async
function (`createEvent`, `updateEvent`, `setOccurrenceStatus`, …).
Components never import `db` directly for writes. Full technical detail
(including how a backend/sync layer slots in later) is in
[`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Directory map

```
convex/
  schema.ts              Mirrors Dexie shape (events/recurrenceRules/occurrenceStatus),
                          ownerId: v.string() (device UUID now). No functions wired — sync is deferred.
src/
  main.tsx, App.tsx       App.tsx: theme mode + splash + resolveOverdueOccurrences on mount
  theme.ts, index.css     Two-layer theming (CSS vars + useTokens concrete hex), splash keyframes
  db/
    types.ts              EventDto, RecurrenceRuleDto, OccurrenceStatusDto, SettingDto
    db.ts                 Dexie v1 schema, export/import
  lib/
    recurrence.ts          expandOccurrences() — pure, unit-tested core logic
    recurrence.test.ts      12 tests: daily/weekly/monthly-clamp/custom-anchored/boundaries
    occurrences.ts          ensureOccurrences, resolveOverdueOccurrences, setOccurrenceStatus,
                            useOccurrenceStatus (live per-occurrence status hook)
    streak.ts               computeStreakFromStatuses (pure) + computeStreak/recomputeAndCacheStreak
    streak.test.ts          6 tests
    events.ts               createEvent/updateEvent/deleteEvent/setRecurrenceRule/deleteOccurrence
    date.utils.ts, deviceId.ts, haptics.ts
  hooks/
    useThemeMode.ts         Dexie-backed theme setting; falls back to prefers-color-scheme
                            when no row exists yet; toggling writes both Dexie and a
                            localStorage first-paint cache ("kiwami-theme")
    useTokens.ts            Concrete hex palette per theme mode (alpha-blend backgrounds,
                            never CSS-var string concatenation — see gotchas below)
    useIsMobile.ts, useBackClose.ts
  components/
    Sheet.tsx               antd Modal wrapper: centered dialog on desktop/tablet,
                            full-width bottom sheet on phone widths
    TimeSelect.tsx           Two <Select> dropdowns (hour/minute) instead of TimePicker
    SplashScreen.tsx         ~3.8s cinematic intro (ember bead-ring icon, glitch wordmark,
                            rising embers, "BY APURVA" signature)
    EmberChain.tsx           THE signature streak visual — see below
    SettingsSheet.tsx        Theme toggle + FoodSlotSettings
  features/
    calendar/
      useCalendarRange.ts     view -> {rangeStart, rangeEnd} date math (month bleeds to
                              a full 6-week grid; week is Sun-Sat; day is single date;
                              agenda is a rolling 30-day window)
      useCalendarEvents.ts    Live query + occurrence expansion -> flat CalendarItem[]
      timeGrid.tsx            HOUR_H/TimeGridColumn/TimeBlock/layoutDayItems — shared by
                              Week/Day. Long-press-then-drag to create/move, bottom-edge
                              resize handle. Recurring items are tap-only, not draggable
                              (see "Known architectural decisions").
      MonthView.tsx, WeekView.tsx, DayView.tsx, AgendaView.tsx, TodayView.tsx
      CalendarPage.tsx        The app shell: toolbar (view switcher, date nav, New,
                              Settings) + active view + all sheets
      EventEditorSheet.tsx    Create/edit: title/time/recurrence/type/color/location
    routines/
      useRoutineStreak.ts     useRecentBeads, useStreakCount (live Dexie queries)
      RoutineDetailSheet.tsx  Full Ember Chain + streak number + explicit Done/Missed
    food/
      useFoodSlots.ts         CRUD for isFoodSlot events (always daily recurrence)
      FoodSlotSettings.tsx    Add/rename/retime/remove, rendered inside SettingsSheet
      FoodLogSheet.tsx        Lightweight Ate/Skipped log (no streak — food isn't tracked
                              as a streak per spec)
    notes/                    See "Phase 4 — Notes/Tasks/Reminders" below
      NotesPage.tsx           The app shell for the Notes section: toolbar (SectionTabs on
                              desktop, kind filter, Timeline/All switch) + NoteComposer +
                              active list
      NoteComposer.tsx        Sticky quick-entry bar — live chrono-node parsing as you type
      NoteEditorSheet.tsx     Edit/delete an existing note/task/reminder
      NoteListItem.tsx        One row, shared by NotesPage's lists and the Calendar
                              Agenda-view overlay
  components/
    BottomNav.tsx             Mobile-only 2-tab (Calendar/Notes) bar — a normal flex child
                              in App.tsx, not position:fixed (see Phase 4)
    SectionTabs.tsx           Desktop-only Calendar/Notes Segmented, dropped into each
                              page's own toolbar
public/icons/, favicon-32.png, apple-touch-icon.png   Procedurally generated placeholder
                              PNGs (solid ember-colored ring motif) — replace with real
                              branding before shipping anywhere public.
```

## Data model — the key scoping decision

`recurrenceRules` is **generic**: any event can recur (e.g. a plain "Team
standup" daily event), computed purely for *rendering* which dates it
appears on. `occurrenceStatus` rows — and therefore streaks — are only ever
materialized for events where `isRoutine` or `isFoodSlot` is true. A
recurring plain event never gets tracked rows. This refines the original
spec's wording; see `kiwami_project` memory / earlier conversation for the
reasoning if it ever needs revisiting.

`isRoutine`/`isFoodSlot`/`allDay` are plain **booleans, deliberately not
Dexie-indexed** — boolean isn't a valid IndexedDB key type, so an index on
one would silently misbehave. Every read filters them in memory off
`.toArray()` (`useCalendarEvents`, `useFoodSlots`), which is fine at this
app's scale. If a genuine need for an indexed boolean-like flag ever comes
up, follow Zenith's convention: store it as `0 | 1` and index that instead.

## Recurrence engine

`expandOccurrences(anchorDate, rule, rangeStart, rangeEnd)` in
`src/lib/recurrence.ts` — pure, no Dexie. Anchored at the event's own start
date (never returns a date before it); `daily`/`weekly` iterate day-by-day;
`monthly` clamps `dayOfMonth` to the shorter month's last day; `custom`
(every N days/weeks) jumps straight to the first in-range candidate index
instead of stepping from the anchor one day at a time, so a rule created
years ago queried for a window years later doesn't take thousands of steps
— while landing on the exact same cadence stepping would produce. All of
this is covered by `recurrence.test.ts` (12 cases) — **run these before
touching the engine, and add a case for any new edge behavior.**

## Streak logic

`resolveOverdueOccurrences()` (called once on app load in `App.tsx`) flips
any `"pending"` row whose date has passed to `"missed"` — this is what makes
a forgotten routine actually break its streak. `computeStreakFromStatuses`
is the pure core (unit-tested); `computeStreak`/`recomputeAndCacheStreak`
wrap it with the Dexie read/write. The cache lives on `events.streakCount`
per the original spec ("cached on the routine's parent event") and is
recomputed on every `setOccurrenceStatus` call and every auto-miss sweep.

## The Ember Chain (signature visual)

`components/EmberChain.tsx` — a horizontal chain of beads, one per streak
day. Done = glowing amber (`tokens.emberHot` + a `boxShadow` glow in
`tokens.accent`); missed = cold ash (`tokens.ash`); today unresolved =
hollow ring, softly pulsing. Chosen deliberately over a generic progress
bar/ring to give the app a distinct identity (per the original spec's "take
one real aesthetic risk" instruction). Two render sizes: `compact` (Agenda
rows, ~8px beads, last 7 days) and `full` (RoutineDetailSheet, ~15px beads,
last 21 days). **Not** rendered per-cell in Month/Week/Day — those grids
stay clean with a single-bead-equivalent status (dim/strikethrough for
missed, glow for done) per the design-direction spec's "clean,
dense-information-friendly" instruction for the grid itself.

## Conventions that differ from Zenith (read before assuming parity)

- **No mobile-card shell.** Zenith caps its app at `maxWidth: 480` centered,
  even on desktop. Kiwami is explicitly full-width/full-height responsive —
  proportional CSS-grid columns filling the viewport on desktop, collapsing
  to a simpler Day+Agenda view switcher only below the mobile breakpoint.
  Do not port Zenith's centered-card pattern into this project.
- **Icons**: `react-icons/tb`, matching Zenith's own "zero
  `@ant-design/icons`" rule — this one *is* shared with Zenith.
- **No router** — Zenith uses `react-router-dom`; Kiwami's whole surface is
  one page (Calendar + a Settings sheet), so it's just React state.
- **`vitest`** for tests — not present in Zenith, borrowed from the user's
  `Pixelpanic` repo's convention instead.

## Known architectural decisions

- **Recurring events are not draggable/resizable in the time grid** — only
  plain, non-recurring events are (`timeGrid.tsx`'s `TimeBlock`, `draggable
  = !item.rule`). The recurrence engine deliberately has no per-occurrence
  time override (simplified per the user's explicit instruction), so
  dragging one instance would either have to silently shift the whole
  series or hit a dead end. Recurring blocks show a repeat glyph instead of
  a grip handle and are tap-only (open the series editor to change the
  time for good).
- **Food slots reuse the same `pending`/`done`/`missed` enum** as routines
  (`OccurrenceStatusDto.status`) but the UI layer relabels `done`→"Ate" and
  `missed`→"Skipped" (`FoodLogSheet.tsx`) — this keeps one code path for
  both features instead of a parallel ate/skipped-only enum.
- **`useBackClose` uses a ref for `onClose`, not a dependency.** A real bug
  was found and fixed during the build: every caller passes an inline arrow
  (`onClose={() => setX(false)}`), a fresh closure every render. With
  `onClose` in the effect's dependency array, any re-render of the parent
  while a sheet was open (e.g. right after the Dexie write from marking a
  routine done) tore the effect down and rebuilt it — and the teardown's
  `history.back()` produced a delayed `popstate` that the newly-registered
  listener caught, silently closing the sheet ~500ms later. Fixed by
  tracking the callback in a ref instead, so the effect only reacts to
  `open` itself. If this hook is ever ported elsewhere, port the fix too.
- **Alpha-blended backgrounds always resolve through `useTokens()` concrete
  hex, never a CSS var.** `${color}22`-style string concatenation only
  produces valid CSS when `color` is a real hex string — `"var(--accent)" +
  "22"` is not valid CSS. `eventColor(event, tokens)` in `timeGrid.tsx`
  always returns a concrete hex for exactly this reason.
- **No `color-mix()`.** `vite.config.ts`'s build target includes
  `safari14`/`chrome80`/`firefox78`/`edge88`, none of which support
  `color-mix()` — it was used once during the build and replaced with the
  hex-alpha-suffix approach above.

## Deferred (do not build unless explicitly asked)

Real auth/multi-user, AI auto-time-blocking, meal macros/nutrition
database, full iCal RRULE parsing, cross-account free/busy, and actual
Convex sync push/pull functions (`convex/schema.ts` exists and mirrors the
Dexie shape with `ownerId: v.string()` so a real `userId` slots in later
without a schema rewrite — but nothing calls it yet).

## Honest scope-outs / known limitations

- **Placeholder PWA icons** — `public/icons/*.png`, `favicon-32.png`,
  `apple-touch-icon.png` are procedurally generated (a solid ember-colored
  ring, no actual logo/wordmark) via a one-off Node/zlib script, not real
  branding. Replace before shipping anywhere public.
- **Ant Design bundles as one ~635kB (201kB gzip) chunk** — `vite build`
  warns about this (grew from ~524kB in Phase 1 with Phase 2's added
  `Popconfirm`/`DatePicker`/`Select`/`Empty` usage). No code-splitting has
  been done; fine for a personal local-first app, worth revisiting with
  `manualChunks`/dynamic `import()` if the bundle ever needs to shrink.
- **No drag-and-drop reschedule for recurring events** (see above) and no
  drag-to-create in Month view (cells are too small to grab reliably —
  same reasoning Zenith's own Month view uses).

## Phase 2 — UX fixes + 3 flagship features (2026-07-29)

10 UX fixes and 3 of 10 scoped "crazy cool" feature ideas (Ember Year
Heatmap, Command Palette, forged-bead streak milestones), chosen by the
user as "all fixes + 2-3 flagship features." Full scoping/reasoning lives
in the session's plan; summarized here for future reference.

**Fixes**: `Popconfirm` on every destructive action (`EventEditorSheet`'s
two delete buttons, `FoodSlotSettings`'s remove) · toast feedback via
`App.useApp()` on create/save/delete/add/rename (deliberately **not** on
Done/Missed/Ate/Skipped — the Ember Chain glow updating live already is the
feedback there, and a toast on every daily tap would get noisy) · a compact
`DatePicker` in the toolbar for jumping to any date · the splash now gates
on `sessionStorage["kiwami-splash-seen"]`, playing once per browser session
instead of every reload · **`timeGrid.tsx`'s hour range is no longer a
fixed 5am–11pm module constant** — `computeHourRange()` expands it (rounded
to whole hours) only when an item actually falls outside the default,
threaded as `startHour`/`endHour` props through `HourGridLines`/
`NowIndicator`/`TimeGridColumn`/`TimeBlock`/`ResizeHandle` instead of each
reading a free variable · `components/InstallPrompt.tsx` captures
`beforeinstallprompt` for a real install banner · `vite.config.ts` now sets
`injectRegister: false` and `App.tsx` calls `useRegisterSW()` from
`virtual:pwa-register/react` directly, surfacing `needRefresh` as a visible
"new version, Refresh" banner instead of swapping the service worker
silently · a `useHasAnyEvents()`-gated empty-state card guides a first-run
user · `useSearchEvents.ts` (title-substring match, resolved to each
match's nearest occurrence via `expandOccurrences` over a ±180-day window)
— **its UI was deliberately merged into the Command Palette below rather
than built as a second, differently-shaped search surface** · arrow-key
date nav + "T" for Today, plus `aria-label`s on every icon-only button.

**Features**:
- **Ember Year Heatmap** (`components/EmberYearGrid.tsx`,
  `features/routines/{useRoutines,YearHeatmapSheet}.tsx`) — a real
  GitHub-contributions-style grid (weeks as columns, weekdays as rows, month
  labels aligned above), colored with the same `tokens.emberHot`/`tokens.ash`
  as the Ember Chain. Deliberately **scoped per-routine** (a `Select` picks
  which one) — a blended "all routines" view is a real follow-up idea, not
  built here.
- **Command Palette** (`components/CommandPalette.tsx`, Ctrl/Cmd+K or the
  toolbar search icon) — one search surface behind two entry points, both
  consuming `useSearchEvents`. **Real bug found and fixed here**: antd's
  `Modal` grabs focus back onto its own wrapper right after opening (its own
  focus-trap/accessibility handling), which raced the search `Input`'s
  `autoFocus` and won — keystrokes silently went nowhere. Fixed via
  `Modal`'s `afterOpenChange` callback explicitly focusing an `inputRef`
  once the open transition settles, instead of relying on `autoFocus`.
- **Forged-bead streak milestones** (`components/EmberChain.tsx`) — at
  7/30/100/365-day streaks, today's bead renders as a rotated-diamond
  "forged" shape with a one-time expanding-ring burst instead of a plain
  circle. Takes `milestoneStreak?: number` — deliberately the event's *real*
  cached `streakCount` (from `useStreakCount`, already available in
  `RoutineDetailSheet`), **not** inferred from the visible bead window (a
  compact 7-bead Agenda chain can't know a day-30 milestone was reached
  outside it). The burst is keyed on `` `milestone-${milestoneStreak}` ``,
  which is what makes it replay exactly when a *new* milestone is reached
  and stay static on every subsequent reopen of the same streak count. The
  plan called for a separate unit-tested `computeRunningStreaks` helper to
  infer milestones from the bead window; using the already-correct cached
  streak instead made that helper unnecessary, so it was never built —
  simpler and strictly more correct.

## Verification this build has actually had

Every phase was checked in a real headless-Chromium session (Playwright via
a globally-installed copy — no `playwright` devDependency was added to this
repo), not just `tsc`/`vitest`: full desktop (1440px) and mobile (390px)
screenshots of all four views, a real create → recurrence-expand → render →
mark-done → streak-update round trip for both a routine and a food slot,
and a genuine offline test (service worker installed, network context fully
disabled, reloaded, and interacted with a live view switch) — all with zero
console errors.

## Phase 3 — "Ember & Ash" visual revamp (2026-07-30)

A full re-theme, sourced from a Google Stitch MCP design system generated
against Kiwami's own real README/screenshots. Stitch produced three static
HTML mockups (Month View, Routine Detail, Agenda Mobile) with **invented**
navigation/content ("Rituals"/"The Forge" nav, a 5-icon bottom nav, Material
Symbols icons, a fictional desktop day-detail sidebar) that were deliberately
**not** ported — only the token system and specific component treatments
were extracted and applied to Kiwami's real, functional components.

**Tokens**: obsidian surface scale (`#131313` base), ember primary
(`#ff9f1c`/`#ffb86b` gradient), teal secondary (`#4fdbcc`, food — unchanged
role), and a new **`diamond`** token (`#90dceb`) reserved *exclusively* for
streak-milestone beads, never reused as a general accent. All in
`src/theme.ts`'s `TOKENS` map and `src/index.css`'s CSS vars (dark values
extracted from the real Stitch-generated Tailwind config; light is a
hand-authored equivalent — Stitch's design system was dark-only).

**Fonts**: Playfair Display (streak numerals, hero headlines) and JetBrains
Mono (calendar day-numbers, timestamps, uppercase micro-labels via the new
`.label-caps` utility class) self-hosted via `@fontsource/playfair-display`
+ `@fontsource/jetbrains-mono` — static woff2 only, zero CDN calls, so the
offline-first guarantee (verified with the network fully disabled in Phase
1) still holds. Confirmed no `fonts.googleapis.com`/`fonts.gstatic.com`
reference anywhere in `dist/` after build.

**A deliberate density/decoration split**: the original spec calls for the
calendar grid to stay "clean, dense-information-friendly" — this is a
daily-use tool, not a marketing page — while the Stitch mockups lean into
decorative maximalism (heavy per-cell blur, 64px inline serif numerals).
Resolved by intensity tier: **hero surfaces** (`RoutineDetailSheet`, the
Command Palette, the splash) got the full glass/blur/glow/serif treatment;
**dense grid surfaces** (`MonthView`, `AgendaView`, the toolbar) adopted the
new palette and JetBrains Mono for data, but skip heavy blur and oversized
numerals, preserving density.

**`EmberChain.tsx`**: lit beads are now a gradient (`emberHot`→`accent`)
instead of flat fill; missed beads got a layered "crater" look (a smaller
inset circle); the forged/milestone bead recolored from ember to the new
`diamond` token exclusively; the `size === "full"` today-pending bead (used
only in `RoutineDetailSheet`) switched from a hollow pulsing ring to a
filled dot with an outer ping ring — `size === "compact"` (Agenda rows)
deliberately kept the quieter hollow ring, since a pinging bead next to a
dozen other chains in a dense list would be noise, not signal.

**`RoutineDetailSheet.tsx`** got the "Floating Blade" treatment: the antd
`Modal`'s `content`/`header` panels go translucent with a 20px
`backdropFilter` blur, plus a decorative blurred gradient bloom in one
corner (`overflow: hidden` on an inner wrapper, not on `Sheet.tsx` itself —
touching `Sheet.tsx`'s outer chrome risked breaking its tested
mobile-bottom-sheet-vs-desktop-dialog radius logic, so the glass/bloom
treatment lives entirely inside `RoutineDetailSheet`'s own content instead).
The Command Palette got the same blur treatment plus a border that's
transparent until the search input gains focus, then lights up
`var(--diamond)` via a `.kiwami-blade:focus-within` CSS rule (no extra
React state needed).

## Phase 4 — Notes/Tasks/Reminders + 2-tab nav (2026-08-03)

Kiwami became a two-section app: a **Calendar** section (everything above)
and a new **Notes** section for freeform Notes/Tasks/Reminders, switched via
`App.tsx`'s `section` state — `BottomNav` (mobile) or `SectionTabs` (desktop,
dropped into each page's own toolbar). `App.tsx`'s root div changed from
`height: 100dvh` to a real flex column (`BottomNav` as a normal flex child,
not `position: fixed`) so no page needs manual bottom-padding math; both
`CalendarPage` and `NotesPage` fill `height: 100%` of that flex slot instead
of the raw viewport now.

**Data model**: `db/types.ts`'s `NoteDto`/`NoteKind` (`"note" | "task" |
"reminder"`), a new Dexie `notes` table (`db.ts` version 2, purely additive —
no `upgrade()` needed). `kind` is a string enum, safely indexable — unlike
the `isRoutine`/`isFoodSlot` boolean gotcha documented above. `lib/notes.ts`
mirrors `lib/events.ts`'s CRUD-function/live-query-hook shape exactly.

**NLP date/time parsing** (`lib/parseNoteText.ts`, unit-tested): the Notes
composer live-parses whatever you type via `chrono-node` — fully offline, no
network call, matching the "100% local" privacy story. Only date/time is
auto-recognized; **location is a manual field, not parsed from prose** —
there's no reliable offline signal for "this is a place" without a geocoding
API call. Links are auto-extracted via a plain URL regex and left inline in
the title (stripping them would look like data loss); only the matched
date/time phrase is stripped. First concrete date only — "every Monday"
isn't expanded into a rule; reusing the events/recurrenceRules engine for
notes was scoped out as a materially bigger lift than this pass.

**Reminders are foreground-only.** `lib/notifications.ts`'s `checkDueReminders()`
runs on app mount and a 60s interval (`App.tsx`'s `ReminderSweeper`, a
separate child of `<AntApp>` since the in-app-toast fallback needs
`App.useApp()`, which only resolves inside `AntApp`'s own subtree — calling
it directly in the `App` component doesn't work). This fires a real
`Notification` when permission is granted, or an antd toast fallback
otherwise, then stamps `notifiedAt` so it doesn't re-fire — same "catch up
the moment a human opens the app" honesty as `resolveOverdueOccurrences()`.
**A reminder that fires with the app/phone fully closed needs Web Push +
VAPID + a server to trigger it at the right time** — Kiwami has no backend
wired up (Convex is schema-only, no functions), so that's an explicit future
phase, not this one. Permission is requested lazily, the first time a
Reminder is actually saved — not on app load.

**Calendar integration**: dated Tasks/Reminders show up in every Calendar
view — Month, Agenda, and (since a later pass — see "Week/Day timed
note/task placement" below) Week/Day's hourly grid too — via separate
`useNotesForRange`/`useTasksForRange` live queries passed into each view as
their own props — deliberately **not** merged into `useCalendarEvents.ts`'s
`CalendarItem` pipeline, which has 12+18 passing unit tests riding on it.
Month gets a small teal dot badge (`Popover` listing that day's notes/tasks,
same pattern as the existing "+N more" event overflow); Agenda interleaves
`NoteListItem`/`TaskAgendaRow` rows into its existing per-day groups, tapping
either opens `NoteEditorSheet`/`TaskDetailSheet` instead of `EventEditorSheet`.

**Week/Day timed note/task placement**: a dated Task/Reminder with a specific
time-of-day (`allDay: false`) renders as a real block in Week/Day's hourly
grid at that time, not just in Month/Agenda — closing the gap this file used
to flag as a "v1.1 follow-up." All-day ones still join the existing all-day
strip alongside all-day events. Implemented in `timeGrid.tsx`: `TimeBlock`
(events) is untouched; a separate `NoteTaskBlock` renders notes/tasks with
their own dashed-border look (matching `TaskAgendaRow`'s existing dashed-
border convention) and is tap-only, never draggable — a task/reminder's
"time" is a due moment, not a duration, and rescheduling one by drag would
need to write to a different table (`tasks`/`notes`) than `TimeBlock`'s
`updateEvent`, a bigger feature than this pass needed. Notes/tasks get their
own independent overlap-avoidance column group (`layoutTimedNoteTasks`),
deliberately *not* merged with `layoutDayItems`' event columns — merging the
two would mean an event's column position could shift depending on which
unrelated tasks happen to be due that day, a bigger behavior change than the
feature needed. The two systems share one generic algorithm
(`computeSpanColumns`, extracted from the original `layoutDayItems` with
identical behavior when no notes/tasks are present) but lay out
independently, so a task and an event at the exact same time can render
overlapping rather than mutually avoiding — an accepted, documented
trade-off, not a bug. `computeHourRange` also takes an `extraTimes` param so
a task/reminder outside the default 5am–11pm window still pulls the grid
open, same as an event would.

**Verified**: `npm run typecheck`/`test` (23 tests, up from 18)/`build` all
clean; a real headless-Chromium pass (Playwright, same globally-installed
copy used in earlier phases) at both 390px and 1440px confirmed the nav
switch, live NLP chip preview, Timeline day-grouping, the Month-view dot
badge, and the Agenda-view overlay all render correctly with zero console
errors.

## Phase 5 — Rich-text Notes, Apple Notes-style (2026-08-03)

The "note" kind got real rich text — headers/subheaders, bold/italic/
underline/strikethrough, text color, bulleted/numbered/checklist lists —
edited full-screen instead of the small pinned composer, mirroring Apple
Notes: tap "New note…" (or an existing note card) and the whole viewport
becomes the writing surface; there's no separate title input, the body's
first line *is* the title, same as Apple Notes.

**Library**: `@tiptap/react` + `@tiptap/starter-kit` (bundles bold/italic/
strike/underline/headings/bullet+ordered lists already) + `@tiptap/extension-
text-style`+`extension-color` (font color) + `extension-task-list`+
`extension-task-item` (checklist) + `extension-placeholder`. All pure client-
side JS, zero network calls — consistent with the "100% local" guarantee
that ruled out real location-NLP in Phase 4. Chosen over Lexical/Slate for
React-first ergonomics and a StarterKit that already covers most of the
Apple Notes format menu out of the box.

**Data model**: `NoteDto.body?: string` — Tiptap HTML, `kind: "note"` only.
`title` is now *derived*, not typed: `lib/notes.ts`'s `htmlToTitle()` takes
the body's first heading/paragraph/list-item as plain text (`htmlToPlainText`
also feeds the note-card preview snippet in `NoteListItem`). No Dexie version
bump needed — `body` is a new, non-indexed field on the existing `notes`
table.

**`features/notes/NoteFullEditor.tsx`** — a `position: fixed; inset: 0`
overlay (not a `Sheet`/antd `Modal`), mounted conditionally by its callers
(`NoteComposer` for a brand-new note, `NotesPage`/`CalendarPage` for tapping
an existing one) rather than always-mounted with an `open` prop. Autosaves on
a 600ms debounce after each edit — no Save button, no "did that stick"
moment. A brand-new note isn't written to Dexie until the first non-empty
edit (`persist()` no-ops on `editor.isEmpty`), so opening-then-immediately-
backing-out never leaves a ghost row; an *existing* note that gets fully
cleared is deliberately left alone rather than auto-deleted (only a truly
never-saved new note is that forgiving).

**Real bug found and fixed here**: `useBackClose(true, onClose)` — passing a
literal `true` on this component's first render — made the editor
self-close a few hundred ms after opening. React StrictMode double-invokes a
component's effects once on initial mount (mount → cleanup → mount again, to
catch missing cleanup) purely in dev; `useBackClose`'s cleanup calls
`history.back()` whenever its own `pushState` is still on top, and that
`history.back()`'s popstate event arrives *after* the second (real) mount
has already registered its own listener — which then catches it and calls
`onClose()`, closing the editor it just opened. Every other `useBackClose`
caller in this codebase is a `Sheet`-based component that's always mounted
with `open` starting `false`, so the doubled initial-mount effect
early-returns and never hits this — `open` only flips `true` later, on a
real (non-doubled) update. Fixed by mirroring that shape locally instead of
touching the shared hook (which `CLAUDE.md` already flags as
fix-and-port-carefully): `NoteFullEditor` starts a local `ready` state at
`false` and flips it `true` in a `useEffect`, so `useBackClose` only ever
sees `open: true` on a genuine subsequent render, never as part of the
doubled initial mount.

**Formatting toolbar**: block-style `<select>` (Title=H1/Heading=H2/
Subheading=H3/Body=paragraph), Bold/Italic/Underline/Strikethrough toggle
buttons, a small color-swatch popover (ember/gold/teal/danger + default,
reusing `useTokens()`), bullet/numbered/checklist list buttons. CSS for the
`.ProseMirror` content area (heading sizes, task-list checkbox layout,
placeholder text) lives in `index.css` under `.kiwami-editor-body` — Tiptap
ships no default styling of its own.

**Scoped out**: images/attachments, tables, font-family choice, note
pinning/folders — Apple Notes' format menu is large; this covers the
explicitly requested subset (headers, color, bold/italic, checklists) rather
than the whole surface.

**Verified**: `npm run typecheck`/`test`/`build` clean (bundle grew to
~829kB/260kB gzip from Tiptap — noted, not addressed, same "revisit with
code-splitting if it ever matters" stance as the existing antd bundle-size
scope-out). A real headless-Chromium pass confirmed: opening a new note,
applying Title/Heading/Body block styles, bold, checklist (`<li
data-checked>`), and color (verified via `span[style*="color"]` in the
DOM) all produce correct markup; closing and reopening the note from the
gallery round-trips the saved HTML correctly; zero console errors.

## Phase 6 — Today dashboard, multi-day events, Tasks board filters (2026-08-10)

Three independent asks, tackled together: a single "what does today look
like" view, real multi-day/spanning events, and decluttering the Kanban
board around what's actually actionable now.

**Today dashboard** (`features/calendar/TodayView.tsx`) — merges routines,
food slots, plain events, dated tasks, and reminders into one screen,
grouped into sections (only rendered if non-empty) with a "Nothing on your
plate today" empty state. Folded into `CalendarPage`'s existing view
switcher as a 5th option (`CalendarView` gained `"today"`) rather than a
new top-level nav section — it's a lens on data the app already has three
separate pages for, not a new data domain. Deliberately **self-querying**
(`useCalendarEvents(today, today)` + its own `useTasks()`/`useNotes()`
calls) instead of reusing `CalendarPage`'s range-bound `items`/`notes`/
`tasks` props, since those are bound to whatever `[rangeStart, rangeEnd]`
the *previously* active view computed and would miss overdue tasks/
reminders sitting before that window. A task/reminder counts as "on the
plate" if it's due today (shown even once completed, dimmed — vanishing
the instant it's checked off would read as data loss) or overdue-and-still-
open; undated backlog tasks stay Tasks-board-only. Because it's a
dashboard, not a navigable view, `CalendarPage.step()` no-ops for it and
the toolbar hides its prev/next/date-picker cluster — Today always shows
the real current date, never `currentDate`. It also has its own accurate
empty state, so `CalendarPage`'s existing `eventCount === 0` "Nothing here
yet" overlay (gated on real calendar events only) is suppressed while this
view is active — otherwise it would float over a Today screen that's
genuinely non-empty from tasks/reminders alone.

**Multi-day / spanning events** — `EventEditorSheet` gained a "Multi-day"
toggle + end-date field, offered only when `allDay` is true and the event
is non-recurring (`repeat === "none"`). Recurring events can never span:
the recurrence engine has no per-occurrence override (see "Known
architectural decisions" above), so a spanning *series* would be a
materially bigger feature this pass didn't take on — confirmed with the
user up front rather than assumed. `CalendarItem` (`useCalendarEvents.ts`)
gained `spanEndDate?: string`, computed only for non-recurring events whose
`endTime`'s date is later than its `startTime`'s date; a real bug was
fixed in the same pass — the old inclusion check
(`anchorDate >= rangeStart && anchorDate <= rangeEnd`) would have silently
dropped a spanning event whose *start* fell before the visible range even
if it was still ongoing, so it's now a proper range-overlap check. Two new
exports, `isItemOnDate`/`isSpanningItem`, are the single shared way every
view answers "does this item show on date X":
- **Month** (`MonthView.tsx`): renders a real continuous bar per week-row
  instead of a per-day pill, clipping a span to each week-row it crosses
  (a 10-day trip → two bar segments, Google-Calendar style) and stacking
  overlapping bars via `computeSpanColumns` — the *same* greedy interval-
  partitioning algorithm `timeGrid.tsx` already used for overlapping timed
  events, reused with day-columns standing in for minutes and `col`
  repurposed as a vertical stack index. Bars are a `position:absolute`
  percentage-positioned overlay sibling to the untouched day-cell grid
  (not participating in CSS Grid auto-placement), so the existing pill/
  popover logic has zero behavior change when no spanning events exist.
  Day cells reserve `paddingTop` for the tallest stack in the *whole
  month* (not per-row) — a deliberate simplification that costs nothing
  extra, since `gridTemplateRows: repeat(weekRows, 1fr)` already forces
  every week row to the same height regardless of content.
- **Week** (`WeekView.tsx`): same `computeSpanColumns` stacking, but placed
  via native CSS Grid `gridColumn`/`gridRow` spanning instead of absolute
  positioning — simpler when there's only one row (the visible week) to
  place into, since the all-day strip is already a `repeat(7, 1fr)` grid.
- **Day/Agenda**: no bar (nothing to span across in a single column) — a
  spanning item just shows in the all-day strip on every date within
  range via `isItemOnDate`, with a small "10 Aug – 13 Aug" hint in Day;
  Agenda repeats the same row into every day-group it covers rather than
  a "Day N of M" label.

**Tasks board filters** (`TasksPage.tsx`/`KanbanBoard.tsx`/
`TaskColumn.tsx`) — a `Segmented` scope filter (**Today** default |
Recurring | All) plus a "Show completed" switch (off by default), closing
the gap where every column showed everything, done or not, forever.
`taskMatchesFilter` (`lib/tasks.ts`) is the single predicate both the
board and its mobile per-list count pills use; "today" scope excludes
recurring tasks (they get their own lens) and anything dated strictly
after today, but keeps undated/overdue/due-today tasks — a Kanban board's
undated backlog cards are still "on the plate", not exiled to a date-based
view. Filtering is deliberately applied **only at the render level** inside
`TaskColumn` (skip → `return null`) rather than upstream before
`groupTasksByList` — `SortableContext`'s `items` and `KanbanBoard`'s
`columns` state keep the column's *full* unfiltered id list, so
`reorderBoard`'s eventual write never renumbers a filtered subset's
0..N-1 and clobbers a hidden task's relative order. `FocusSheet`/
`WeeklyReviewSheet`/`TaskDetailSheet`/`TaskArchiveView` all keep reading
the full, unfiltered `tasks` list from `TasksPage` — this filter is a
board-view concern only, not a data-scoping one.

**Verified**: `npm run typecheck`/`test` (34 tests)/`build` all clean. A
real headless-Chromium pass created a 4-day spanning all-day event and
confirmed a continuous bar in Month (correctly clipped to Mon–Thu, stopping
before Fri) and Week, the "2026-08-10 – 2026-08-13" hint in Day, and the
row repeating across all 4 day-groups in Agenda; confirmed the Today
dashboard correctly surfaces a same-day task and reminder created from the
Notes composer; confirmed the Tasks board's default Today+hide-completed
view, the "N done today" badge, and the completed task reappearing
(struck through) the instant "Show completed" is toggled on — zero console
errors throughout.

## Phase 7 — Life tab: medications, chores, inventory, shopping (2026-09-03)

A fourth top-level section (`Calendar | Notes | Tasks | Life`, Calendar
stays the default/home tab) built from a deep-research report on the
"everything for today" niche. Full plan, decision log, and a phase-by-phase
build record live in `LIFE_TAB_FEATURE_PLAN.md` — this entry is the
condensed version. `BottomNav`/`SectionTabs`' `Section` type gained
`"life"` (icon `TbLayoutDashboard`).

**Data model** — Dexie `version(5)`, purely additive (`db/types.ts`/`db.ts`):
`MedicationDto`/`MedicationLogDto`, `ChoreDto`, `InventoryItemDto`,
`WishlistItemDto`/`BuyListItemDto`. None of this forks a new engine —
medications/chores embed a `TaskRecurrenceDto` (same convention as
`TaskDto.recurrence`, not a `recurrenceRules` table row), and medication
adherence reuses `OccurrenceStatusValue` verbatim (UI relabels
`done`→"Taken", `missed`→"Skipped" — the same trick `isFoodSlot` events
already use), so `computeStreakFromStatuses` (`lib/streak.ts`) needed zero
changes for medications' own Ember Chain. Chores' "reschedule from
completion date" option reuses `rollTaskDueDateForward()` unmodified — the
entire new behavior is which date `completeChore()` (`lib/chores.ts`)
passes as the anchor: `todayKey()` when rescheduling from completion,
the chore's own `dueDate` otherwise.

**UI** — `src/features/life/`: `LifePage.tsx` (shell, mirrors `TasksPage.tsx`,
a `Segmented` switches Today/Medications/Chores/Inventory/Shopping),
`TodayDigest.tsx` (the unified daily view — catch-up strip, Now/Next,
Medications, Schedule, Tasks, Chores & Household, Shopping — reusing
`MedicationCard`/`ChoreCard`/`InventoryItemRow`/`BuyListRow` **verbatim**
rather than a second row-UI, and the *same* `useCalendarEvents`/`useTasks`
hooks Calendar's own `TodayView.tsx` already calls for Schedule/Tasks).
Calendar's `TodayView.tsx` was deliberately left untouched — `TodayDigest`
is a superset of it, and the overlap on events/tasks is an accepted
trade-off, the same reasoning Phase 6 already used for Week/Day's
independent note/task layout columns. Command Palette gained
`useLifeSearch` (same `scoreMatch` fuzzy matcher as every other search
producer) plus three quick-actions, and a `pendingLifeView` deep-link
(mirroring `pendingTaskId`) so a palette result lands on the right
sub-view, not just the tab.

**Reminders**: `lib/notifications.ts`'s `checkDueReminders()` gained a
third sweep (alongside notes/tasks) for scheduled medications — same
best-effort, foreground-only honesty this app already had. De-duplication
is a **session-only in-memory `Set`**, not a DB field, since a due-but-
unlogged dose has no row to stamp a `notifiedAt` onto.

**Three real bugs found by actually driving the browser** (not caught by
typecheck/tests), in the same spirit as this file's other documented bugs:

1. **Weekly recurrence with zero weekdays selected.** `ChoreEditorSheet`'s
   recurrence picker was copied from `EventEditorSheet`'s proven pattern,
   which has the same gap — a "Weekly" repeat with no weekday chosen
   produces a rule `expandOccurrences()` can never satisfy. For an event
   that's silently harmless (it just never renders); for a chore it's
   worse: `completeChore()` correctly falls back to "no next occurrence →
   complete normally" (by design, for a genuinely *ended* series), but an
   empty-weekdays rule triggers that fallback on the very first completion,
   silently turning a recurring chore into a one-off. **Fixed** in both
   `ChoreEditorSheet.tsx`/`MedicationEditorSheet.tsx`: selecting "Weekly"
   auto-defaults to today's weekday if none is picked yet.
2. **A real Dexie `BulkError` crash.** React StrictMode's dev-only double
   mount-effect let two concurrent `resolveOverdueMedicationDoses()` calls
   both read "no row yet" for the same overdue dose and both `bulkAdd` it,
   tripping `medicationLogs`' `&[medicationId+occurrenceDate+scheduledTime]`
   unique index — the exact bug class this file already documents for
   `ensureDefaultTaskLists()`. **Fixed** the identical way: wrapped the
   read-then-write in one `db.transaction`.
3. **Same-day doses were auto-missed before the user got a chance to act.**
   `resolveOverdueMedicationDoses()`'s date range originally ran through
   *today* inclusive, so a dose whose clock time had already passed today
   got marked `"missed"` on the very next mount — racing ahead of the
   reminder notification and denying the rest of the day as a grace period.
   This app's own proven precedent, `resolveOverdueOccurrences()`
   (routines), explicitly scopes to `.where("occurrenceDate").below(today)`
   — strictly before today. **Fixed** to match it exactly: the range is now
   `[lookback, yesterday]`.

A fourth bug surfaced during the offline verification pass, unrelated to
this feature's own code but caught while testing it: `vite.config.ts`'s
`VitePWA` `workbox.globPatterns` never included `woff`/`woff2` at all, so
the self-hosted `@fontsource` fonts this app claims are fully
offline-available were never actually precached — any font weight/format
the browser's regular HTTP cache hadn't independently retained 404'd the
instant the network was disabled. The Life tab's bold `font-mono` time
chips happened to be what finally triggered it. **Fixed**: added
`woff,woff2` to the glob (precache grew from 32 to 42 entries).

**Glass polish**: `index.css` gained `--glass-*` tokens (light `:root` +
`[data-theme="dark"]` override, matching every other token) and a `.glass`
utility — **literal** `blur(14px) saturate(180%)` (never through a
`var()` — iOS Safari 18 silently drops a CSS-variable blur radius), both
`-webkit-backdrop-filter` and `backdrop-filter`, wrapped in `@supports`
with the solid `--glass-bg` fill as the fallback. Applied only to
`TodayDigest`'s catch-up strip — its one genuine hero moment, per the
existing hero-vs-dense intensity-tier convention (Phase 3) — every dense
Life list stays flat. A respectful Framer Motion mount reveal
(`{type:"spring", stiffness:300, damping:30, mass:0.2}`, gated through
`useReducedMotion()`) was added to `TodayDigest`.

**Verified**: `npm run typecheck`/`test` (61 tests, up from 48)/`build` all
clean. A real headless-Chromium pass exercised every domain end to end —
medication log → streak update, refill alert, chore complete → reschedule
(both fixed-schedule and reschedule-from-completion modes, confirmed via
the actual due-date rolling forward correctly), running-low inventory →
add-to-buy-list, wishlist → promote → buy-list → mark bought, Command
Palette search → jump to the correct sub-view, Today Digest section by
section, both themes (light via Playwright's default, and genuine dark via
`colorScheme: "dark"` emulation, confirming the no-stored-preference
default resolves correctly), mobile 390px, and — against the actual
production build (`vite preview`, a real registered service worker, not
the dev server) — a genuine offline reload with the network fully
disabled, twice in a row to also confirm the StrictMode-race fix holds
under repeated real mounts. Zero console errors on every pass, in the end.

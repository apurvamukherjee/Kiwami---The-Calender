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

React 19 + TypeScript (strict) + Vite 5 + Ant Design 5 + Dexie (IndexedDB v1)
+ Framer Motion + `react-icons/tb` (Tabler, zero `@ant-design/icons`) + dayjs
+ `vite-plugin-pwa` + optional Convex (schema only, sync deferred). No
router — single-page, local view state. `vitest` for unit tests.

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
      MonthView.tsx, WeekView.tsx, DayView.tsx, AgendaView.tsx
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
- **Ant Design bundles as one ~524kB (166kB gzip) chunk** — `vite build`
  warns about this. No code-splitting has been done; fine for a personal
  local-first app, worth revisiting with `manualChunks`/dynamic `import()`
  if the bundle ever needs to shrink.
- **No drag-and-drop reschedule for recurring events** (see above) and no
  drag-to-create in Month view (cells are too small to grab reliably —
  same reasoning Zenith's own Month view uses).

## Verification this build has actually had

Every phase was checked in a real headless-Chromium session (Playwright via
a globally-installed copy — no `playwright` devDependency was added to this
repo), not just `tsc`/`vitest`: full desktop (1440px) and mobile (390px)
screenshots of all four views, a real create → recurrence-expand → render →
mark-done → streak-update round trip for both a routine and a food slot,
and a genuine offline test (service worker installed, network context fully
disabled, reloaded, and interacted with a live view switch) — all with zero
console errors.

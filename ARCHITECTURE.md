# Kiwami — Architecture & backend path

Kiwami is **front-end only** today: all data lives in the browser
(IndexedDB via Dexie). It's structured so a backend (Convex) can be wired up
later **without rewriting the UI.**

## The layers

```
UI (features/*/*.tsx, components/*)          ← presentational, never touches Dexie directly
  └─ data hooks (lib/*.ts, features/*/use*.ts) ← the ONLY place storage is called
       └─ db (src/db/db.ts)                    ← Dexie instance + typed tables + export/import
```

Every read is a `useLiveQuery(...)`; every write is an exported async
function (`createEvent`, `updateEvent`, `deleteEvent`, `setOccurrenceStatus`,
`ensureOccurrences`, `resolveOverdueOccurrences`, …). Components never
import `db` directly to write. That single seam is what makes a future
backend swap or sync layer cheap to add.

## Data flow for one screen, end to end

`CalendarPage` picks a `view` + `currentDate` → `useCalendarRange` turns
that into a concrete `[rangeStart, rangeEnd]` window → `useCalendarEvents`
live-queries every row in `events`/`recurrenceRules`/`occurrenceStatus`,
expands each recurring event's dates via the pure `expandOccurrences`, and
(as a side effect) calls `ensureOccurrences` to materialize any missing
`occurrenceStatus` rows for routine/food-slot events now visible in that
window — then returns a flat, sorted `CalendarItem[]` that Month/Week/Day/
Agenda all render identically. Marking an occurrence done/missed
(`setOccurrenceStatus`) writes the status row and recomputes/caches that
event's streak in the same call; the live query above picks up both changes
automatically, no manual refetch anywhere.

## Recurrence is expanded, never materialized, until it needs tracking

This is the load-bearing design decision: a recurring event is **one row**
in `events` plus **one row** in `recurrenceRules`, regardless of how many
times it appears on the calendar. `expandOccurrences` (pure, unit-tested,
zero Dexie) computes concrete dates on demand for whatever window is
currently visible. The only time a *real* row gets written per-occurrence
is `occurrenceStatus`, and only for `isRoutine`/`isFoodSlot` events — because
those are the only ones that need a persisted done/missed/pending state and
a streak. A plain recurring event (e.g. a repeating meeting) never
accumulates rows at all; it's recomputed from the rule every time.

Trade-off this implies: **no per-occurrence time override.** Every
occurrence of a recurring event shares the parent event's time-of-day —
changing the time means editing the whole series. `timeGrid.tsx` reflects
this directly: `TimeBlock`'s drag-to-move/resize is disabled whenever
`item.rule` is set (see `CLAUDE.md`'s "Known architectural decisions" for
the full reasoning).

## Streak/auto-miss as a small explicit sweep, not a background job

There's no cron, no service-worker-driven background task. On every app
load, `App.tsx` calls `resolveOverdueOccurrences()` once — a straight Dexie
query for `pending` rows dated before today, flipped to `missed`, with the
affected events' streaks recomputed. This is sufficient because the app is
only ever "running" when a human has it open; there's nothing to catch up
on that couldn't have been resolved the next time someone opens the app.

## Adding a backend later (no UI changes)

1. Keep the DTOs in `src/db/types.ts` as the shared contract — `convex/schema.ts`
   already mirrors them field-for-field, so there's no new modeling to do.
2. Give the hooks in `lib/events.ts`/`lib/occurrences.ts` a remote
   counterpart with the **same function signatures**, or run both and treat
   Dexie as an offline cache in front of Convex.
3. For real offline-first sync (not just "online-only convenience"), add a
   `updatedAt`-diff push/pull: push any row whose `updatedAt` is newer than
   the last successful sync, pull remote rows newer than the local
   watermark, last-write-wins on conflict (or a small merge rule per table
   if that's ever not good enough). Dexie stays the local source of truth;
   Convex becomes the durable backup + multi-device sync target.
4. `ownerId` (a device UUID today, `src/lib/deviceId.ts`) is already the key
   every table is scoped by — both locally and in `convex/schema.ts`.
   Swapping in real auth later means writing the authenticated user's id
   into that same field instead of the device UUID; no schema rewrite,
   no query rewrite, just a different value at write time.
5. Auth itself slots in at the app root (a provider wrapping `<App />` in
   `main.tsx`); hooks would read the identity from context the same way
   `getDeviceId()` is called today.

Recommended when ready: **Convex** — the schema is already there
(`convex/schema.ts`), and it pairs naturally with Dexie's `useLiveQuery`
pattern (Convex's own `useQuery` has the same "just re-renders on change"
shape, so a hook that today does `useLiveQuery(() => db.events...)` could
eventually do `useQuery(api.events.list)` with minimal churn).

## PWA / offline

`vite-plugin-pwa` (`generateSW` mode) precaches the built app shell; Dexie
is the actual data store, so there's nothing else that needs a caching
strategy — the one `runtimeCaching` rule that exists is a `NetworkOnly`
passthrough for `*.convex.cloud` requests (irrelevant today since no Convex
client is wired up, but harmless to leave in place for when it is). This has
been verified with the network fully disabled post-install: the app shell
loads, renders, and stays interactive (view switching, etc.) with zero
network requests succeeding.

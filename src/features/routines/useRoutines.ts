import { useEffect, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/db";
import type { EventDto, OccurrenceStatusDto, OccurrenceStatusValue } from "../../db/types";
import { ensureOccurrences, resolveOverdueOccurrences } from "../../lib/occurrences";
import { computeRoutineStats, type RoutineStats } from "../../lib/routineStats";
import { todayKey } from "../../lib/date.utils";

// isRoutine isn't Dexie-indexed (see db.ts) — filtered in memory, same
// pattern as useFoodSlots.
export function useRoutines(): EventDto[] {
  const events = useLiveQuery(() => db.events.toArray(), []) ?? [];
  return useMemo(
    () => events.filter((e) => e.isRoutine).sort((a, b) => a.title.localeCompare(b.title)),
    [events],
  );
}

// date (YYYY-MM-DD) -> status, scoped to one calendar year, for the Ember
// Year Heatmap.
export function useYearOccurrences(eventId: number | undefined, year: number): Map<string, OccurrenceStatusValue> {
  const statuses = useLiveQuery(
    (): Promise<OccurrenceStatusDto[]> =>
      eventId != null ? db.occurrenceStatus.where("eventId").equals(eventId).toArray() : Promise.resolve([]),
    [eventId],
  ) ?? [];

  return useMemo(() => {
    const prefix = String(year);
    const map = new Map<string, OccurrenceStatusValue>();
    for (const s of statuses) {
      if (s.occurrenceDate.startsWith(prefix)) map.set(s.occurrenceDate, s.status);
    }
    return map;
  }, [statuses, year]);
}

// Whole-life stats for one routine (current/longest streak, completion rate,
// best/worst weekday) — for the Year Heatmap's stats panel. Unlike
// useYearOccurrences this isn't scoped to a calendar year: current/longest
// streak conceptually span the routine's entire history, so this is keyed
// only on eventId, decoupled from YearHeatmapSheet's own year stepper.
//
// occurrenceStatus rows only ever get materialized for date ranges the
// calendar UI has actually been scrolled through (ensureOccurrences' only
// call site is useCalendarEvents) — without a backfill, "completion rate"
// would silently be computed over whatever arbitrary partial history the
// user happened to browse, not the routine's real life. Both functions
// below are the existing, idempotent, exported primitives (safe to re-run:
// ensureOccurrences diffs against existing rows, resolveOverdueOccurrences
// only touches still-"pending" rows), so this is wiring, not new logic.
export function useRoutineStats(eventId: number | undefined): RoutineStats {
  const event = useLiveQuery(() => (eventId != null ? db.events.get(eventId) : undefined), [eventId]);
  const rule = useLiveQuery(
    () => (eventId != null ? db.recurrenceRules.where("eventId").equals(eventId).first() : undefined),
    [eventId],
  );

  useEffect(() => {
    if (!event?.id || !rule) return;
    void (async () => {
      await ensureOccurrences(event, rule, event.startTime.slice(0, 10), todayKey());
      await resolveOverdueOccurrences();
    })();
    // Re-run only when the routine (or its rule) selection actually changes,
    // not on every live-query re-render of the same event/rule.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id, rule?.id]);

  const statuses = useLiveQuery(
    (): Promise<OccurrenceStatusDto[]> =>
      eventId != null ? db.occurrenceStatus.where("eventId").equals(eventId).toArray() : Promise.resolve([]),
    [eventId],
  ) ?? [];

  return useMemo(() => {
    const stats = computeRoutineStats(statuses, todayKey());
    // Prefer the already-cached, authoritative streakCount (kept fresh by
    // every setOccurrenceStatus call and auto-miss sweep, per CLAUDE.md)
    // over recomputing it from whatever rows happen to be loaded here, so
    // this panel can't show a different current streak than the rest of the
    // app. Falls back to the freshly-computed value only before the event
    // itself has loaded.
    return { ...stats, currentStreak: event?.streakCount ?? stats.currentStreak };
  }, [statuses, event?.streakCount]);
}

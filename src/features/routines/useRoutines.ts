import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/db";
import type { EventDto, OccurrenceStatusDto, OccurrenceStatusValue } from "../../db/types";

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

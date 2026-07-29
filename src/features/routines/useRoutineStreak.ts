import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import dayjs from "dayjs";
import { db } from "../../db/db";
import { todayKey } from "../../lib/date.utils";
import type { EmberBeadStatus } from "../../components/EmberChain";
import type { OccurrenceStatusDto } from "../../db/types";

// Oldest -> newest, `days` entries ending on today — feeds EmberChain directly.
export function useRecentBeads(eventId: number | undefined, days: number): EmberBeadStatus[] {
  const statuses = useLiveQuery(
    (): Promise<OccurrenceStatusDto[]> =>
      eventId != null ? db.occurrenceStatus.where("eventId").equals(eventId).toArray() : Promise.resolve([]),
    [eventId],
  ) ?? [];
  const byDate = useMemo(() => new Map(statuses.map((s) => [s.occurrenceDate, s.status])), [statuses]);

  return useMemo(() => {
    const today = dayjs(todayKey());
    const out: EmberBeadStatus[] = [];
    for (let i = days - 1; i >= 0; i--) {
      out.push(byDate.get(today.subtract(i, "day").format("YYYY-MM-DD")) ?? "none");
    }
    return out;
  }, [byDate, days]);
}

export function useStreakCount(eventId: number | undefined): number {
  const event = useLiveQuery(() => (eventId != null ? db.events.get(eventId) : undefined), [eventId]);
  return event?.streakCount ?? 0;
}

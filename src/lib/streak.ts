import dayjs from "dayjs";
import { db } from "../db/db";
import type { OccurrenceStatusValue } from "../db/types";
import { todayKey } from "./date.utils";

// Pure core, kept separate from the Dexie read so it can be unit-tested
// without a fake-IndexedDB shim. Consecutive "done" days ending at the most
// recently *resolved* day. `today` sitting as "pending" (not yet acted on)
// doesn't break a streak in progress — only an explicit "missed" does,
// whether set by the user or by resolveOverdueOccurrences() sweeping a
// forgotten past day.
export function computeStreakFromStatuses(
  byDate: Map<string, OccurrenceStatusValue>,
  today: string,
): number {
  if (byDate.get(today) === "missed") return 0;

  let cursor = dayjs(today);
  if (byDate.get(today) !== "done") cursor = cursor.subtract(1, "day");

  let streak = 0;
  while (byDate.get(cursor.format("YYYY-MM-DD")) === "done") {
    streak++;
    cursor = cursor.subtract(1, "day");
  }
  return streak;
}

export async function computeStreak(eventId: number): Promise<number> {
  const rows = await db.occurrenceStatus.where("eventId").equals(eventId).toArray();
  const byDate = new Map(rows.map((r) => [r.occurrenceDate, r.status]));
  return computeStreakFromStatuses(byDate, todayKey());
}

// Recomputes and writes the cache the spec calls for (events.streakCount) —
// call after any occurrence status change for that event.
export async function recomputeAndCacheStreak(eventId: number): Promise<number> {
  const streak = await computeStreak(eventId);
  await db.events.update(eventId, { streakCount: streak });
  return streak;
}

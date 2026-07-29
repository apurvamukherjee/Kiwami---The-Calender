import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import type { EventDto, RecurrenceRuleDto, OccurrenceStatusValue } from "../db/types";
import { expandOccurrences } from "./recurrence";
import { todayKey } from "./date.utils";
import { recomputeAndCacheStreak } from "./streak";

// Materializes OccurrenceStatusDto rows (status "pending") for every
// occurrence of a routine/food-slot event's recurrence rule within
// [rangeStart, rangeEnd]. Idempotent — checks existing rows before inserting,
// so it's safe to call repeatedly as the calendar's visible range changes
// (mirrors Zenith's spawnRecurring/useRecurringSpawner.ts pattern). Plain
// events (not isRoutine/isFoodSlot) never get tracked rows, even if they recur.
export async function ensureOccurrences(
  event: EventDto,
  rule: RecurrenceRuleDto | undefined,
  rangeStart: string,
  rangeEnd: string,
): Promise<void> {
  if (!event.id || !rule || !(event.isRoutine || event.isFoodSlot)) return;

  const anchorDate = event.startTime.slice(0, 10);
  const dates = expandOccurrences(anchorDate, rule, rangeStart, rangeEnd);
  if (dates.length === 0) return;

  const existing = await db.occurrenceStatus.where("eventId").equals(event.id).toArray();
  const existingDates = new Set(existing.map((o) => o.occurrenceDate));
  const missing = dates.filter((d) => !existingDates.has(d));
  if (missing.length === 0) return;

  await db.occurrenceStatus.bulkAdd(
    missing.map((occurrenceDate) => ({ eventId: event.id!, occurrenceDate, status: "pending" as const })),
  );
}

// Run once on app load (see App.tsx) and cheaply again on date rollover: any
// occurrence still "pending" whose date has already passed is resolved to
// "missed" and that event's cached streak is recomputed — this is what makes
// a forgotten routine actually break its streak instead of sitting
// unresolved forever.
export async function resolveOverdueOccurrences(): Promise<void> {
  const today = todayKey();
  const overdue = await db.occurrenceStatus
    .where("occurrenceDate")
    .below(today)
    .filter((o) => o.status === "pending")
    .toArray();
  if (overdue.length === 0) return;

  await db.transaction("rw", db.occurrenceStatus, async () => {
    for (const o of overdue) {
      await db.occurrenceStatus.update(o.id!, { status: "missed", resolvedAt: Date.now() });
    }
  });

  const affectedEventIds = new Set(overdue.map((o) => o.eventId));
  for (const eventId of affectedEventIds) await recomputeAndCacheStreak(eventId);
}

// The one write path the UI calls to mark an occurrence done/missed/pending
// (routine detail sheet's explicit buttons, food-slot ate/skipped tap).
export async function setOccurrenceStatus(
  eventId: number,
  occurrenceDate: string,
  status: OccurrenceStatusValue,
): Promise<void> {
  const existing = await db.occurrenceStatus.where({ eventId, occurrenceDate }).first();
  const resolvedAt = status === "pending" ? undefined : Date.now();
  if (existing) {
    await db.occurrenceStatus.update(existing.id!, { status, resolvedAt });
  } else {
    await db.occurrenceStatus.add({ eventId, occurrenceDate, status, resolvedAt });
  }
  await recomputeAndCacheStreak(eventId);
}

// Live status for one specific occurrence. Callers that already hold a
// CalendarItem snapshot should prefer this over item.occurrenceStatus — the
// snapshot is taken at tap-time and goes stale the instant the user acts on it.
export function useOccurrenceStatus(eventId: number | undefined, date: string | undefined): OccurrenceStatusValue {
  const row = useLiveQuery(
    () => (eventId != null && date ? db.occurrenceStatus.where({ eventId, occurrenceDate: date }).first() : undefined),
    [eventId, date],
  );
  return row?.status ?? "pending";
}

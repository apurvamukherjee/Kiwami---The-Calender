import { useEffect, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import dayjs from "dayjs";
import { db } from "../../db/db";
import type { EventDto, RecurrenceRuleDto, OccurrenceStatusDto } from "../../db/types";
import { expandOccurrences } from "../../lib/recurrence";
import { ensureOccurrences } from "../../lib/occurrences";

// One concrete, renderable occurrence of an event on a specific date. Plain
// events produce exactly one CalendarItem (their own date); recurring events
// produce one per expanded occurrence date, all sharing the same time-of-day
// as the parent event (the recurrence engine is deliberately simplified —
// no per-occurrence time overrides, only whole-series edits or exclusion).
export interface CalendarItem {
  event: EventDto;
  rule?: RecurrenceRuleDto;
  date: string; // YYYY-MM-DD — the start date
  time?: string; // HH:mm, undefined when allDay
  endTime?: string; // HH:mm
  occurrenceStatus?: OccurrenceStatusDto; // only present for isRoutine/isFoodSlot events
  // YYYY-MM-DD, only set for a non-recurring event whose end date falls
  // after its start date (a multi-day "trip"/"conference" style event).
  // Recurring events never span — the recurrence engine has no per-
  // occurrence override, so a spanning *series* would be a much bigger
  // feature; EventEditorSheet only offers the multi-day toggle for
  // non-recurring events in the first place. Month/Week render this as a
  // continuous bar instead of a per-day pill; Day/Agenda/TodayView treat
  // any date within [date, spanEndDate] as "showing" this item via
  // isItemOnDate below.
  spanEndDate?: string;
}

// True when `date` falls anywhere within this item's span (a single day for
// a normal item, since spanEndDate defaults to `date` itself).
export function isItemOnDate(item: CalendarItem, date: string): boolean {
  return date >= item.date && date <= (item.spanEndDate ?? item.date);
}

export function isSpanningItem(item: CalendarItem): boolean {
  return !!item.spanEndDate && item.spanEndDate !== item.date;
}

export function useCalendarEvents(rangeStart: string, rangeEnd: string): CalendarItem[] {
  const events = useLiveQuery(() => db.events.toArray(), []) ?? [];
  const rules = useLiveQuery(() => db.recurrenceRules.toArray(), []) ?? [];
  const statuses = useLiveQuery(() => db.occurrenceStatus.toArray(), []) ?? [];

  const rulesByEvent = useMemo(() => new Map(rules.map((r) => [r.eventId, r])), [rules]);
  const statusByKey = useMemo(
    () => new Map(statuses.map((s) => [`${s.eventId}|${s.occurrenceDate}`, s])),
    [statuses],
  );

  // Side effect: materialize occurrenceStatus rows for routine/food-slot
  // events whose occurrences fall within the currently visible range.
  useEffect(() => {
    for (const event of events) {
      if (!event.id || !(event.isRoutine || event.isFoodSlot)) continue;
      void ensureOccurrences(event, rulesByEvent.get(event.id), rangeStart, rangeEnd);
    }
  }, [events, rulesByEvent, rangeStart, rangeEnd]);

  return useMemo(() => {
    const items: CalendarItem[] = [];
    for (const event of events) {
      const rule = event.id != null ? rulesByEvent.get(event.id) : undefined;
      const anchorDate = event.startTime.slice(0, 10);
      const time = event.allDay ? undefined : dayjs(event.startTime).format("HH:mm");
      const endTime = event.endTime && !event.allDay ? dayjs(event.endTime).format("HH:mm") : undefined;
      const tracked = event.isRoutine || event.isFoodSlot;

      if (rule) {
        const dates = expandOccurrences(anchorDate, rule, rangeStart, rangeEnd);
        for (const date of dates) {
          items.push({
            event, rule, date, time, endTime,
            occurrenceStatus: tracked ? statusByKey.get(`${event.id}|${date}`) : undefined,
          });
        }
      } else {
        // A spanning event's start can be well before the visible range
        // (e.g. a trip that began last month, still ongoing) — include it
        // whenever its [anchorDate, spanEndDate] span overlaps the range at
        // all, not just when anchorDate itself falls inside it.
        const endDateOnly = event.endTime?.slice(0, 10);
        const spanEndDate = endDateOnly && endDateOnly > anchorDate ? endDateOnly : undefined;
        const itemSpanEnd = spanEndDate ?? anchorDate;
        if (itemSpanEnd >= rangeStart && anchorDate <= rangeEnd) {
          items.push({
            event, date: anchorDate, time, endTime, spanEndDate,
            occurrenceStatus: tracked ? statusByKey.get(`${event.id}|${anchorDate}`) : undefined,
          });
        }
      }
    }
    return items.sort((a, b) =>
      a.date === b.date ? (a.time ?? "").localeCompare(b.time ?? "") : a.date.localeCompare(b.date),
    );
  }, [events, rulesByEvent, statusByKey, rangeStart, rangeEnd]);
}

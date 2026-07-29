import dayjs, { type Dayjs } from "dayjs";
import type { RecurrenceRuleDto } from "../db/types";

// Never generate more than this many dates in a single call, regardless of
// how wide a range or how small an interval is passed in — a pure function
// with no other rate limit shouldn't be able to spin forever on bad input.
const MAX_OCCURRENCES = 5000;

function clampToLastDayOfMonth(monthStart: Dayjs, dayOfMonth: number): Dayjs {
  return monthStart.date(Math.min(dayOfMonth, monthStart.daysInMonth()));
}

// The core recurrence logic: given a rule and the event's own start date (the
// anchor — recurrence never produces a date before this, and "every N
// days/weeks" counts its cadence from here so the result doesn't drift
// depending on which window happens to be queried), returns every concrete
// occurrence date within [rangeStart, rangeEnd], both inclusive, as sorted
// "YYYY-MM-DD" strings.
export function expandOccurrences(
  anchorDate: string,
  rule: RecurrenceRuleDto,
  rangeStart: string,
  rangeEnd: string,
): string[] {
  const anchor = dayjs(anchorDate).startOf("day");
  const start = dayjs(rangeStart).startOf("day");
  const rawEnd = dayjs(rangeEnd).startOf("day");
  const ruleEnd = rule.endDate ? dayjs(rule.endDate).startOf("day") : null;
  const end = ruleEnd && ruleEnd.isBefore(rawEnd) ? ruleEnd : rawEnd;
  if (end.isBefore(anchor)) return [];

  const lower = start.isAfter(anchor) ? start : anchor;
  if (lower.isAfter(end)) return [];

  const results: string[] = [];

  if (rule.type === "daily") {
    let cursor = lower;
    let guard = 0;
    while (!cursor.isAfter(end) && guard < MAX_OCCURRENCES) {
      results.push(cursor.format("YYYY-MM-DD"));
      cursor = cursor.add(1, "day");
      guard++;
    }
  } else if (rule.type === "weekly") {
    const weekdays = new Set(rule.weekdays ?? []);
    if (weekdays.size > 0) {
      let cursor = lower;
      let guard = 0;
      while (!cursor.isAfter(end) && guard < MAX_OCCURRENCES) {
        if (weekdays.has(cursor.day())) results.push(cursor.format("YYYY-MM-DD"));
        cursor = cursor.add(1, "day");
        guard++;
      }
    }
  } else if (rule.type === "monthly") {
    const dayOfMonth = rule.dayOfMonth ?? anchor.date();
    let monthCursor = lower.startOf("month");
    const lastMonth = end.startOf("month");
    let guard = 0;
    while (!monthCursor.isAfter(lastMonth) && guard < MAX_OCCURRENCES) {
      const occurrence = clampToLastDayOfMonth(monthCursor, dayOfMonth);
      if (!occurrence.isBefore(lower) && !occurrence.isAfter(end)) {
        results.push(occurrence.format("YYYY-MM-DD"));
      }
      monthCursor = monthCursor.add(1, "month");
      guard++;
    }
  } else if (rule.type === "custom") {
    const interval = rule.interval ?? 1;
    if (interval >= 1) {
      const stepDays = rule.customUnit === "week" ? interval * 7 : interval;
      // Jump straight to the first candidate index >= `lower` instead of
      // stepping one-by-one from the anchor, so a rule created years ago
      // queried for a window years later doesn't take thousands of steps —
      // while still landing on the exact same cadence anchor would produce.
      const daysFromAnchorToLower = lower.diff(anchor, "day");
      let n = Math.max(0, Math.ceil(daysFromAnchorToLower / stepDays));
      let cursor = anchor.add(n * stepDays, "day");
      let guard = 0;
      while (!cursor.isAfter(end) && guard < MAX_OCCURRENCES) {
        results.push(cursor.format("YYYY-MM-DD"));
        n += 1;
        cursor = anchor.add(n * stepDays, "day");
        guard++;
      }
    }
  }

  if (rule.excludedDates.length === 0) return results;
  const excluded = new Set(rule.excludedDates);
  return results.filter((d) => !excluded.has(d));
}

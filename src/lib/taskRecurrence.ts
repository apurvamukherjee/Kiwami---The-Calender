import dayjs from "dayjs";
import { expandOccurrences } from "./recurrence";
import { combineDateTime } from "./date.utils";
import type { TaskRecurrenceDto } from "../db/types";

// How far past the current due date to search for the next occurrence — generous
// enough for any realistic daily/weekly/monthly/custom cadence without risking
// expandOccurrences' own MAX_OCCURRENCES guard in edge cases.
const ROLL_FORWARD_WINDOW_YEARS = 5;

// Rolls a recurring task's due date forward to its next occurrence after
// `currentDueDate`, preserving the original time-of-day. Returns undefined when the
// series has ended (recurrence.endDate has passed) — the caller then completes the
// task normally instead of rolling it forward. Reuses expandOccurrences() as-is: it
// never reads rule.eventId/rule.id, so a synthetic `eventId: 0` satisfies its type
// with no risk to the real recurrenceRules table.
export function rollTaskDueDateForward(
  currentDueDate: string,
  recurrence: TaskRecurrenceDto,
  allDay: boolean,
): string | undefined {
  const anchor = currentDueDate.slice(0, 10);
  const rangeStart = dayjs(anchor).add(1, "day").format("YYYY-MM-DD");
  const rangeEnd = recurrence.endDate ?? dayjs(anchor).add(ROLL_FORWARD_WINDOW_YEARS, "year").format("YYYY-MM-DD");

  const dates = expandOccurrences(anchor, { ...recurrence, eventId: 0 }, rangeStart, rangeEnd);
  const next = dates[0];
  if (!next) return undefined;

  const time = allDay ? "00:00" : dayjs(currentDueDate).format("HH:mm");
  return combineDateTime(next, time);
}

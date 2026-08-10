import { useMemo } from "react";
import dayjs from "dayjs";
import { todayKey } from "../../lib/date.utils";

export type CalendarView = "month" | "week" | "day" | "agenda" | "today";

export interface CalendarRange {
  rangeStart: string; // YYYY-MM-DD, inclusive
  rangeEnd: string; // YYYY-MM-DD, inclusive
}

const AGENDA_WINDOW_DAYS = 30;

// Pure date math per view. Month returns the full 6-week grid window (which
// bleeds into the previous/next month) so overflow-day cells still query
// correctly; week is Sunday-Saturday of currentDate; day is a single date;
// agenda is a rolling window forward from currentDate. "today" is
// deliberately anchored to the real current date, not `currentDate` — it's
// a dashboard, not a navigable view, so date-nav never touches it (see
// TodayView.tsx / CalendarPage's step() guard).
export function useCalendarRange(view: CalendarView, currentDate: string): CalendarRange {
  return useMemo(() => {
    const d = dayjs(currentDate);
    if (view === "today") {
      const t = todayKey();
      return { rangeStart: t, rangeEnd: t };
    }
    if (view === "month") {
      const monthStart = d.startOf("month");
      const monthEnd = d.endOf("month");
      const gridStart = monthStart.subtract(monthStart.day(), "day");
      const gridEnd = monthEnd.add(6 - monthEnd.day(), "day");
      return { rangeStart: gridStart.format("YYYY-MM-DD"), rangeEnd: gridEnd.format("YYYY-MM-DD") };
    }
    if (view === "week") {
      const weekStart = d.subtract(d.day(), "day");
      const weekEnd = weekStart.add(6, "day");
      return { rangeStart: weekStart.format("YYYY-MM-DD"), rangeEnd: weekEnd.format("YYYY-MM-DD") };
    }
    if (view === "day") {
      return { rangeStart: currentDate, rangeEnd: currentDate };
    }
    return { rangeStart: currentDate, rangeEnd: d.add(AGENDA_WINDOW_DAYS, "day").format("YYYY-MM-DD") };
  }, [view, currentDate]);
}

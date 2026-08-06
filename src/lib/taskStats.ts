import { useLiveQuery } from "dexie-react-hooks";
import dayjs from "dayjs";
import { db } from "../db/db";
import type { TaskDto } from "../db/types";

export interface WeeklyStats {
  completedCount: number;
  wontDoCount: number;
  // One entry per day in [weekStart, weekEnd], oldest first — feeds the
  // 7-bar mini chart. `count` mirrors doneToday's existing convention
  // (TasksPage.tsx): keyed on lastCompletedAt, which is stamped on both a
  // real completion and a recurring roll-forward.
  perDay: { date: string; count: number }[];
  // Mean(actual / estimate) over completed tasks in the window that have
  // both fields set — undefined (not 0/NaN) when no task qualifies, so the
  // caller can render "not enough data" instead of a misleading number.
  avgEstimateRatio?: number;
}

// Pure — no Dexie reads — so it's unit-testable the same way
// computeStreakFromStatuses (streak.ts) and rollTaskDueDateForward
// (taskRecurrence.ts) are: this function is given data, not a live query.
export function computeWeeklyStats(tasks: TaskDto[], weekStart: string, weekEnd: string): WeeklyStats {
  const days: string[] = [];
  for (let d = dayjs(weekStart); !d.isAfter(dayjs(weekEnd)); d = d.add(1, "day")) {
    days.push(d.format("YYYY-MM-DD"));
  }
  const perDay = days.map((date) => ({ date, count: 0 }));
  const perDayIndex = new Map(perDay.map((row, i) => [row.date, i]));

  let completedCount = 0;
  let wontDoCount = 0;
  const ratios: number[] = [];

  for (const t of tasks) {
    if (t.lastCompletedAt) {
      const key = dayjs(t.lastCompletedAt).format("YYYY-MM-DD");
      const idx = perDayIndex.get(key);
      if (idx != null) {
        completedCount++;
        perDay[idx].count++;
        if (t.estimatedMinutes && t.actualMinutes) {
          ratios.push(t.actualMinutes / t.estimatedMinutes);
        }
      }
    }
    if (t.wontDo && t.wontDoAt) {
      const key = dayjs(t.wontDoAt).format("YYYY-MM-DD");
      if (perDayIndex.has(key)) wontDoCount++;
    }
  }

  return {
    completedCount,
    wontDoCount,
    perDay,
    avgEstimateRatio: ratios.length > 0 ? ratios.reduce((a, b) => a + b, 0) / ratios.length : undefined,
  };
}

// Dexie-backed wrapper — mirrors streak.ts's split between the pure
// computeStreakFromStatuses and the live-query-consuming computeStreak.
export function useWeeklyStats(weekStart: string, weekEnd: string): WeeklyStats {
  const tasks = useLiveQuery(() => db.tasks.toArray(), []) ?? [];
  return computeWeeklyStats(tasks, weekStart, weekEnd);
}

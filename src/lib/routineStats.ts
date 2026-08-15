import dayjs from "dayjs";
import type { OccurrenceStatusDto, OccurrenceStatusValue } from "../db/types";
import { computeStreakFromStatuses } from "./streak";

// A weekday only gets ranked once it has at least this many resolved
// (done/missed) occurrences — otherwise a routine one week old would report
// a "best day" off a single data point. Mirrors taskStats.ts's
// avgEstimateRatio convention: undefined (not a misleading number) when
// there isn't enough data yet.
const MIN_WEEKDAY_SAMPLE = 3;

export interface RoutineStats {
  currentStreak: number;
  longestStreak: number;
  // done / (done + missed) across all resolved history — excludes
  // pending/future days, since those haven't happened yet. Undefined until
  // at least one occurrence has ever been resolved.
  completionRate?: number;
  bestWeekday?: { day: number; rate: number }; // day: 0 (Sun) – 6 (Sat)
  worstWeekday?: { day: number; rate: number };
}

// Pure — no Dexie reads — same split as computeStreakFromStatuses (streak.ts)
// and computeWeeklyStats (taskStats.ts): given data, not a live query, so
// it's unit-testable without a fake-IndexedDB shim.
export function computeRoutineStats(rows: OccurrenceStatusDto[], today: string): RoutineStats {
  const byDate = new Map<string, OccurrenceStatusValue>(rows.map((r) => [r.occurrenceDate, r.status]));
  const currentStreak = computeStreakFromStatuses(byDate, today);

  const resolvedDates = rows
    .filter((r) => r.status === "done" || r.status === "missed")
    .map((r) => r.occurrenceDate)
    .sort();

  let longestStreak = 0;
  let running = 0;
  let doneCount = 0;
  const perWeekday = Array.from({ length: 7 }, () => ({ done: 0, total: 0 }));

  for (const date of resolvedDates) {
    const done = byDate.get(date) === "done";
    running = done ? running + 1 : 0;
    longestStreak = Math.max(longestStreak, running);
    if (done) doneCount++;

    const weekday = dayjs(date).day();
    perWeekday[weekday].total++;
    if (done) perWeekday[weekday].done++;
  }

  const completionRate = resolvedDates.length > 0 ? doneCount / resolvedDates.length : undefined;

  const ranked = perWeekday
    .map((w, day) => ({ day, rate: w.done / w.total, total: w.total }))
    .filter((w) => w.total >= MIN_WEEKDAY_SAMPLE);

  let bestWeekday: RoutineStats["bestWeekday"];
  let worstWeekday: RoutineStats["worstWeekday"];
  if (ranked.length >= 2) {
    const sorted = [...ranked].sort((a, b) => b.rate - a.rate);
    bestWeekday = { day: sorted[0].day, rate: sorted[0].rate };
    worstWeekday = { day: sorted[sorted.length - 1].day, rate: sorted[sorted.length - 1].rate };
  }

  return { currentStreak, longestStreak, completionRate, bestWeekday, worstWeekday };
}

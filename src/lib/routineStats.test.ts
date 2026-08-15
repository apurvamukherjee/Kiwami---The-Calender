import { describe, it, expect } from "vitest";
import { computeRoutineStats } from "./routineStats";
import type { OccurrenceStatusDto, OccurrenceStatusValue } from "../db/types";

function rows(entries: Record<string, OccurrenceStatusValue>): OccurrenceStatusDto[] {
  return Object.entries(entries).map(([occurrenceDate, status]) => ({ eventId: 1, occurrenceDate, status }));
}

describe("computeRoutineStats", () => {
  it("returns all-zero/undefined stats for no history", () => {
    const stats = computeRoutineStats([], "2024-01-10");
    expect(stats).toEqual({ currentStreak: 0, longestStreak: 0, completionRate: undefined, bestWeekday: undefined, worstWeekday: undefined });
  });

  it("finds a longest streak longer than the current one", () => {
    // 2024-01-01..03 done (streak of 3), 01-04 missed, 01-05..06 done (streak of 2, still current)
    const stats = computeRoutineStats(
      rows({
        "2024-01-01": "done",
        "2024-01-02": "done",
        "2024-01-03": "done",
        "2024-01-04": "missed",
        "2024-01-05": "done",
        "2024-01-06": "done",
      }),
      "2024-01-06",
    );
    expect(stats.currentStreak).toBe(2);
    expect(stats.longestStreak).toBe(3);
  });

  it("computes completion rate from resolved days only, ignoring pending", () => {
    const stats = computeRoutineStats(
      rows({
        "2024-01-01": "done",
        "2024-01-02": "done",
        "2024-01-03": "missed",
        "2024-01-04": "pending", // must not count toward the rate
      }),
      "2024-01-04",
    );
    expect(stats.completionRate).toBeCloseTo(2 / 3);
  });

  it("leaves bestWeekday/worstWeekday undefined below the minimum sample size", () => {
    // Only 2 resolved Mondays — under the 3-sample threshold.
    const stats = computeRoutineStats(
      rows({ "2024-01-01": "done", "2024-01-08": "done" }), // both Mondays
      "2024-01-08",
    );
    expect(stats.bestWeekday).toBeUndefined();
    expect(stats.worstWeekday).toBeUndefined();
  });

  it("ranks best/worst weekday once enough samples exist on both", () => {
    // 2024-01-01 is a Monday. Mondays always done, Wednesdays always missed,
    // three of each — meets the minimum sample size on exactly two weekdays.
    const stats = computeRoutineStats(
      rows({
        "2024-01-01": "done", // Mon
        "2024-01-08": "done", // Mon
        "2024-01-15": "done", // Mon
        "2024-01-03": "missed", // Wed
        "2024-01-10": "missed", // Wed
        "2024-01-17": "missed", // Wed
      }),
      "2024-01-17",
    );
    expect(stats.bestWeekday).toEqual({ day: 1, rate: 1 }); // Monday
    expect(stats.worstWeekday).toEqual({ day: 3, rate: 0 }); // Wednesday
  });
});

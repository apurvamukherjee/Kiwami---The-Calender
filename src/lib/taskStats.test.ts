import { describe, it, expect } from "vitest";
import { computeWeeklyStats } from "./taskStats";
import type { TaskDto } from "../db/types";

function task(partial: Partial<TaskDto>): TaskDto {
  return {
    ownerId: "device",
    listId: 1,
    title: "t",
    order: 0,
    priority: "none",
    tagIds: [],
    subtasks: [],
    completed: false,
    archived: false,
    createdAt: 0,
    updatedAt: 0,
    ...partial,
  };
}

const WEEK_START = "2024-01-01";
const WEEK_END = "2024-01-07";

describe("computeWeeklyStats", () => {
  it("counts completions within the window, grouped per day", () => {
    const tasks = [
      task({ lastCompletedAt: new Date("2024-01-02T09:00:00").getTime() }),
      task({ lastCompletedAt: new Date("2024-01-02T18:00:00").getTime() }),
      task({ lastCompletedAt: new Date("2024-01-05T09:00:00").getTime() }),
    ];
    const stats = computeWeeklyStats(tasks, WEEK_START, WEEK_END);
    expect(stats.completedCount).toBe(3);
    expect(stats.perDay).toHaveLength(7);
    expect(stats.perDay.find((d) => d.date === "2024-01-02")?.count).toBe(2);
    expect(stats.perDay.find((d) => d.date === "2024-01-05")?.count).toBe(1);
    expect(stats.perDay.find((d) => d.date === "2024-01-01")?.count).toBe(0);
  });

  it("excludes completions outside the window", () => {
    const tasks = [task({ lastCompletedAt: new Date("2024-01-10T09:00:00").getTime() })];
    expect(computeWeeklyStats(tasks, WEEK_START, WEEK_END).completedCount).toBe(0);
  });

  it("counts won't-do tasks by wontDoAt, not by presence of the flag alone", () => {
    const tasks = [
      task({ wontDo: true, wontDoAt: new Date("2024-01-03T09:00:00").getTime() }),
      task({ wontDo: true, wontDoAt: new Date("2024-06-01T09:00:00").getTime() }), // outside window
      task({ wontDo: true }), // no timestamp — shouldn't count or throw
    ];
    expect(computeWeeklyStats(tasks, WEEK_START, WEEK_END).wontDoCount).toBe(1);
  });

  it("computes avgEstimateRatio only over tasks with both fields set", () => {
    const tasks = [
      task({ lastCompletedAt: new Date("2024-01-02T09:00:00").getTime(), estimatedMinutes: 30, actualMinutes: 60 }),
      task({ lastCompletedAt: new Date("2024-01-03T09:00:00").getTime(), estimatedMinutes: 20, actualMinutes: 20 }),
      task({ lastCompletedAt: new Date("2024-01-04T09:00:00").getTime(), estimatedMinutes: 15 }), // no actual — excluded
    ];
    expect(computeWeeklyStats(tasks, WEEK_START, WEEK_END).avgEstimateRatio).toBeCloseTo(1.5, 5);
  });

  it("returns undefined avgEstimateRatio when no task qualifies", () => {
    const tasks = [task({ lastCompletedAt: new Date("2024-01-02T09:00:00").getTime() })];
    expect(computeWeeklyStats(tasks, WEEK_START, WEEK_END).avgEstimateRatio).toBeUndefined();
  });
});

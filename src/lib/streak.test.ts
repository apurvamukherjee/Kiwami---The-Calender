import { describe, it, expect } from "vitest";
import { computeStreakFromStatuses } from "./streak";
import type { OccurrenceStatusValue } from "../db/types";

function statuses(entries: Record<string, OccurrenceStatusValue>): Map<string, OccurrenceStatusValue> {
  return new Map(Object.entries(entries));
}

describe("computeStreakFromStatuses", () => {
  it("counts back from today when today is already done", () => {
    const byDate = statuses({
      "2024-01-10": "done",
      "2024-01-09": "done",
      "2024-01-08": "done",
      "2024-01-07": "missed",
    });
    expect(computeStreakFromStatuses(byDate, "2024-01-10")).toBe(3);
  });

  it("counts back from yesterday when today is still pending (unresolved)", () => {
    const byDate = statuses({
      "2024-01-10": "pending",
      "2024-01-09": "done",
      "2024-01-08": "done",
      "2024-01-07": "missed",
    });
    expect(computeStreakFromStatuses(byDate, "2024-01-10")).toBe(2);
  });

  it("is zero when today itself is missed", () => {
    const byDate = statuses({ "2024-01-10": "missed", "2024-01-09": "done" });
    expect(computeStreakFromStatuses(byDate, "2024-01-10")).toBe(0);
  });

  it("is zero when yesterday was missed and today is pending", () => {
    const byDate = statuses({ "2024-01-10": "pending", "2024-01-09": "missed" });
    expect(computeStreakFromStatuses(byDate, "2024-01-10")).toBe(0);
  });

  it("is zero when there is no history at all", () => {
    expect(computeStreakFromStatuses(new Map(), "2024-01-10")).toBe(0);
  });

  it("stops counting at the first gap in the chain", () => {
    const byDate = statuses({
      "2024-01-10": "done",
      "2024-01-09": "done",
      // 2024-01-08 has no row at all — a gap, same as a break
      "2024-01-07": "done",
    });
    expect(computeStreakFromStatuses(byDate, "2024-01-10")).toBe(2);
  });
});

import { describe, it, expect } from "vitest";
import { expandOccurrences } from "./recurrence";
import type { RecurrenceRuleDto } from "../db/types";

function rule(partial: Partial<RecurrenceRuleDto> & Pick<RecurrenceRuleDto, "type">): RecurrenceRuleDto {
  return { eventId: 1, excludedDates: [], ...partial };
}

describe("expandOccurrences — daily", () => {
  it("returns every date in the range", () => {
    expect(expandOccurrences("2024-01-01", rule({ type: "daily" }), "2024-01-01", "2024-01-05")).toEqual([
      "2024-01-01", "2024-01-02", "2024-01-03", "2024-01-04", "2024-01-05",
    ]);
  });

  it("stops at the rule's endDate even if the queried range extends further", () => {
    expect(
      expandOccurrences("2024-01-01", rule({ type: "daily", endDate: "2024-01-03" }), "2024-01-01", "2024-01-05"),
    ).toEqual(["2024-01-01", "2024-01-02", "2024-01-03"]);
  });

  it("filters out excludedDates (single-occurrence deletes)", () => {
    expect(
      expandOccurrences("2024-01-01", rule({ type: "daily", excludedDates: ["2024-01-02"] }), "2024-01-01", "2024-01-04"),
    ).toEqual(["2024-01-01", "2024-01-03", "2024-01-04"]);
  });
});

describe("expandOccurrences — weekly", () => {
  it("only includes the selected weekdays, even when the range starts mid-week", () => {
    // 2024-01-01 is a Monday. weekdays 1=Mon, 3=Wed.
    const r = rule({ type: "weekly", weekdays: [1, 3] });
    expect(expandOccurrences("2024-01-01", r, "2024-01-03", "2024-01-14")).toEqual([
      "2024-01-03", // Wed
      "2024-01-08", // Mon
      "2024-01-10", // Wed
    ]);
  });

  it("returns nothing when no weekdays are selected", () => {
    const r = rule({ type: "weekly", weekdays: [] });
    expect(expandOccurrences("2024-01-01", r, "2024-01-01", "2024-01-31")).toEqual([]);
  });
});

describe("expandOccurrences — monthly", () => {
  it("clamps dayOfMonth=31 to the last day of shorter months", () => {
    // 2023 is not a leap year: Feb has 28 days, April has 30.
    const r = rule({ type: "monthly", dayOfMonth: 31 });
    expect(expandOccurrences("2023-01-31", r, "2023-01-01", "2023-04-30")).toEqual([
      "2023-01-31",
      "2023-02-28", // clamped
      "2023-03-31",
      "2023-04-30", // clamped
    ]);
  });

  it("skips the anchor's own month if that month's target day already passed relative to the anchor", () => {
    const r = rule({ type: "monthly", dayOfMonth: 10 });
    // anchor is March 15 — March 10 already passed, so March is skipped entirely.
    expect(expandOccurrences("2024-03-15", r, "2024-03-01", "2024-05-31")).toEqual([
      "2024-04-10",
      "2024-05-10",
    ]);
  });
});

describe("expandOccurrences — custom", () => {
  it("every-N-days cadence is anchored, not aligned to the queried window", () => {
    const r = rule({ type: "custom", interval: 3, customUnit: "day" });
    expect(expandOccurrences("2024-01-01", r, "2024-01-10", "2024-01-20")).toEqual([
      "2024-01-10", "2024-01-13", "2024-01-16", "2024-01-19",
    ]);
    // A window far later still lands on the same absolute cadence from the anchor.
    expect(expandOccurrences("2024-01-01", r, "2024-02-01", "2024-02-10")).toEqual([
      "2024-02-03", "2024-02-06", "2024-02-09",
    ]);
  });

  it("every-N-weeks cadence", () => {
    const r = rule({ type: "custom", interval: 2, customUnit: "week" });
    expect(expandOccurrences("2024-01-01", r, "2024-01-01", "2024-02-15")).toEqual([
      "2024-01-01", "2024-01-15", "2024-01-29", "2024-02-12",
    ]);
  });
});

describe("expandOccurrences — range/anchor boundaries", () => {
  it("returns nothing when the range is entirely before the anchor date", () => {
    const r = rule({ type: "daily" });
    expect(expandOccurrences("2024-06-01", r, "2024-01-01", "2024-01-31")).toEqual([]);
  });

  it("never returns a date before the anchor even if the range starts earlier", () => {
    const r = rule({ type: "daily" });
    expect(expandOccurrences("2024-01-10", r, "2024-01-01", "2024-01-12")).toEqual([
      "2024-01-10", "2024-01-11", "2024-01-12",
    ]);
  });

  it("includes the occurrence exactly on endDate, excludes the day after", () => {
    const r = rule({ type: "daily", endDate: "2024-01-05" });
    const result = expandOccurrences("2024-01-01", r, "2024-01-01", "2024-01-10");
    expect(result).toContain("2024-01-05");
    expect(result).not.toContain("2024-01-06");
  });
});

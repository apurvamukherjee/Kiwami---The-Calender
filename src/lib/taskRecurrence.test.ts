import { describe, it, expect } from "vitest";
import { rollTaskDueDateForward } from "./taskRecurrence";
import type { TaskRecurrenceDto } from "../db/types";

function recurrence(partial: Partial<TaskRecurrenceDto> & Pick<TaskRecurrenceDto, "type">): TaskRecurrenceDto {
  return { excludedDates: [], ...partial };
}

describe("rollTaskDueDateForward — daily", () => {
  it("advances to the next day, same time-of-day", () => {
    expect(rollTaskDueDateForward("2024-01-01T09:30:00", recurrence({ type: "daily" }), false)).toBe(
      "2024-01-02T09:30:00",
    );
  });

  it("returns undefined once the series' endDate has passed", () => {
    expect(
      rollTaskDueDateForward("2024-01-05T09:00:00", recurrence({ type: "daily", endDate: "2024-01-05" }), false),
    ).toBeUndefined();
  });
});

describe("rollTaskDueDateForward — weekly", () => {
  it("advances to the next selected weekday", () => {
    // 2024-01-01 is a Monday. weekdays 1=Mon, 3=Wed -> next after Monday is Wednesday.
    const r = recurrence({ type: "weekly", weekdays: [1, 3] });
    expect(rollTaskDueDateForward("2024-01-01T14:00:00", r, false)).toBe("2024-01-03T14:00:00");
  });
});

describe("rollTaskDueDateForward — monthly", () => {
  it("advances to the same day next month, clamped to shorter months", () => {
    const r = recurrence({ type: "monthly", dayOfMonth: 31 });
    expect(rollTaskDueDateForward("2024-01-31T08:00:00", r, false)).toBe("2024-02-29T08:00:00"); // 2024 is a leap year
  });
});

describe("rollTaskDueDateForward — custom", () => {
  it("advances by the custom interval", () => {
    const r = recurrence({ type: "custom", interval: 3, customUnit: "day" });
    expect(rollTaskDueDateForward("2024-01-01T09:00:00", r, false)).toBe("2024-01-04T09:00:00");
  });
});

describe("rollTaskDueDateForward — all-day preservation", () => {
  it("keeps the time at 00:00 for an all-day recurring task", () => {
    const r = recurrence({ type: "daily" });
    expect(rollTaskDueDateForward("2024-01-01T00:00:00", r, true)).toBe("2024-01-02T00:00:00");
  });
});

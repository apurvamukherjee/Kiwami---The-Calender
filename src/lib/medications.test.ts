import { describe, it, expect } from "vitest";
import { buildMedicationStreakMap, needsRefillAlert } from "./medications";
import type { MedicationLogDto, MedicationDto } from "../db/types";

function log(patch: Partial<MedicationLogDto>): MedicationLogDto {
  return { medicationId: 1, occurrenceDate: "2024-01-10", status: "done", ...patch };
}

describe("buildMedicationStreakMap", () => {
  it("marks a day done once every dose that day is logged done", () => {
    const logs = [
      log({ occurrenceDate: "2024-01-10", scheduledTime: "08:00", status: "done" }),
      log({ occurrenceDate: "2024-01-10", scheduledTime: "20:00", status: "done" }),
    ];
    expect(buildMedicationStreakMap(logs, 2).get("2024-01-10")).toBe("done");
  });

  it("marks a day missed if any dose that day was missed, even if others were taken", () => {
    const logs = [
      log({ occurrenceDate: "2024-01-10", scheduledTime: "08:00", status: "done" }),
      log({ occurrenceDate: "2024-01-10", scheduledTime: "20:00", status: "missed" }),
    ];
    expect(buildMedicationStreakMap(logs, 2).get("2024-01-10")).toBe("missed");
  });

  it("leaves a day absent from the map when only some doses are resolved", () => {
    const logs = [log({ occurrenceDate: "2024-01-10", scheduledTime: "08:00", status: "done" })];
    expect(buildMedicationStreakMap(logs, 2).has("2024-01-10")).toBe(false);
  });

  it("handles a single-dose-per-day medication", () => {
    const logs = [log({ occurrenceDate: "2024-01-10", status: "done" })];
    expect(buildMedicationStreakMap(logs, 1).get("2024-01-10")).toBe("done");
  });
});

function med(patch: Partial<MedicationDto>): MedicationDto {
  return {
    ownerId: "d", name: "Vitamin D", scheduleType: "scheduled", times: ["08:00"], active: true,
    createdAt: 0, updatedAt: 0, ...patch,
  };
}

describe("needsRefillAlert", () => {
  it("is false for a PRN medication", () => {
    expect(needsRefillAlert(med({ scheduleType: "prn", doseCountRemaining: 1, refillThresholdDays: 30 }))).toBe(false);
  });

  it("is false when refill tracking fields are unset", () => {
    expect(needsRefillAlert(med({}))).toBe(false);
  });

  it("is true once projected days-remaining drops to the threshold", () => {
    // 7 doses left, 1/day -> 7 days remaining, threshold 7
    expect(needsRefillAlert(med({ doseCountRemaining: 7, refillThresholdDays: 7 }))).toBe(true);
  });

  it("is false comfortably above the threshold", () => {
    expect(needsRefillAlert(med({ doseCountRemaining: 30, refillThresholdDays: 7 }))).toBe(false);
  });

  it("accounts for multiple doses per day", () => {
    // 10 doses left, 2/day -> 5 days remaining, threshold 7 -> alert
    expect(needsRefillAlert(med({ times: ["08:00", "20:00"], doseCountRemaining: 10, refillThresholdDays: 7 }))).toBe(true);
  });
});

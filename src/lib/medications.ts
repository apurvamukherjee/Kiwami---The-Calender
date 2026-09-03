import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import dayjs from "dayjs";
import { db } from "../db/db";
import type { MedicationDto, MedicationLogDto, MedicationScheduleType, OccurrenceStatusValue, TaskRecurrenceDto } from "../db/types";
import type { EmberBeadStatus } from "../components/EmberChain";
import { getDeviceId } from "./deviceId";
import { expandOccurrences } from "./recurrence";
import { computeStreakFromStatuses } from "./streak";
import { todayKey } from "./date.utils";

const OVERDUE_LOOKBACK_DAYS = 60;

export interface NewMedicationInput {
  name: string;
  dosage?: string;
  form?: string;
  scheduleType: MedicationScheduleType;
  recurrence?: TaskRecurrenceDto | null;
  times?: string[];
  doseCountRemaining?: number;
  refillThresholdDays?: number;
  notes?: string;
}

export async function createMedication(input: NewMedicationInput): Promise<number> {
  const now = Date.now();
  const scheduled = input.scheduleType === "scheduled";
  return db.medications.add({
    ownerId: getDeviceId(),
    name: input.name,
    dosage: input.dosage,
    form: input.form,
    scheduleType: input.scheduleType,
    recurrence: scheduled ? (input.recurrence ?? null) : null,
    times: scheduled ? (input.times ?? []) : [],
    doseCountRemaining: input.doseCountRemaining,
    refillThresholdDays: input.refillThresholdDays,
    notes: input.notes,
    active: true,
    createdAt: now,
    updatedAt: now,
  } as MedicationDto);
}

export async function updateMedication(id: number, patch: Partial<MedicationDto>): Promise<void> {
  await db.medications.update(id, { ...patch, updatedAt: Date.now() });
}

export async function setMedicationActive(id: number, active: boolean): Promise<void> {
  await db.medications.update(id, { active, updatedAt: Date.now() });
}

export async function deleteMedicationForever(id: number): Promise<void> {
  await db.transaction("rw", db.medications, db.medicationLogs, async () => {
    await db.medications.delete(id);
    const logs = await db.medicationLogs.where("medicationId").equals(id).toArray();
    await db.medicationLogs.bulkDelete(logs.map((l) => l.id!));
  });
}

export interface LogDoseInput {
  status: OccurrenceStatusValue;
  occurrenceDate?: string; // defaults to today
  scheduledTime?: string; // scheduled only — which of `times` this resolves
}

// PRN: always inserts a fresh row — no uniqueness constraint, a PRN med can be
// logged multiple times a day. Scheduled: upserts the
// [medicationId+occurrenceDate+scheduledTime] row, then recomputes the streak.
export async function logMedicationDose(medicationId: number, input: LogDoseInput): Promise<void> {
  const medication = await db.medications.get(medicationId);
  if (!medication) return;
  const occurrenceDate = input.occurrenceDate ?? todayKey();
  const resolvedAt = Date.now();

  if (medication.scheduleType === "prn") {
    await db.medicationLogs.add({ medicationId, occurrenceDate, status: input.status, resolvedAt });
    return;
  }

  const existing = input.scheduledTime
    ? await db.medicationLogs.where({ medicationId, occurrenceDate, scheduledTime: input.scheduledTime }).first()
    : undefined;
  if (existing) {
    await db.medicationLogs.update(existing.id!, { status: input.status, resolvedAt });
  } else {
    await db.medicationLogs.add({ medicationId, occurrenceDate, scheduledTime: input.scheduledTime, status: input.status, resolvedAt });
  }
  await recomputeAndCacheMedicationStreak(medicationId);
}

// Pure — unit-testable without a Dexie fixture. Folds a medication's
// (possibly multiple doses/day) logs into the single done/missed-per-day Map
// computeStreakFromStatuses() already expects, unmodified. A day counts
// "missed" if any dose that day was logged missed; "done" only once every
// scheduled dose that day is logged done; otherwise (partial/unresolved) the
// day is simply absent from the map, which computeStreakFromStatuses already
// treats as "doesn't extend the streak, doesn't zero it either" — same as a
// still-"pending" day for a routine.
export function buildMedicationStreakMap(logs: MedicationLogDto[], dosesPerDay: number): Map<string, OccurrenceStatusValue> {
  const byDay = new Map<string, MedicationLogDto[]>();
  for (const log of logs) {
    const arr = byDay.get(log.occurrenceDate);
    if (arr) arr.push(log);
    else byDay.set(log.occurrenceDate, [log]);
  }

  const expectedPerDay = Math.max(1, dosesPerDay);
  const byDate = new Map<string, OccurrenceStatusValue>();
  for (const [date, dayLogs] of byDay) {
    if (dayLogs.some((l) => l.status === "missed")) {
      byDate.set(date, "missed");
    } else if (dayLogs.filter((l) => l.status === "done").length >= expectedPerDay) {
      byDate.set(date, "done");
    }
  }
  return byDate;
}

// Reuses computeStreakFromStatuses() from lib/streak.ts UNMODIFIED.
export async function recomputeAndCacheMedicationStreak(medicationId: number): Promise<number> {
  const medication = await db.medications.get(medicationId);
  if (!medication || medication.scheduleType !== "scheduled") return 0;
  const logs = await db.medicationLogs.where("medicationId").equals(medicationId).toArray();

  const byDate = buildMedicationStreakMap(logs, medication.times.length);
  const streak = computeStreakFromStatuses(byDate, todayKey());
  await db.medications.update(medicationId, { streakCount: streak });
  return streak;
}

// Sibling to resolveOverdueOccurrences() (lib/occurrences.ts) — run once on
// app load (App.tsx). Any active scheduled medication's due (date, time)
// pair now in the past with no log row yet is marked "missed", so a
// forgotten dose actually breaks the streak instead of sitting unresolved
// forever.
export async function resolveOverdueMedicationDoses(): Promise<void> {
  const today = todayKey();
  const now = Date.now();
  // Strictly *before* today — today's own doses stay open all day, exactly
  // like resolveOverdueOccurrences()'s `.where("occurrenceDate").below(today)`
  // never touches today's own routine occurrence. A real bug was caught
  // here while verifying this phase: the range originally ran through
  // `today` inclusive, so any dose whose clock time had already passed
  // (e.g. an 08:00 dose, checked at 10am) got auto-marked "missed" on the
  // very next app mount — racing ahead of checkDueReminders' notification
  // (which skips a dose the instant it has any log row) and silently
  // denying the user the rest of the day to actually take it.
  const yesterday = dayjs(today).subtract(1, "day").format("YYYY-MM-DD");
  const medications = (await db.medications.toArray()).filter(
    (m) => m.active && m.scheduleType === "scheduled" && m.recurrence && m.times.length > 0,
  );
  if (medications.length === 0) return;

  // React StrictMode double-invokes a component's mount effect in dev (same
  // class of issue CLAUDE.md documents for ensureDefaultTaskLists() and
  // useBackClose) — two concurrent calls here could both read "no row yet"
  // for the same overdue dose and both bulkAdd it, tripping
  // medicationLogs' &[medicationId+occurrenceDate+scheduledTime] unique
  // index (a real Dexie BulkError, caught live while verifying this phase).
  // Wrapping the read-then-write in one transaction serializes concurrent
  // calls on IndexedDB's own readwrite-transaction ordering, so the second
  // invocation's read sees the first's already-committed rows instead of
  // racing it.
  const affected = new Set<number>();
  await db.transaction("rw", db.medicationLogs, async () => {
    for (const medication of medications) {
      if (!medication.id || !medication.recurrence) continue;
      const rangeStart = dayjs(today).subtract(OVERDUE_LOOKBACK_DAYS, "day").format("YYYY-MM-DD");
      if (rangeStart > yesterday) continue; // medication created today (or the lookback window is empty) — nothing to resolve yet
      const dates = expandOccurrences(rangeStart, { ...medication.recurrence, eventId: 0 }, rangeStart, yesterday);
      if (dates.length === 0) continue;

      const existingLogs = await db.medicationLogs.where("medicationId").equals(medication.id).toArray();
      const existingByKey = new Set(existingLogs.map((l) => `${l.occurrenceDate}|${l.scheduledTime ?? ""}`));

      // Every `date` here is <= yesterday, so every (date, time) pair is
      // already in the past by construction — no separate "is it actually
      // overdue yet" time check needed (that was the bug: doing this check
      // against `today` let a same-day, already-passed clock time slip
      // through as "overdue" before the day itself had ended).
      const toAdd: MedicationLogDto[] = [];
      for (const date of dates) {
        for (const time of medication.times) {
          if (existingByKey.has(`${date}|${time}`)) continue;
          toAdd.push({ medicationId: medication.id, occurrenceDate: date, scheduledTime: time, status: "missed", resolvedAt: now });
        }
      }
      if (toAdd.length > 0) {
        await db.medicationLogs.bulkAdd(toAdd);
        affected.add(medication.id);
      }
    }
  });

  for (const medicationId of affected) await recomputeAndCacheMedicationStreak(medicationId);
}

export function useMedications(opts?: { includeInactive?: boolean }): MedicationDto[] {
  const includeInactive = opts?.includeInactive ?? false;
  return (
    useLiveQuery(async () => {
      const all = await db.medications.toArray();
      return (includeInactive ? all : all.filter((m) => m.active)).sort((a, b) => a.name.localeCompare(b.name));
    }, [includeInactive]) ?? []
  );
}

export function useMedicationLogs(medicationId: number | undefined, days = 21): MedicationLogDto[] {
  return (
    useLiveQuery(async () => {
      if (medicationId == null) return [];
      const since = dayjs(todayKey()).subtract(days, "day").format("YYYY-MM-DD");
      const all = await db.medicationLogs.where("medicationId").equals(medicationId).toArray();
      return all.filter((l) => l.occurrenceDate >= since).sort((a, b) => a.occurrenceDate.localeCompare(b.occurrenceDate));
    }, [medicationId, days]) ?? []
  );
}

export interface MedicationOccurrence {
  medication: MedicationDto;
  scheduledTime: string;
  status: OccurrenceStatusValue;
}

// Today's due (medication, time) pairs joined with today's logs — the single
// data source for the Today Digest's Medications section and MedicationsView.
export function useTodayMedicationOccurrences(): MedicationOccurrence[] {
  return (
    useLiveQuery(async () => {
      const today = todayKey();
      const all = await db.medications.toArray();
      const scheduled = all.filter((m) => m.active && m.scheduleType === "scheduled" && m.recurrence && m.times.length > 0);
      const result: MedicationOccurrence[] = [];
      for (const medication of scheduled) {
        if (!medication.id || !medication.recurrence) continue;
        const dates = expandOccurrences(today, { ...medication.recurrence, eventId: 0 }, today, today);
        if (dates.length === 0) continue;
        const logs = await db.medicationLogs.where("medicationId").equals(medication.id).toArray();
        const logByTime = new Map(logs.filter((l) => l.occurrenceDate === today).map((l) => [l.scheduledTime, l.status]));
        for (const time of medication.times) {
          result.push({ medication, scheduledTime: time, status: logByTime.get(time) ?? "pending" });
        }
      }
      return result.sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));
    }, []) ?? []
  );
}

// Pure — unit-testable without a Dexie fixture.
export function needsRefillAlert(m: MedicationDto): boolean {
  if (m.scheduleType !== "scheduled" || m.doseCountRemaining == null || m.refillThresholdDays == null) return false;
  const dosesPerDay = Math.max(1, m.times.length);
  const daysRemaining = m.doseCountRemaining / dosesPerDay;
  return daysRemaining <= m.refillThresholdDays;
}

export function useRefillAlerts(): MedicationDto[] {
  const medications = useMedications();
  return useMemo(() => medications.filter(needsRefillAlert), [medications]);
}

// Oldest -> newest, `days` entries ending on today — feeds EmberChain directly,
// same shape as routines' useRecentBeads (features/routines/useRoutineStreak.ts).
// Reuses buildMedicationStreakMap's per-day folding, so a multi-dose-per-day
// medication's beads reflect "every dose that day," not just the first log seen.
export function useMedicationBeads(medicationId: number | undefined, days: number): EmberBeadStatus[] {
  const medication = useLiveQuery(() => (medicationId != null ? db.medications.get(medicationId) : undefined), [medicationId]);
  const logs = useLiveQuery(
    (): Promise<MedicationLogDto[]> =>
      medicationId != null ? db.medicationLogs.where("medicationId").equals(medicationId).toArray() : Promise.resolve([]),
    [medicationId],
  ) ?? [];
  const byDate = useMemo(() => buildMedicationStreakMap(logs, medication?.times.length ?? 1), [logs, medication?.times.length]);

  return useMemo(() => {
    const today = dayjs(todayKey());
    const out: EmberBeadStatus[] = [];
    for (let i = days - 1; i >= 0; i--) {
      out.push(byDate.get(today.subtract(i, "day").format("YYYY-MM-DD")) ?? "none");
    }
    return out;
  }, [byDate, days]);
}

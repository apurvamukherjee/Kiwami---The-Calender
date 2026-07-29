// Domain types. Flat for Dexie indexing.

export type RecurrenceType = "daily" | "weekly" | "monthly" | "custom";
export type OccurrenceStatusValue = "pending" | "done" | "missed";

export interface EventDto {
  id?: number;
  ownerId: string; // device UUID for now — see lib/deviceId.ts. Swappable to a real userId later with no schema change.
  title: string;
  description?: string;
  startTime: string; // ISO datetime
  endTime?: string; // ISO datetime
  allDay?: boolean;
  color?: string;
  calendarId?: string; // reserved for multi-calendar support; single implicit calendar for now
  location?: string;
  // Routine blocks: recurring, must be marked done/missed per occurrence, drives streak tracking.
  isRoutine?: boolean;
  // Food-time slots: recurring, one-tap ate/skipped log (reuses OccurrenceStatusDto).
  isFoodSlot?: boolean;
  // Cached on the event so the calendar/list UI never has to recompute it —
  // recalculated by lib/streak.ts whenever an occurrence's status changes.
  // Only meaningful when isRoutine is true.
  streakCount?: number;
  createdAt: number;
  updatedAt: number;
}

export interface RecurrenceRuleDto {
  id?: number;
  eventId: number;
  type: RecurrenceType;
  weekdays?: number[]; // weekly only: 0 (Sun) – 6 (Sat)
  dayOfMonth?: number; // monthly only: 1–31, clamped to the shorter month's last day
  interval?: number; // custom only: "every N days/weeks"
  customUnit?: "day" | "week"; // custom only: disambiguates interval's unit
  endDate?: string | null; // YYYY-MM-DD, inclusive; null/undefined = recurs forever
  excludedDates: string[]; // YYYY-MM-DD[] — single occurrences deleted from an otherwise-recurring series
}

// Tracks completion for one concrete occurrence of a routine or food-slot
// event. Plain (non-routine, non-food-slot) events never get rows here, even
// if they recur — there's nothing to mark done/missed on a normal meeting.
export interface OccurrenceStatusDto {
  id?: number;
  eventId: number;
  occurrenceDate: string; // YYYY-MM-DD
  status: OccurrenceStatusValue;
  resolvedAt?: number; // epoch ms when status left "pending"
}

export interface SettingDto {
  key: string;
  value: string | number;
}

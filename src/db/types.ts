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

export type TaskPriority = "none" | "low" | "medium" | "high" | "urgent";

export interface TaskSubtaskDto {
  id: string; // crypto.randomUUID() — inline, not a Dexie row
  title: string;
  done: boolean;
}

// Same shape as RecurrenceRuleDto minus id/eventId — deliberately NOT stored in the
// shared recurrenceRules table (expandOccurrences() never reads eventId/id, so this
// is safely reusable as a plain embedded object with zero risk to that table/its tests).
export interface TaskRecurrenceDto {
  type: RecurrenceType;
  weekdays?: number[];
  dayOfMonth?: number;
  interval?: number;
  customUnit?: "day" | "week";
  endDate?: string | null;
  excludedDates: string[]; // always [] in Stage 1 — no per-occurrence delete UI for tasks
}

export interface TaskListDto {
  id?: number;
  ownerId: string;
  name: string;
  color?: string;
  order: number;
  archived?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface TaskTagDto {
  id?: number;
  ownerId: string;
  name: string;
  color: string; // hex — from useTokens() swatches, never `diamond` (reserved for streak milestones)
  createdAt: number;
}

export interface TaskDto {
  id?: number;
  ownerId: string;
  listId: number;
  title: string;
  description?: string;
  order: number; // integer position within its list
  priority: TaskPriority;
  tagIds: number[];
  subtasks: TaskSubtaskDto[];
  dueDate?: string; // ISO local datetime, date.utils.ts shape
  // "When you plan to work on it", distinct from dueDate ("when it's due") —
  // Stage 2's unified do/due model. Independently settable; the calendar
  // overlay and TaskDetailSheet's "Do date" toggle both key off `doDate ??
  // dueDate`. Rolled forward alongside dueDate on a recurring completion
  // (see completeTask), preserving the original offset between the two.
  doDate?: string;
  allDay?: boolean;
  recurrence?: TaskRecurrenceDto | null;
  completed: boolean;
  completedAt?: number;
  // Stamped on every completion, including a recurring roll-forward — the sole input
  // to the optional "N done today" indicator. Deliberately not a streak.
  lastCompletedAt?: number;
  // A third terminal state alongside `completed` — mutually exclusive with
  // it (see markTaskWontDo). Rendered as "cold ash" on the card, distinct
  // from the warm "done" treatment; excluded from the calendar overlay.
  wontDo?: boolean;
  // Stamped whenever wontDo flips true — `updatedAt` alone can't answer "was
  // this marked won't-do this week", since any later edit also bumps it.
  // Feeds WeeklyReviewSheet's won't-do count.
  wontDoAt?: number;
  // Guards the reminder sweep (checkDueReminders) from re-firing the same
  // due-date notification on every 60s tick — same role as NoteDto's field.
  notifiedAt?: number;
  // Dedicated field rather than a tag-naming convention (e.g. an "energy"
  // tag category) — a real field is filterable/sortable without fragile
  // string-matching, which FocusSheet's energy-match filter needs.
  energy?: "low" | "medium" | "high";
  // Planned-vs-actual time tracking — deliberately two plain numbers, not a
  // live start/stop timer: a background timer is unreliable the moment the
  // tab/app closes, real complexity this local-first app doesn't need.
  // `actualMinutes` is editable any time, not just on completion.
  estimatedMinutes?: number;
  actualMinutes?: number;
  archived: boolean; // the primary destructive action's target, not hard delete
  archivedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export type NoteKind = "note" | "task" | "reminder";

export interface NoteDto {
  id?: number;
  ownerId: string;
  kind: NoteKind;
  title: string; // display text — for kind "note" this is the rich body's first line; otherwise the parsed date phrase stripped out of rawText
  rawText: string; // exactly what was typed — restored into the composer on edit. Unused once a "note" has a body (rawText was only ever its first draft).
  description?: string; // task/reminder only — the "note" kind's long-form content lives in `body` instead
  body?: string; // kind "note" only — Tiptap HTML, edited full-screen in NoteFullEditor
  dueDate?: string; // ISO datetime; task/reminder only
  allDay?: boolean; // true when only a date (no time) was set/parsed
  location?: string;
  links?: string[]; // regex-extracted from rawText + manually added
  completed?: boolean; // task/reminder — reminder uses it as "dismissed" so it stops showing in the due list
  completedAt?: number;
  notifiedAt?: number; // reminder only — guards re-firing the same reminder on every sweep tick
  createdAt: number;
  updatedAt: number;
}

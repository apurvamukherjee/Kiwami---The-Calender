import { db } from "../db/db";
import type { EventDto, RecurrenceRuleDto } from "../db/types";
import { getDeviceId } from "./deviceId";

export interface NewEventInput {
  title: string;
  description?: string;
  startTime: string;
  endTime?: string;
  allDay?: boolean;
  color?: string;
  location?: string;
  isRoutine?: boolean;
  isFoodSlot?: boolean;
  recurrence?: Omit<RecurrenceRuleDto, "id" | "eventId"> | null;
}

export async function createEvent(input: NewEventInput): Promise<number> {
  const now = Date.now();
  const id = await db.events.add({
    ownerId: getDeviceId(),
    title: input.title,
    description: input.description,
    startTime: input.startTime,
    endTime: input.endTime,
    allDay: input.allDay,
    color: input.color,
    location: input.location,
    isRoutine: input.isRoutine,
    isFoodSlot: input.isFoodSlot,
    streakCount: input.isRoutine ? 0 : undefined,
    createdAt: now,
    updatedAt: now,
  } as EventDto);
  if (input.recurrence) {
    await db.recurrenceRules.add({ eventId: id, ...input.recurrence });
  }
  return id;
}

export async function updateEvent(id: number, patch: Partial<EventDto>): Promise<void> {
  await db.events.update(id, { ...patch, updatedAt: Date.now() });
}

export async function deleteEvent(id: number): Promise<void> {
  await db.transaction("rw", db.events, db.recurrenceRules, db.occurrenceStatus, async () => {
    await db.events.delete(id);
    await db.recurrenceRules.where("eventId").equals(id).delete();
    await db.occurrenceStatus.where("eventId").equals(id).delete();
  });
}

export async function setRecurrenceRule(
  eventId: number,
  rule: Omit<RecurrenceRuleDto, "id" | "eventId"> | null,
): Promise<void> {
  const existing = await db.recurrenceRules.where("eventId").equals(eventId).first();
  if (!rule) {
    if (existing) await db.recurrenceRules.delete(existing.id!);
    return;
  }
  if (existing) await db.recurrenceRules.update(existing.id!, rule);
  else await db.recurrenceRules.add({ eventId, ...rule });
}

// Deletes a single occurrence from an otherwise-recurring series without
// touching the rest of the series (spec's "excludedDates, for deleting
// single occurrences").
export async function deleteOccurrence(eventId: number, date: string): Promise<void> {
  const rule = await db.recurrenceRules.where("eventId").equals(eventId).first();
  if (!rule) return;
  if (!rule.excludedDates.includes(date)) {
    await db.recurrenceRules.update(rule.id!, { excludedDates: [...rule.excludedDates, date] });
  }
  await db.occurrenceStatus.where({ eventId, occurrenceDate: date }).delete();
}

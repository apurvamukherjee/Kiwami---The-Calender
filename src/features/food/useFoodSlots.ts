import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/db";
import { createEvent, updateEvent, deleteEvent } from "../../lib/events";
import { combineDateTime, todayKey } from "../../lib/date.utils";
import type { EventDto } from "../../db/types";

// isFoodSlot isn't Dexie-indexed (see db.ts) — filtered in memory off a full
// table scan, which is fine at this app's scale (a handful of slots).
export function useFoodSlots(): EventDto[] {
  const events = useLiveQuery(() => db.events.toArray(), []) ?? [];
  return useMemo(
    () => events.filter((e) => e.isFoodSlot).sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [events],
  );
}

// Food slots are always daily under the hood — the spec calls for
// add/remove/rename/retime only, not a full recurrence picker for these.
export async function addFoodSlot(title: string, time: string): Promise<void> {
  await createEvent({
    title,
    startTime: combineDateTime(todayKey(), time),
    isFoodSlot: true,
    recurrence: { type: "daily", endDate: null, excludedDates: [] },
  });
}

export async function renameFoodSlot(id: number, title: string): Promise<void> {
  await updateEvent(id, { title });
}

export async function retimeFoodSlot(id: number, time: string): Promise<void> {
  const event = await db.events.get(id);
  if (!event) return;
  await updateEvent(id, { startTime: combineDateTime(event.startTime.slice(0, 10), time) });
}

export async function removeFoodSlot(id: number): Promise<void> {
  await deleteEvent(id);
}

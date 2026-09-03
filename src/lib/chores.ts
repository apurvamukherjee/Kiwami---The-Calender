import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import type { ChoreDto, TaskRecurrenceDto } from "../db/types";
import { getDeviceId } from "./deviceId";
import { rollTaskDueDateForward } from "./taskRecurrence";
import { todayKey } from "./date.utils";

export interface NewChoreInput {
  title: string;
  notes?: string;
  recurrence?: TaskRecurrenceDto | null;
  rescheduleFromCompletion?: boolean;
  dueDate?: string;
}

export async function createChore(input: NewChoreInput): Promise<number> {
  const now = Date.now();
  return db.chores.add({
    ownerId: getDeviceId(),
    title: input.title,
    notes: input.notes,
    recurrence: input.recurrence ?? null,
    rescheduleFromCompletion: input.rescheduleFromCompletion ?? false,
    dueDate: input.dueDate,
    completed: false,
    archived: false,
    createdAt: now,
    updatedAt: now,
  } as ChoreDto);
}

export async function updateChore(id: number, patch: Partial<ChoreDto>): Promise<void> {
  await db.chores.update(id, { ...patch, updatedAt: Date.now() });
}

export async function archiveChore(id: number): Promise<void> {
  await db.chores.update(id, { archived: true, archivedAt: Date.now(), updatedAt: Date.now() });
}

export async function unarchiveChore(id: number): Promise<void> {
  await db.chores.update(id, { archived: false, archivedAt: undefined, updatedAt: Date.now() });
}

export async function deleteChoreForever(id: number): Promise<void> {
  await db.chores.delete(id);
}

// Forks completeTask()'s exact shape (lib/tasks.ts). The one new piece of
// logic: which date rollTaskDueDateForward() anchors on. `rescheduleFromCompletion`
// anchors on the actual completion date (todayKey() — the Chore Master model:
// "N days after you actually did it"); otherwise it anchors on the chore's
// existing dueDate, identical to how completeTask() already rolls a fixed-
// schedule recurring task forward. rollTaskDueDateForward() already accepts
// an arbitrary anchor date, so no change to it (or to expandOccurrences) was
// needed for this.
export async function completeChore(id: number, completed: boolean): Promise<void> {
  const now = Date.now();
  if (!completed) {
    await db.chores.update(id, { completed: false, updatedAt: now });
    return;
  }
  const chore = await db.chores.get(id);
  if (chore?.recurrence) {
    const anchor = chore.rescheduleFromCompletion ? todayKey() : (chore.dueDate ?? todayKey());
    const next = rollTaskDueDateForward(anchor, chore.recurrence, true);
    if (next) {
      await db.chores.update(id, { dueDate: next, completed: false, lastCompletedAt: now, updatedAt: now });
      return;
    }
  }
  await db.chores.update(id, { completed: true, lastCompletedAt: now, updatedAt: now });
}

export function useChores(opts?: { includeArchived?: boolean }): ChoreDto[] {
  const includeArchived = opts?.includeArchived ?? false;
  return (
    useLiveQuery(async () => {
      const all = await db.chores.toArray();
      return (includeArchived ? all : all.filter((c) => !c.archived)).sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
    }, [includeArchived]) ?? []
  );
}

// Due today or overdue-and-still-open, not archived — Today Digest's "Chores
// & Household" section source, mirroring TodayView's relevantTasks filter.
export function useTodayChores(): ChoreDto[] {
  const chores = useChores();
  const today = todayKey();
  return chores
    .filter((c) => {
      if (c.completed) return false;
      const due = c.dueDate?.slice(0, 10);
      return !!due && due <= today;
    })
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
}

import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import dayjs from "dayjs";
import { db } from "../db/db";
import { TOKENS } from "../theme";
import { getDeviceId } from "./deviceId";
import { rollTaskDueDateForward } from "./taskRecurrence";
import type { TaskDto, TaskListDto, TaskTagDto, TaskPriority, TaskRecurrenceDto, TaskSubtaskDto } from "../db/types";

export const PRIORITY_ORDER: Record<TaskPriority, number> = { none: 0, low: 1, medium: 2, high: 3, urgent: 4 };
export const PRIORITY_LABEL: Record<TaskPriority, string> = { none: "None", low: "Low", medium: "Medium", high: "High", urgent: "Urgent" };
// Keys into useTokens()'s palette — never "diamond" (reserved exclusively for streak milestones).
export const PRIORITY_TOKEN_KEY: Record<TaskPriority, "ash" | "teal" | "accent" | "gold" | "danger"> = {
  none: "ash",
  low: "teal",
  medium: "accent",
  high: "gold",
  urgent: "danger",
};

export interface NewTaskInput {
  listId: number;
  title: string;
  description?: string;
  priority?: TaskPriority;
  tagIds?: number[];
  subtasks?: TaskSubtaskDto[];
  dueDate?: string;
  allDay?: boolean;
  recurrence?: TaskRecurrenceDto | null;
}

export async function createTask(input: NewTaskInput): Promise<number> {
  const now = Date.now();
  const siblings = await db.tasks.where("listId").equals(input.listId).toArray();
  const order = siblings.reduce((max, t) => Math.max(max, t.order), -1) + 1;
  return db.tasks.add({
    ownerId: getDeviceId(),
    listId: input.listId,
    title: input.title,
    description: input.description,
    order,
    priority: input.priority ?? "none",
    tagIds: input.tagIds ?? [],
    subtasks: input.subtasks ?? [],
    dueDate: input.dueDate,
    allDay: input.allDay,
    recurrence: input.recurrence ?? null,
    completed: false,
    archived: false,
    createdAt: now,
    updatedAt: now,
  } as TaskDto);
}

export async function updateTask(id: number, patch: Partial<TaskDto>): Promise<void> {
  await db.tasks.update(id, { ...patch, updatedAt: Date.now() });
}

// Completing a recurring task never creates an occurrenceStatus row and never touches
// db.events.streakCount — no routine/streak machinery is used here. Instead the due
// date rolls forward and the task stays active (completed: false), so the same row
// simply reappears later. `lastCompletedAt` is stamped either way, for the optional
// "N done today" indicator.
export async function completeTask(id: number, completed: boolean): Promise<void> {
  const now = Date.now();
  if (!completed) {
    await db.tasks.update(id, { completed: false, completedAt: undefined, updatedAt: now });
    return;
  }
  const task = await db.tasks.get(id);
  if (task?.recurrence && task.dueDate) {
    const next = rollTaskDueDateForward(task.dueDate, task.recurrence, !!task.allDay);
    if (next) {
      // Preserve the original offset between doDate and dueDate (rather than
      // re-deriving doDate from the recurrence rule directly) so a doDate
      // that was deliberately set a day or two before its dueDate keeps
      // that same lead time on every future occurrence. Diffed/added in
      // minutes via dayjs (local-time strings, no "Z" suffix — see
      // date.utils.ts) rather than Date#toISOString(), which would silently
      // convert to UTC and desync from every other dueDate/doDate string's
      // local-format convention.
      const doDate = task.doDate
        ? dayjs(task.doDate).add(dayjs(next).diff(dayjs(task.dueDate), "minute"), "minute").format("YYYY-MM-DDTHH:mm:00")
        : undefined;
      await db.tasks.update(id, { dueDate: next, doDate, completed: false, lastCompletedAt: now, updatedAt: now });
      return;
    }
  }
  await db.tasks.update(id, { completed: true, completedAt: now, lastCompletedAt: now, updatedAt: now });
}

export async function markTaskWontDo(id: number, wontDo: boolean): Promise<void> {
  const now = Date.now();
  await db.tasks.update(id, wontDo
    ? { wontDo: true, wontDoAt: now, completed: false, completedAt: undefined, updatedAt: now }
    : { wontDo: false, updatedAt: now });
}

export async function archiveTask(id: number): Promise<void> {
  await db.tasks.update(id, { archived: true, archivedAt: Date.now(), updatedAt: Date.now() });
}

export async function unarchiveTask(id: number): Promise<void> {
  await db.tasks.update(id, { archived: false, archivedAt: undefined, updatedAt: Date.now() });
}

// The only path that reaches this — TaskArchiveView's own Popconfirm. archiveTask()
// above is the primary destructive action everywhere else.
export async function deleteTaskForever(id: number): Promise<void> {
  await db.tasks.delete(id);
}

// Single write path for KanbanBoard's onDragEnd — commits every column's final task
// order (and listId, for cross-column moves) in one transaction, skipping no-op writes.
export async function reorderBoard(columns: { listId: number; taskIds: number[] }[]): Promise<void> {
  await db.transaction("rw", db.tasks, async () => {
    for (const col of columns) {
      for (let i = 0; i < col.taskIds.length; i++) {
        const id = col.taskIds[i];
        const t = await db.tasks.get(id);
        if (!t || (t.listId === col.listId && t.order === i)) continue;
        await db.tasks.update(id, { listId: col.listId, order: i });
      }
    }
  });
}

export async function createTaskList(input: { name: string; color?: string }): Promise<number> {
  const now = Date.now();
  const existing = await db.taskLists.toArray();
  const order = existing.reduce((max, l) => Math.max(max, l.order), -1) + 1;
  return db.taskLists.add({ ownerId: getDeviceId(), name: input.name, color: input.color, order, createdAt: now, updatedAt: now });
}

export async function updateTaskList(id: number, patch: Partial<TaskListDto>): Promise<void> {
  await db.taskLists.update(id, { ...patch, updatedAt: Date.now() });
}

export async function archiveTaskList(id: number): Promise<void> {
  await db.taskLists.update(id, { archived: true, updatedAt: Date.now() });
}

export async function reorderTaskLists(orderedIds: number[]): Promise<void> {
  await db.transaction("rw", db.taskLists, async () => {
    for (let i = 0; i < orderedIds.length; i++) {
      await db.taskLists.update(orderedIds[i], { order: i });
    }
  });
}

export async function createTaskTag(input: { name: string; color: string }): Promise<number> {
  return db.taskTags.add({ ownerId: getDeviceId(), name: input.name, color: input.color, createdAt: Date.now() });
}

export async function updateTaskTag(id: number, patch: Partial<TaskTagDto>): Promise<void> {
  await db.taskTags.update(id, patch);
}

// Cascades removal from every task's tagIds, mirroring deleteEvent's cleanup pattern.
export async function deleteTaskTag(id: number): Promise<void> {
  await db.transaction("rw", db.taskTags, db.tasks, async () => {
    await db.taskTags.delete(id);
    const affected = await db.tasks.where("tagIds").equals(id).toArray();
    for (const t of affected) {
      await db.tasks.update(t.id!, { tagIds: t.tagIds.filter((tid) => tid !== id) });
    }
  });
}

// Seeds 3 starter lists on first visit to the Tasks section. Called from TasksPage's
// mount effect, not App.tsx, since Tasks may never be visited in a session. The
// count-check and bulkAdd must share one IndexedDB transaction: React StrictMode's
// double-invoked mount effect (dev only, same class of issue CLAUDE.md documents for
// useBackClose) fires this twice in quick succession, and two independent count()
// calls can both observe 0 before either write commits. IndexedDB serializes
// readwrite transactions on the same store, so wrapping both steps in one
// db.transaction makes the second call's count() see the first call's already-
// committed rows instead of racing it.
export async function ensureDefaultTaskLists(): Promise<void> {
  await db.transaction("rw", db.taskLists, async () => {
    const count = await db.taskLists.count();
    if (count > 0) return;
    const now = Date.now();
    const ownerId = getDeviceId();
    await db.taskLists.bulkAdd([
      { ownerId, name: "To Do", color: TOKENS.dark.accent, order: 0, createdAt: now, updatedAt: now },
      { ownerId, name: "In Progress", color: TOKENS.dark.gold, order: 1, createdAt: now, updatedAt: now },
      { ownerId, name: "Done", color: TOKENS.dark.teal, order: 2, createdAt: now, updatedAt: now },
    ]);
  });
}

export function groupTasksByList(tasks: TaskDto[]): Map<number, TaskDto[]> {
  const map = new Map<number, TaskDto[]>();
  for (const t of tasks) {
    if (t.id == null) continue;
    const arr = map.get(t.listId);
    if (arr) arr.push(t);
    else map.set(t.listId, [t]);
  }
  for (const arr of map.values()) arr.sort((a, b) => a.order - b.order);
  return map;
}

export function useTaskLists(includeArchived = false): TaskListDto[] {
  return (
    useLiveQuery(async () => {
      const all = await db.taskLists.toArray();
      return (includeArchived ? all : all.filter((l) => !l.archived)).sort((a, b) => a.order - b.order);
    }, [includeArchived]) ?? []
  );
}

export function useTaskTags(): TaskTagDto[] {
  return useLiveQuery(() => db.taskTags.toArray(), []) ?? [];
}

// Flat, in-memory filtered — same "fine at this app's scale" convention as useNotes.
export function useTasks(opts?: { includeArchived?: boolean }): TaskDto[] {
  const includeArchived = opts?.includeArchived ?? false;
  return (
    useLiveQuery(async () => {
      const all = await db.tasks.toArray();
      return includeArchived ? all : all.filter((t) => !t.archived);
    }, [includeArchived]) ?? []
  );
}

export function useTasksByList(opts?: { includeArchived?: boolean }): Map<number, TaskDto[]> {
  const tasks = useTasks(opts);
  return useMemo(() => groupTasksByList(tasks), [tasks]);
}

// Tasks scheduled within [rangeStart, rangeEnd] (both YYYY-MM-DD, inclusive),
// keyed off `doDate ?? dueDate` — feeds Calendar's Month/Agenda overlay,
// mirroring lib/notes.ts's useNotesForRange. Archived and won't-do tasks are
// excluded (neither belongs on a "what's scheduled" view); completed tasks
// still show, same dimmed-not-removed treatment Month/Agenda already give a
// done/missed CalendarItem.
export function useTasksForRange(rangeStart: string, rangeEnd: string): TaskDto[] {
  return (
    useLiveQuery(async () => {
      const all = await db.tasks.toArray();
      return all.filter((t) => {
        if (t.archived || t.wontDo) return false;
        const scheduled = t.doDate ?? t.dueDate;
        if (!scheduled) return false;
        const d = scheduled.slice(0, 10);
        return d >= rangeStart && d <= rangeEnd;
      });
    }, [rangeStart, rangeEnd]) ?? []
  );
}
